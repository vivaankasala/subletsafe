import { it, expect } from "vitest";
import {
  coversDates,
  validateListing,
  dollarsToCents,
} from "../src/features/listings/validation";
it("requires full inclusive coverage across month boundaries", () => {
  const listing = { from: "2027-01-31", until: "2027-05-01" };
  expect(
    coversDates(listing, { from: "2027-01-31", until: "2027-05-01" }),
  ).toBe(true);
  expect(
    coversDates(listing, { from: "2027-01-30", until: "2027-02-01" }),
  ).toBe(false);
  expect(
    coversDates(listing, { from: "2027-05-01", until: "2027-05-02" }),
  ).toBe(false);
});
it("supports open bounds without admitting backwards intervals", () => {
  expect(
    coversDates(
      { from: "2027-01-01", until: null },
      { from: "2027-04-01", until: "2028-01-01" },
    ),
  ).toBe(true);
  expect(coversDates({ from: "2027-01-01", until: "2027-06-01" }, {})).toBe(
    true,
  );
  expect(
    coversDates(
      { from: "2027-01-01", until: null },
      { from: "2027-05-01", until: "2027-01-01" },
    ),
  ).toBe(false);
});
it("parses exact cents and rejects fractional cents", () => {
  expect(dollarsToCents("850.25")).toBe(85025);
  expect(() => dollarsToCents("1.001")).toThrow();
  expect(() => dollarsToCents("-1")).toThrow();
});
it("rejects malformed listing rent and dates", () =>
  expect(() => validateListing({ title: "Room", monthly_rent: -1 })).toThrow());
