import { it, expect } from "vitest";
import { catchUpMessages } from "../src/features/messages/catchUpMessages";
it("pages through more than fifty missed messages without a gap", async () => {
  const source = Array.from({ length: 120 }, (_, i) => ({
    id: String(i + 1).padStart(3, "0"),
    created_at: "2027-01-01T10:00:00Z",
  }));
  const result = await catchUpMessages(
    { id: "000", created_at: "2027-01-01T10:00:00Z" },
    async (cursor) => source.filter((m) => m.id > cursor.id).slice(0, 50),
  );
  expect(result).toHaveLength(120);
  expect(result[0].id).toBe("001");
  expect(result[119].id).toBe("120");
});
