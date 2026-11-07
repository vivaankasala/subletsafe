import { createClient } from "@supabase/supabase-js";
import { validateImage } from "../_shared/image-validation.ts";
Deno.serve(async (req: Request) => {
  const origin = Deno.env.get("APP_ORIGIN") || "http://localhost:5173";
  const headers = {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers":
      "authorization,apikey,content-type,x-client-info",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    Vary: "Origin",
  };
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    if (req.headers.get("origin") && req.headers.get("origin") !== origin)
      return json({ error: "Origin not allowed" }, 403);
    const auth = req.headers.get("authorization") || "";
    const url = Deno.env.get("SUPABASE_URL")!,
      pub = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(url, pub, {
      global: { headers: { Authorization: auth } },
    });
    const {
      data: { user },
      error,
    } = await userClient.auth.getUser();
    if (error || !user) return json({ error: "Sign in first" }, 401);
    const { data: eligible, error: eligibilityError } =
      await userClient.rpc("has_profile");
    if (eligibilityError || !eligible)
      return json({ error: "A confirmed profile is required" }, 403);
    // Reject oversized bodies before buffering; callers send multipart with known length where supported.
    const length = Number(req.headers.get("content-length") || 0);
    if (length > 6 * 1024 * 1024)
      return json({ error: "Photo too large" }, 413);
    const reader = req.body?.getReader();
    if (!reader) return json({ error: "Missing upload" }, 400);
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > 6 * 1024 * 1024) {
        await reader.cancel();
        return json({ error: "Photo too large" }, 413);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    const form = await new Request(req.url, {
      method: "POST",
      headers: { "content-type": req.headers.get("content-type") || "" },
      body: bytes,
    }).formData();
    const listing = String(form.get("listing_id")),
      requestId = String(form.get("request_id"));
    const uuid = /^[0-9a-f-]{36}$/i;
    if (!uuid.test(listing) || !uuid.test(requestId))
      return json({ error: "Invalid upload identifiers" }, 400);
    const { data: owned, error: ownedError } = await userClient
      .from("housing_listings")
      .select("id")
      .eq("id", listing)
      .eq("owner_id", user.id)
      .single();
    if (ownedError || !owned)
      return json({ error: "Listing unavailable" }, 403);
    const admin = createClient(
      url,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    if (form.get("action") === "delete") {
      const { data: image, error: e } = await admin
        .from("listing_images")
        .select("*")
        .eq("id", requestId)
        .eq("listing_id", listing)
        .single();
      if (e || !image) return json({ error: "Photo unavailable" }, 404);
      const { error: storageError } = await admin.storage
        .from("listing-photos")
        .remove([image.storage_path]);
      if (storageError) throw storageError;
      const { error: deleteError } = await admin
        .from("listing_images")
        .delete()
        .eq("id", requestId);
      if (deleteError) throw deleteError;
      return json({ deleted: true });
    }
    const file = form.get("file");
    if (!(file instanceof File)) return json({ error: "Choose a photo" }, 400);
    const clean = await validateImage(
      new Uint8Array(await file.arrayBuffer()),
      file.type,
    );
    const { data: reservation, error: reserveError } = await admin.rpc(
      "reserve_listing_image",
      { owner: user.id, listing, request_id: requestId },
    );
    if (reserveError) throw reserveError;
    if (reservation.ready) return json({ imageId: reservation.id });
    const { error: uploadError } = await admin.storage
      .from("listing-photos")
      .upload(reservation.storage_path, clean.bytes, {
        contentType: clean.type,
        upsert: false,
      });
    if (uploadError) {
      const { data: existing } = await admin.storage
        .from("listing-photos")
        .list(user.id + "/" + listing, { search: requestId + ".jpg" });
      if (
        !existing?.some((x: { name: string }) => x.name === requestId + ".jpg")
      ) {
        await admin
          .from("listing_images")
          .delete()
          .eq("id", requestId)
          .eq("ready", false);
        throw uploadError;
      }
    }
    const { error: readyError } = await admin
      .from("listing_images")
      .update({ ready: true })
      .eq("id", requestId);
    if (readyError) throw readyError;
    return json({ imageId: reservation.id });
  } catch (e) {
    return json(
      {
        error: e instanceof Error ? e.message : "Upload failed. Please retry.",
      },
      400,
    );
  }
});
