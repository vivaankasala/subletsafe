import { it, expect } from "vitest";
import { allowedOrigin } from "../supabase/functions/_shared/cors";
it("permits both local preview origins but rejects unrelated sites", () => {
  expect(allowedOrigin("http://127.0.0.1:5173")).toBe("http://127.0.0.1:5173");
  expect(allowedOrigin("http://localhost:5173")).toBe("http://localhost:5173");
  expect(allowedOrigin("https://evil.example")).toBeNull();
});
it("limits a deployed app to the explicit configured origin", () => {
  expect(
    allowedOrigin("http://localhost:5173", "https://subletsafe.example"),
  ).toBeNull();
  expect(
    allowedOrigin("https://subletsafe.example", "https://subletsafe.example"),
  ).toBe("https://subletsafe.example");
});
