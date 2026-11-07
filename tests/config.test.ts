import { it, expect } from "vitest";
import { isPublicConfiguration } from "../src/lib/config";
const jwt = (role: string) =>
  "eyJhbGciOiJIUzI1NiJ9." +
  Buffer.from(JSON.stringify({ role })).toString("base64url") +
  ".signature";
it("accepts only publishable or anonymous keys and rejects service secrets", () => {
  expect(
    isPublicConfiguration(
      "https://example.supabase.co",
      "sb_publishable_example",
    ),
  ).toBe(true);
  expect(isPublicConfiguration("http://127.0.0.1:54321", jwt("anon"))).toBe(
    true,
  );
  expect(
    isPublicConfiguration("https://example.supabase.co", jwt("service_role")),
  ).toBe(false);
  expect(
    isPublicConfiguration("https://example.supabase.co", "sb_secret_bad"),
  ).toBe(false);
  expect(isPublicConfiguration("https://example.supabase.co", "random")).toBe(
    false,
  );
});
it("rejects malformed, credential-bearing and insecure remote URLs", () => {
  expect(isPublicConfiguration("invalid", "sb_publishable_example")).toBe(
    false,
  );
  expect(
    isPublicConfiguration("http://example.com", "sb_publishable_example"),
  ).toBe(false);
  expect(
    isPublicConfiguration(
      "https://user:password@example.com",
      "sb_publishable_example",
    ),
  ).toBe(false);
});
