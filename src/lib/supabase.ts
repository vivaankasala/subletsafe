import { isPublicConfiguration } from "./config";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
export const configured = isPublicConfiguration(url, key);
let client: SupabaseClient | null = null;
export function getSupabase() {
  if (!configured)
    throw Error(
      "Supabase is not connected. Add the project URL and publishable key to .env.local.",
    );
  return (client ??= createClient(url!, key!));
}
export function money(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
export const campuses = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "University of Michigan",
    short: "UMich",
    city: "Ann Arbor",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Michigan State University",
    short: "MSU",
    city: "East Lansing",
  },
];
export function errorMessage(e: unknown) {
  return e instanceof Error
    ? e.message
    : typeof e === "object" && e && "message" in e
      ? String(e.message)
      : "Something went wrong. Please try again.";
}
