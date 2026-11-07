import { useState, type FormEvent } from "react";
import { Flag, Ban, X } from "lucide-react";
import { getSupabase, errorMessage } from "../../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import { Notice } from "../../components/ui";
export function SafetyControls({
  userId,
  listingId,
  conversationId,
}: {
  userId: string;
  listingId?: string;
  conversationId?: string;
}) {
  const { session, profile } = useAuth();
  const [open, setOpen] = useState(false),
    [blocked, setBlocked] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function report(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      let evidenceIds: string[] = [];
      if (conversationId && f.has("share_evidence")) {
        const { data, error } = await getSupabase()
          .from("messages")
          .select("id")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(20);
        if (error) throw error;
        evidenceIds = (data || []).map((m) => m.id);
      }
      const { error } = await getSupabase()
        .from("reports")
        .insert({
          reporter_id: session!.user.id,
          reported_user_id: userId,
          listing_id: listingId || null,
          conversation_id: conversationId || null,
          reason: f.get("reason"),
          details: f.get("details"),
          evidence_message_ids: evidenceIds,
        });
      if (error) throw error;
      setOpen(false);
      setMessage("Report submitted for review.");
    } catch (e) {
      setMessage(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="safety-controls">
      <div className="safety-actions">
        <button
          className="plain small"
          disabled={!profile}
          onClick={() => setOpen(true)}
        >
          <Flag size={13} />
          Report
        </button>
        <button
          className="plain small"
          disabled={!profile || busy || blocked}
          onClick={async () => {
            setBusy(true);
            try {
              const { error } = await getSupabase()
                .from("blocks")
                .insert({ blocker_id: session!.user.id, blocked_id: userId });
              if (error) throw error;
              setBlocked(true);
              setMessage(
                "Blocked. New messages and discovery between you are disabled. Manage blocks in Account.",
              );
            } catch (e) {
              setMessage(errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Ban size={13} />
          {blocked ? "Blocked" : "Block"}
        </button>
      </div>
      {message && <Notice>{message}</Notice>}
      {open && (
        <dialog open className="dialog" aria-labelledby={"report-" + userId}>
          <form onSubmit={report}>
            <div className="dialog-heading">
              <h2 id={"report-" + userId}>Report a concern</h2>
              <button
                className="icon-button"
                type="button"
                aria-label="Close report"
                onClick={() => setOpen(false)}
              >
                <X />
              </button>
            </div>
            <p className="muted">
              Reports are private and reviewed by the pilot operator.
            </p>
            <label>
              Reason
              <select name="reason">
                <option value="misleading">Misleading information</option>
                <option value="scam">Possible scam</option>
                <option value="harassment">Harassment</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label>
              What happened?
              <textarea name="details" rows={4} maxLength={3000} required />
            </label>
            {conversationId && (
              <label className="check">
                <input type="checkbox" name="share_evidence" />
                Share the latest 20 messages in this conversation with
                moderators as report evidence.
              </label>
            )}
            <button className="button full" disabled={busy}>
              Submit report
            </button>
          </form>
        </dialog>
      )}
    </div>
  );
}
