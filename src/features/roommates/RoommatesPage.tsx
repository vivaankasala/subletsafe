import { Link, useNavigate } from "react-router";
import { useState } from "react";
import { ArrowRight, Calendar, MapPin, Users } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { getSupabase, campuses, money } from "../../lib/supabase";
import { useQuery } from "../../lib/useQuery";
import type { Profile } from "../profiles/profile";
import { Empty, Loading, Notice, AsyncButton } from "../../components/ui";
import { SafetyControls } from "../safety/SafetyControls";
export function RoommatesPage() {
  const { profile, session } = useAuth(),
    navigate = useNavigate();
  const [campus, setCampus] = useState(
      profile?.target_university_id || campuses[0].id,
    ),
    [compatible, setCompatible] = useState(false),
    [page, setPage] = useState(0);
  const { data, error, loading } = useQuery(async () => {
    let q = getSupabase()
      .from("profiles")
      .select("*")
      .eq("seeking_roommate", true)
      .eq("target_university_id", campus)
      .neq("id", session!.user.id)
      .order("created_at", { ascending: false })
      .order("id")
      .range(page * 12, page * 12 + 11);
    if (compatible && profile) {
      if (profile.max_budget != null)
        q = q.or(`min_budget.is.null,min_budget.lte.${profile.max_budget}`);
      if (profile.min_budget != null)
        q = q.or(`max_budget.is.null,max_budget.gte.${profile.min_budget}`);
      if (profile.move_in_date)
        q = q.or(
          `move_out_date.is.null,move_out_date.gte.${profile.move_in_date}`,
        );
      if (profile.move_out_date)
        q = q.or(
          `move_in_date.is.null,move_in_date.lte.${profile.move_out_date}`,
        );
    }
    const { data, error } = await q;
    if (error) throw error;
    return data as Profile[];
  }, JSON.stringify({ campus, compatible, page, profile }));
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">MORE THAN A SHARED ADDRESS</span>
          <h1>Find your people.</h1>
          <p>A few shared habits. A conversation. A new beginning.</p>
        </div>
        <Link className="button secondary" to="/profile">
          Your roommate preferences
          <ArrowRight size={16} />
        </Link>
      </div>
      <div className="toolbar">
        <label>
          Looking around
          <select
            value={campus}
            onChange={(e) => {
              setCampus(e.target.value);
              setPage(0);
            }}
          >
            {campuses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={compatible}
            onChange={(e) => {
              setCompatible(e.target.checked);
              setPage(0);
            }}
            disabled={!profile}
          />
          Overlapping budget & dates
        </label>
      </div>
      <div className="soft-banner">
        <Users size={22} />
        <span>
          Compatibility starts with a conversation. These are self-described
          preferences, not a prediction that you’ll get along.
        </span>
      </div>
      {error && <Notice>{error}</Notice>}
      {loading ? (
        <Loading />
      ) : !data?.length ? (
        <Empty
          title="Your people are on their way."
          action={
            <Link className="button secondary" to="/profile">
              Set up your profile
            </Link>
          }
        >
          No active roommate profiles match yet. Opt into discovery and help
          your campus community get started.
        </Empty>
      ) : (
        <div className="roommate-grid">
          {data.map((p) => (
            <article className="roommate-card" key={p.id}>
              <div className="person-heading">
                <div className="avatar">{p.display_name.charAt(0)}</div>
                <div>
                  <h2>{p.display_name}</h2>
                  <span className="muted">
                    <MapPin size={13} />
                    {
                      campuses.find((c) => c.id === p.target_university_id)
                        ?.city
                    }
                  </span>
                </div>
              </div>
              <p className="person-bio">
                {p.bio || "Ready to meet a future roommate."}
              </p>
              <div className="preference-tags">
                {[
                  p.cleanliness,
                  p.sleep_schedule,
                  p.pets_preference,
                  p.smoking_preference,
                ]
                  .filter((x) => x !== "Not specified")
                  .map((v, i) => (
                    <span key={i}>{v}</span>
                  ))}
              </div>
              <p>
                <strong>
                  {p.min_budget != null ? money(p.min_budget) : "Flexible"} –{" "}
                  {p.max_budget != null ? money(p.max_budget) : "Flexible"}
                </strong>
                <small> / month</small>
              </p>
              <p className="muted small">
                <Calendar size={14} />
                {p.move_in_date || "Flexible start"} →{" "}
                {p.move_out_date || "Flexible end"}
              </p>
              {profile ? (
                <AsyncButton
                  className="button secondary full"
                  action={async () => {
                    const { data, error } = await getSupabase().rpc(
                      "start_conversation",
                      {
                        recipient: p.id,
                        context_type: "profile",
                        context_id: p.id,
                      },
                    );
                    if (error) throw error;
                    void navigate("/messages/" + data);
                  }}
                >
                  Say hello
                  <ArrowRight size={16} />
                </AsyncButton>
              ) : (
                <Link className="button secondary" to="/profile">
                  Complete profile to contact
                </Link>
              )}
              <SafetyControls userId={p.id} />
            </article>
          ))}
        </div>
      )}
      <div className="pagination">
        <button
          className="button secondary"
          disabled={page === 0}
          onClick={() => setPage((p) => p - 1)}
        >
          Previous
        </button>
        <span>Page {page + 1}</span>
        <button
          className="button secondary"
          disabled={!data || data.length < 12}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </div>
    </>
  );
}
