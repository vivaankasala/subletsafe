import { expect, it, vi } from "vitest";
import { createBackendFetch } from "../src/lib/backendFetch";

it("routes auth, data, storage and upload HTTP through Python, preserving request options", async () => {
  const remote = vi.fn<typeof fetch>().mockResolvedValue(new Response("{}"));
  const backend = createBackendFetch("https://project.supabase.co", remote);
  for (const path of [
    "/auth/v1/token?grant_type=refresh_token",
    "/rest/v1/profiles?select=*",
    "/storage/v1/object/sign/listing-photos/a.jpg",
    "/functions/v1/upload-listing-image",
  ]) {
    const options = {
      method: "POST",
      headers: { Authorization: "Bearer synthetic" },
      body: "{}",
      signal: new AbortController().signal,
    };
    await backend("https://project.supabase.co" + path, options);
    expect(remote).toHaveBeenLastCalledWith("/api/supabase" + path, options);
  }
});
it("rejects unexpected destinations without forwarding credentials", async () => {
  const remote = vi.fn<typeof fetch>();
  const backend = createBackendFetch("https://project.supabase.co", remote);
  await expect(backend("https://evil.example/auth/v1/user")).rejects.toThrow(
    "Unexpected backend destination",
  );
  await expect(
    backend("https://user:password@project.supabase.co/auth/v1/user"),
  ).rejects.toThrow();
  expect(remote).not.toHaveBeenCalled();
});
it("preserves Request body, headers, method and abort signal", async () => {
  const remote = vi.fn<typeof fetch>().mockResolvedValue(new Response("{}"));
  const backend = createBackendFetch("https://project.supabase.co", remote);
  const controller = new AbortController();
  await backend(
    new Request("https://project.supabase.co/rest/v1/blocks", {
      method: "POST",
      headers: { Authorization: "Bearer synthetic" },
      body: '{"blocked_id":"example"}',
      signal: controller.signal,
    }),
  );
  const forwarded = remote.mock.calls[0][0] as Request;
  expect(forwarded.url).toBe("http://localhost/api/supabase/rest/v1/blocks");
  expect(forwarded.headers.get("Authorization")).toBe("Bearer synthetic");
  expect(await forwarded.text()).toBe('{"blocked_id":"example"}');
  controller.abort();
  expect(forwarded.signal.aborted).toBe(true);
});
