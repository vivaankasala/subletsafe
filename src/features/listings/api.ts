import { getSupabase } from "../../lib/supabase";
import { validateListing, type ListingInput, type Listing } from "./validation";
export interface ListingFilters {
  campus: string;
  maxRentCents?: number;
  propertyType?: string;
  from?: string;
  until?: string;
}
export async function searchListings(
  filters: ListingFilters,
  page = 0,
): Promise<Listing[]> {
  let q = getSupabase()
    .from("housing_listings")
    .select("*")
    .eq("status", "active")
    .eq("university_id", filters.campus)
    .gte(
      "last_confirmed_at",
      new Date(Date.now() - 30 * 86400000).toISOString(),
    )
    .or(
      `available_until.is.null,available_until.gte.${new Date().toISOString().slice(0, 10)}`,
    )
    .order("created_at", { ascending: false })
    .order("id")
    .range(page * 12, page * 12 + 11);
  if (filters.maxRentCents != null)
    q = q.lte("monthly_rent", filters.maxRentCents);
  if (filters.propertyType) q = q.eq("property_type", filters.propertyType);
  if (filters.from) q = q.lte("available_from", filters.from);
  if (filters.until)
    q = q.or(`available_until.is.null,available_until.gte.${filters.until}`);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}
export async function saveListing(
  input: ListingInput,
  id?: string,
): Promise<Listing> {
  const db = getSupabase(),
    value = validateListing(input);
  const {
    data: { user },
    error: authError,
  } = await db.auth.getUser();
  if (authError || !user) throw authError || Error("Sign in first.");
  const q = id
    ? db.from("housing_listings").update(value).eq("id", id)
    : db.from("housing_listings").insert({ ...value, owner_id: user.id });
  const { data, error } = await q.select().single();
  if (error) throw error;
  return data;
}
