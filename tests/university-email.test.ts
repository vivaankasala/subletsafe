import { it, expect } from "vitest";
import { normalizeUniversityEmail } from "../src/features/auth/universityEmail";
it("accepts exact campus domains and normalizes case and whitespace", () => {
  expect(normalizeUniversityEmail(" Kasalavi@MSU.EDU ")).toBe(
    "kasalavi@msu.edu",
  );
  expect(normalizeUniversityEmail("student+housing@umich.edu")).toBe(
    "student+housing@umich.edu",
  );
});
it.each([
  "student@gmail.com",
  "student@msu.edu.evil.com",
  "student@evilmsu.edu",
  "student@dept.umich.edu",
  "student@msu.edu@evil.com",
  "@msu.edu",
  "student name@msu.edu",
  "",
])("rejects ineligible or spoofed signup address %s", (email) =>
  expect(() => normalizeUniversityEmail(email)).toThrow(/msu.edu.*umich.edu/),
);
