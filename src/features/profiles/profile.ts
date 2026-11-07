export function validDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export function safeReturnPath(value: unknown) {
  return typeof value === "string" &&
    /^\/(?!\/)/.test(value) &&
    !/[\\\r\n]/.test(value)
    ? value
    : "/housing";
}
export function memberGate(
  loading: boolean,
  signedIn: boolean,
  confirmed: boolean,
) {
  return loading
    ? "loading"
    : !signedIn
      ? "login"
      : !confirmed
        ? "confirm"
        : "allow";
}
export interface ProfileInput {
  display_name: string;
  university_id: string;
  target_university_id: string;
  bio: string;
  min_budget: number | null;
  max_budget: number | null;
  move_in_date: string | null;
  move_out_date: string | null;
  seeking_roommate: boolean;
  cleanliness: string;
  sleep_schedule: string;
  pets_preference: string;
  smoking_preference: string;
}
export interface Profile extends ProfileInput {
  id: string;
  restricted?: boolean;
  deleted_at?: string | null;
}
export function validateProfile(input: unknown): ProfileInput {
  const v = input as Partial<ProfileInput>;
  if (!v || typeof v !== "object") throw Error("Enter your profile details.");
  const name = v.display_name?.trim();
  if (!name || name.length > 80)
    throw Error("Enter a name between 1 and 80 characters.");
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (
    !uuid.test(v.university_id || "") ||
    !uuid.test(v.target_university_id || "")
  )
    throw Error("Select your universities.");
  for (const n of [v.min_budget, v.max_budget])
    if (n != null && (!Number.isSafeInteger(n) || n < 0 || n > 10000000))
      throw Error("Enter a valid budget.");
  if (
    v.min_budget != null &&
    v.max_budget != null &&
    v.min_budget > v.max_budget
  )
    throw Error("Minimum budget must not exceed maximum.");
  for (const d of [v.move_in_date, v.move_out_date])
    if (d && !validDate(d)) throw Error("Enter valid dates.");
  if (v.move_in_date && v.move_out_date && v.move_in_date > v.move_out_date)
    throw Error("Move-out must follow move-in.");
  if ((v.bio?.length || 0) > 1000)
    throw Error("Keep your bio under 1,000 characters.");
  return {
    display_name: name,
    university_id: v.university_id!,
    target_university_id: v.target_university_id!,
    bio: v.bio?.trim() || "",
    min_budget: v.min_budget ?? null,
    max_budget: v.max_budget ?? null,
    move_in_date: v.move_in_date || null,
    move_out_date: v.move_out_date || null,
    seeking_roommate: v.seeking_roommate === true,
    cleanliness: v.cleanliness || "Not specified",
    sleep_schedule: v.sleep_schedule || "Not specified",
    pets_preference: v.pets_preference || "Not specified",
    smoking_preference: v.smoking_preference || "Not specified",
  };
}
