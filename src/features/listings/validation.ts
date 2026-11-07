import { validDate } from "../profiles/profile";
export interface Availability {
  from?: string | null;
  until?: string | null;
}
export function coversDates(listing: Availability, requested: Availability) {
  if (requested.from && requested.until && requested.from > requested.until)
    return false;
  return (
    (!requested.from || !listing.from || listing.from <= requested.from) &&
    (!requested.until || !listing.until || listing.until >= requested.until)
  );
}
export function dollarsToCents(value: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim()))
    throw Error("Enter a positive amount with at most two decimals.");
  const [whole, fraction = ""] = value.trim().split(".");
  const n = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(n) || n > 10000000)
    throw Error("Amount is too large.");
  return n;
}
export interface ListingInput {
  title: string;
  description: string;
  university_id: string;
  monthly_rent: number;
  approximate_location: string;
  property_type: string;
  available_from: string;
  available_until: string | null;
  bedrooms: number;
  bathrooms: number;
  status: string;
}
export interface Listing extends ListingInput {
  id: string;
  owner_id: string;
  last_confirmed_at: string;
  created_at: string;
}
export function validateListing(input: unknown): ListingInput {
  const v = input as ListingInput;
  if (!v || !v.title?.trim() || v.title.length > 120)
    throw Error("Enter a title under 120 characters.");
  if (!v.description?.trim() || v.description.length > 5000)
    throw Error("Describe your space (up to 5,000 characters).");
  if (
    !Number.isSafeInteger(v.monthly_rent) ||
    v.monthly_rent < 0 ||
    v.monthly_rent > 10000000
  )
    throw Error("Enter valid monthly rent.");
  if (!v.university_id || !v.approximate_location?.trim())
    throw Error("Select a campus and approximate area.");
  if (!["room", "apartment", "house", "studio"].includes(v.property_type))
    throw Error("Select a property type.");
  if (
    !validDate(v.available_from) ||
    (v.available_until &&
      (!validDate(v.available_until) || v.available_until < v.available_from))
  )
    throw Error("Enter an ordered availability date range.");
  if (
    !Number.isInteger(v.bedrooms) ||
    v.bedrooms < 0 ||
    v.bedrooms > 20 ||
    v.bathrooms < 0 ||
    v.bathrooms > 20
  )
    throw Error("Check bedroom and bathroom counts.");
  return { ...v, title: v.title.trim(), description: v.description.trim() };
}
