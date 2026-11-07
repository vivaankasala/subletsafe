import { it, expect } from "vitest";
import { eventPayload } from "../src/lib/events";
const actor = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
it("only serializes allowed event identifiers, never extra text or email", () => {
  expect(
    eventPayload(
      {
        event: "profile_completed",
        entity_id: null,
        content: "private",
        email: "private@example.com",
      } as never,
      actor,
    ),
  ).toEqual({ user_id: actor, event: "profile_completed", entity_id: null });
  expect(() =>
    eventPayload({ event: "chat_content", entity_id: null } as never, actor),
  ).toThrow();
  expect(() =>
    eventPayload({ event: "connection_confirmed", entity_id: "bad" }, actor),
  ).toThrow();
});
