import { getSupabase } from "./supabase";
export interface PilotEvent {
  event: "profile_completed" | "listing_published" | "connection_confirmed";
  entity_id: string | null;
}
export function eventPayload(value: PilotEvent, actor: string) {
  if (
    ![
      "profile_completed",
      "listing_published",
      "connection_confirmed",
    ].includes(value.event)
  )
    throw Error("Unsupported event");
  if (
    value.event !== "profile_completed" &&
    !/^[a-f0-9-]{36}$/i.test(value.entity_id || "")
  )
    throw Error("A valid event target is required");
  return {
    user_id: actor,
    event: value.event,
    entity_id: value.event === "profile_completed" ? null : value.entity_id,
  };
}
export async function trackEvent(value: PilotEvent) {
  const db = getSupabase();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) throw error || Error("Sign in first");
  const { error: e } = await db
    .from("pilot_events")
    .insert(eventPayload(value, user.id));
  if (e && e.code !== "23505") throw e;
}
