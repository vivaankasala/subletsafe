import { useState } from "react";
import { getSupabase, errorMessage } from "../../lib/supabase";
import { useQuery } from "../../lib/useQuery";
import { Loading, Notice, Empty } from "../../components/ui";
interface Report {
  id: string;
  reason: string;
  details: string;
  status: string;
  created_at: string;
  reported_user_id: string | null;
  listing_id: string | null;
}
interface Detail {
  target: { id: string; name: string; restricted: boolean } | null;
  listing: {
    id: string;
    title: string;
    description: string;
    status: string;
    area: string;
  } | null;
  evidence: {
    message_id: string;
    sender_id: string;
    content: string;
    created_at: string;
  }[];
}
export function ModerationPage() {
  const [details, setDetails] = useState<Record<string, Detail>>({});
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const q = useQuery(async () => {
    const db = getSupabase();
    const { data: allowed, error: e } = await db.rpc("is_moderator");
    if (e) throw e;
    if (!allowed) throw Error("Moderator access required.");
    const { data, error } = await db
      .from("reports")
      .select("*")
      .neq("status", "resolved")
      .order("created_at")
      .limit(100);
    if (error) throw error;
    return data as Report[];
  }, "moderation");
  async function act(id: string, action: string) {
    const reason = window.prompt(
      "Record the reason for this moderation action:",
    );
    if (!reason?.trim()) return;
    setBusy(true);
    setError("");
    try {
      const { error } = await getSupabase().rpc("moderate_report", {
        report: id,
        action,
        reason,
      });
      if (error) throw error;
      q.reload();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <span className="eyebrow">PILOT OPERATIONS</span>
      <h1>Report review.</h1>
      {(q.error || error) && <Notice>{q.error || error}</Notice>}
      {q.loading ? (
        <Loading />
      ) : q.data?.length ? (
        <div className="report-list">
          {q.data.map((r) => (
            <article className="panel" key={r.id}>
              <span className="tag inline-tag">{r.status}</span>
              <h2>{r.reason}</h2>
              <p className="preserve">{r.details}</p>
              <p className="fineprint">
                {new Date(r.created_at).toLocaleString()}
              </p>
              <button
                className="plain"
                disabled={busy}
                onClick={async () => {
                  setError("");
                  try {
                    const { data, error } = await getSupabase().rpc(
                      "get_report_detail",
                      { report: r.id },
                    );
                    if (error) throw error;
                    setDetails((previous) => ({
                      ...previous,
                      [r.id]: data as Detail,
                    }));
                  } catch (e) {
                    setError(errorMessage(e));
                  }
                }}
              >
                Inspect target & reported evidence
              </button>
              {details[r.id] && (
                <div className="report-detail">
                  <p>
                    <strong>Reported account:</strong>{" "}
                    {details[r.id].target?.name || "No account target"}
                    {details[r.id].target?.restricted ? " (restricted)" : ""}
                  </p>
                  {details[r.id].listing && (
                    <>
                      <h3>{details[r.id].listing!.title}</h3>
                      <p>
                        {details[r.id].listing!.area} ·{" "}
                        {details[r.id].listing!.status}
                      </p>
                      <p className="preserve">
                        {details[r.id].listing!.description}
                      </p>
                    </>
                  )}
                  <h3>Reporter-shared messages</h3>
                  {details[r.id].evidence.length ? (
                    details[r.id].evidence.map((m) => (
                      <blockquote key={m.message_id}>
                        <strong className="small">
                          {m.sender_id === details[r.id].target?.id
                            ? "Reported account: " + details[r.id].target!.name
                            : "Reporter"}
                        </strong>
                        <p className="preserve">{m.content}</p>
                        <time>{new Date(m.created_at).toLocaleString()}</time>
                      </blockquote>
                    ))
                  ) : (
                    <p>
                      No message evidence was shared. Ask for context through
                      the approved operator process before acting on an
                      allegation.
                    </p>
                  )}
                </div>
              )}
              <div className="button-row">
                <button
                  disabled={busy}
                  className="button secondary"
                  onClick={() => void act(r.id, "review")}
                >
                  Mark reviewing
                </button>
                {r.listing_id && (
                  <button
                    disabled={busy}
                    className="button secondary"
                    onClick={() => void act(r.id, "remove_listing")}
                  >
                    Remove listing
                  </button>
                )}
                {r.reported_user_id && (
                  <button
                    disabled={busy}
                    className="button secondary"
                    onClick={() => void act(r.id, "restrict_user")}
                  >
                    Restrict user
                  </button>
                )}
                <button
                  disabled={busy}
                  className="button"
                  onClick={() => void act(r.id, "resolve")}
                >
                  Resolve
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        !q.error && (
          <Empty title="The queue is clear.">
            No open reports need review.
          </Empty>
        )
      )}
    </>
  );
}
