import { it, expect } from "vitest";
import { mergeMessages } from "../src/features/messages/mergeMessages";
it("reconciles duplicate and out of order realtime/history events", () => {
  const a = { id: "a", created_at: "2027-01-01T10:00:00Z", content: "First" },
    b = { id: "b", created_at: "2027-01-01T11:00:00Z", content: "Second" };
  expect(mergeMessages([b], [a, b])).toEqual([a, b]);
  expect(mergeMessages([a, b], [a])).toEqual([a, b]);
});
