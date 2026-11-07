import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { ArrowRight } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { campuses, getSupabase, errorMessage } from "../../lib/supabase";
import { validateProfile } from "./profile";
import { dollarsToCents } from "../listings/validation";
import { trackEvent } from "../../lib/events";
import { Notice } from "../../components/ui";
export function OnboardingPage() {
  const { profile, session, refresh } = useAuth();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false);
  const navigate = useNavigate();
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      const value = validateProfile({
        display_name: f.get("display_name"),
        university_id: f.get("university_id"),
        target_university_id: f.get("target_university_id"),
        bio: f.get("bio"),
        min_budget: f.get("min_budget")
          ? dollarsToCents(String(f.get("min_budget")))
          : null,
        max_budget: f.get("max_budget")
          ? dollarsToCents(String(f.get("max_budget")))
          : null,
        move_in_date: f.get("move_in_date"),
        move_out_date: f.get("move_out_date"),
        seeking_roommate: f.has("seeking_roommate"),
        cleanliness: f.get("cleanliness"),
        sleep_schedule: f.get("sleep_schedule"),
        pets_preference: f.get("pets_preference"),
        smoking_preference: f.get("smoking_preference"),
      });
      const db = getSupabase();
      const result = profile
        ? await db.from("profiles").update(value).eq("id", session!.user.id)
        : await db.from("profiles").insert({ ...value, id: session!.user.id });
      if (result.error) throw result.error;
      await refresh();
      await trackEvent({ event: "profile_completed", entity_id: null });
      setSaved(true);
      if (!profile) void navigate("/housing");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="narrow">
      <span className="eyebrow">MAKE YOURSELF AT HOME</span>
      <h1>{profile ? "Your profile" : "A little about you."}</h1>
      <p className="muted">
        Share what matters for your next home. Keep private contact details and
        exact addresses out of your bio.
      </p>
      <form className="panel form-grid" onSubmit={save}>
        <label className="span2">
          Display name
          <input
            name="display_name"
            defaultValue={profile?.display_name}
            maxLength={80}
            required
          />
        </label>
        <label>
          Your university
          <select name="university_id" defaultValue={profile?.university_id}>
            {campuses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Where you’re looking
          <select
            name="target_university_id"
            defaultValue={profile?.target_university_id}
          >
            {campuses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="span2">
          About you
          <textarea
            name="bio"
            maxLength={1000}
            rows={3}
            defaultValue={profile?.bio}
            placeholder="What would you like a future roommate to know?"
          />
        </label>
        <label>
          Minimum budget ($/month)
          <input
            name="min_budget"
            type="number"
            min="0"
            step="0.01"
            defaultValue={
              profile?.min_budget != null ? profile.min_budget / 100 : undefined
            }
          />
        </label>
        <label>
          Maximum budget ($/month)
          <input
            name="max_budget"
            type="number"
            min="0"
            step="0.01"
            defaultValue={
              profile?.max_budget != null ? profile.max_budget / 100 : undefined
            }
          />
        </label>
        <label>
          Move-in date
          <input
            name="move_in_date"
            type="date"
            defaultValue={profile?.move_in_date || ""}
          />
        </label>
        <label>
          Move-out date
          <input
            name="move_out_date"
            type="date"
            defaultValue={profile?.move_out_date || ""}
          />
        </label>
        {(
          [
            {
              name: "cleanliness",
              label: "Cleanliness",
              options: [
                "Not specified",
                "Very tidy",
                "Generally tidy",
                "Relaxed",
              ],
            },
            {
              name: "sleep_schedule",
              label: "Sleep schedule",
              options: [
                "Not specified",
                "Early riser",
                "Night owl",
                "Flexible",
              ],
            },
            {
              name: "pets_preference",
              label: "Pets",
              options: ["Not specified", "Pet friendly", "No pets"],
            },
            {
              name: "smoking_preference",
              label: "Smoking",
              options: ["Not specified", "Smoke free", "Open to discussion"],
            },
          ] as const
        ).map((field) => (
          <label key={field.name}>
            {field.label}
            <select name={field.name} defaultValue={profile?.[field.name]}>
              {field.options.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
        ))}
        <label className="check span2">
          <input
            name="seeking_roommate"
            type="checkbox"
            defaultChecked={profile?.seeking_roommate}
          />
          Show my profile in roommate discovery
        </label>
        <p className="fineprint span2">
          Your profile is visible to confirmed university accounts. Your account
          email stays private. You can turn discovery off anytime.
        </p>
        {error && (
          <div className="span2">
            <Notice>{error}</Notice>
          </div>
        )}
        {saved && <Notice>Profile saved.</Notice>}
        <button className="button span2" disabled={busy}>
          {busy ? "Saving…" : "Save profile"}
          <ArrowRight size={16} />
        </button>
      </form>
    </div>
  );
}
