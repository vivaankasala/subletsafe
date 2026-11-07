import { useRef, useState } from "react";
import { ImagePlus, House, Trash2, ArrowLeft, ArrowRight } from "lucide-react";
import { getSupabase, errorMessage } from "../../lib/supabase";
import { useQuery } from "../../lib/useQuery";
import { Notice } from "../../components/ui";
import { createPhotoUpload } from "./photoUpload";
export function ListingImages({
  listingId,
  editable = false,
  cover = false,
}: {
  listingId: string;
  editable?: boolean;
  cover?: boolean;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [retry, setRetry] = useState(false);
  const attempt = useRef<ReturnType<typeof createPhotoUpload> | null>(null);
  const q = useQuery(async () => {
    const db = getSupabase();
    const { data, error } = await db
      .from("listing_images")
      .select("*")
      .eq("listing_id", listingId)
      .order("display_order");
    if (error) throw error;
    return Promise.all(
      (data || []).map(async (image) => {
        const { data, error } = await db.storage
          .from("listing-photos")
          .createSignedUrl(image.storage_path, 60);
        if (error) throw error;
        return { ...image, url: data.signedUrl };
      }),
    );
  }, listingId);
  async function send() {
    if (!attempt.current) return;
    setBusy(true);
    setError("");
    try {
      await attempt.current.send();
      attempt.current = null;
      setRetry(false);
      q.reload();
    } catch (e) {
      setError(errorMessage(e));
      setRetry(true);
    } finally {
      setBusy(false);
    }
  }
  async function move(id: string, direction: number) {
    setBusy(true);
    setError("");
    try {
      const { error } = await getSupabase().rpc("move_listing_image", {
        image: id,
        direction,
      });
      if (error) throw error;
      q.reload();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  if (cover)
    return q.data?.[0] ? <img src={q.data[0].url} alt="Listing space" /> : null;
  return (
    <div className="image-section">
      {q.data?.length ? (
        <div className="photo-grid">
          {q.data.map((image, index) => (
            <div key={image.id}>
              <img src={image.url} alt="Listing space" />
              {editable && (
                <>
                  <div className="photo-order">
                    <button
                      className="icon-button"
                      aria-label="Move photo earlier"
                      disabled={busy || index === 0}
                      onClick={() => void move(image.id, -1)}
                    >
                      <ArrowLeft size={14} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label="Move photo later"
                      disabled={busy || index === q.data!.length - 1}
                      onClick={() => void move(image.id, 1)}
                    >
                      <ArrowRight size={14} />
                    </button>
                  </div>
                  <button
                    className="icon-button delete-photo"
                    aria-label="Remove photo"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      setError("");
                      try {
                        const form = new FormData();
                        form.set("listing_id", listingId);
                        form.set("request_id", image.id);
                        form.set("action", "delete");
                        const { error } = await getSupabase().functions.invoke(
                          "upload-listing-image",
                          { body: form },
                        );
                        if (error) throw error;
                        q.reload();
                      } catch (e) {
                        setError(errorMessage(e));
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="photo-placeholder">
          <House size={48} />
          <span>No photos added yet</span>
        </div>
      )}
      {editable && (
        <label className="upload-button">
          <ImagePlus size={18} />
          {busy ? "Uploading…" : "Add a photo"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy || retry || (q.data?.length || 0) >= 8}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setError("");
              if (file.size > 5 * 1024 * 1024) {
                setError("Photos must be 5 MB or smaller.");
                e.target.value = "";
                return;
              }
              attempt.current = createPhotoUpload(
                listingId,
                file,
                async (body) => {
                  const { error } = await getSupabase().functions.invoke(
                    "upload-listing-image",
                    { body },
                  );
                  if (error) throw error;
                },
              );
              e.target.value = "";
              void send();
            }}
          />
        </label>
      )}
      {retry && (
        <div className="button-row">
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => void send()}
          >
            Retry same upload
          </button>
          <button
            className="plain"
            disabled={busy}
            onClick={() => {
              attempt.current = null;
              setRetry(false);
              setError("");
              q.reload();
            }}
          >
            Cancel retry
          </button>
        </div>
      )}
      {editable && (
        <p className="fineprint">
          Up to 8 photos · JPEG, PNG or WebP · 5 MB each. Photos are re-encoded
          to remove original metadata.
        </p>
      )}
      {(error || q.error) && <Notice>{error || q.error}</Notice>}
    </div>
  );
}
