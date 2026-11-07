import { describe, it, expect } from "vitest";
import {
  validateProfile,
  safeReturnPath,
  memberGate,
} from "../src/features/profiles/profile";
const valid = {
  display_name: "  Alex  ",
  university_id: "11111111-1111-4111-8111-111111111111",
  target_university_id: "22222222-2222-4222-8222-222222222222",
  bio: "Transfer student",
  min_budget: 50000,
  max_budget: 100000,
  move_in_date: "2027-01-01",
  move_out_date: "2027-05-31",
  seeking_roommate: true,
};
describe("profile boundary", () => {
  it("allows transfer students and trims names", () =>
    expect(validateProfile(valid)).toMatchObject({
      display_name: "Alex",
      target_university_id: valid.target_university_id,
    }));
  it("rejects blank names", () =>
    expect(() => validateProfile({ ...valid, display_name: " " })).toThrow());
  it("rejects backwards budgets and impossible dates", () => {
    expect(() => validateProfile({ ...valid, min_budget: 110000 })).toThrow();
    expect(() =>
      validateProfile({ ...valid, move_in_date: "2027-02-30" }),
    ).toThrow();
  });
  it("rejects backwards availability", () =>
    expect(() =>
      validateProfile({ ...valid, move_out_date: "2026-01-01" }),
    ).toThrow());
  it("does not admit unconfirmed sessions and waits for resolution", () => {
    expect(memberGate(true, false, false)).toBe("loading");
    expect(memberGate(false, true, false)).toBe("confirm");
    expect(memberGate(false, false, false)).toBe("login");
    expect(memberGate(false, true, true)).toBe("allow");
  });
  it("only permits local return destinations", () => {
    expect(safeReturnPath("//evil.com")).toBe("/housing");
    expect(safeReturnPath("https://evil.com")).toBe("/housing");
    expect(safeReturnPath("/messages")).toBe("/messages");
    expect(safeReturnPath("/\\evil.com")).toBe("/housing");
  });
});
