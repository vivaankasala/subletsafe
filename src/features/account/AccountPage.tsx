import { Link } from "react-router";
import { useState } from "react";
import { getSupabase, errorMessage } from "../../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import { useQuery } from "../../lib/useQuery";
import { Notice, AsyncButton } from "../../components/ui";
export function AccountPage() {
  const { session, refresh } = useAuth();
  const [error, setError] = useState("");
  const q = useQuery(async () => {
    const { data, error } = await getSupabase()
      .from("blocks")
      .select("blocked_id,created_at")
      .eq("blocker_id", session!.user.id);
    if (error) throw error;
    return data as { blocked_id: string; created_at: string }[];
  }, session!.user.id);
  return (
    <div className="narrow">
      <span className="eyebrow">YOU’RE IN CONTROL</span>
      <h1>Your account.</h1>
      <section className="panel">
        <h2>Profile & preferences</h2>
        <p>Update your campus, housing dates and discovery settings.</p>
        <Link className="button secondary" to="/profile">
          Edit your profile
        </Link>
      </section>
      <section className="panel">
        <h2>Blocked accounts</h2>
        {q.error && <Notice>{q.error}</Notice>}
        {!q.data?.length ? (
          <p className="muted">You haven’t blocked anyone.</p>
        ) : (
          q.data.map((b, i) => (
            <div className="account-row" key={b.blocked_id}>
              <span>
                Blocked account {i + 1}
                <small>
                  Since {new Date(b.created_at).toLocaleDateString()}
                </small>
              </span>
              <AsyncButton
                action={async () => {
                  const { error } = await getSupabase()
                    .from("blocks")
                    .delete()
                    .eq("blocker_id", session!.user.id)
                    .eq("blocked_id", b.blocked_id);
                  if (error) throw error;
                  q.reload();
                }}
              >
                Unblock
              </AsyncButton>
            </div>
          ))
        )}
      </section>
      <section className="panel">
        <h2>Hide your account & request deletion</h2>
        <p>
          This immediately removes your profile and spaces from discovery and
          stops new messages. The operator will handle data removal under the
          pilot retention policy. Existing conversation history is retained
          pending that review.
        </p>
        <button
          className="button danger"
          onClick={async () => {
            if (
              !window.confirm(
                "Hide your account and request data deletion? This will immediately stop discovery and contact.",
              )
            )
              return;
            try {
              const { error } = await getSupabase().rpc("request_deletion");
              if (error) throw error;
              await refresh();
              await getSupabase().auth.signOut();
            } catch (e) {
              setError(errorMessage(e));
            }
          }}
        >
          Request account deletion
        </button>
        {error && <Notice>{error}</Notice>}
      </section>
    </div>
  );
}
