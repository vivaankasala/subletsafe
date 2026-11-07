import { it, expect } from "vitest";
import { createPhotoUpload } from "../src/features/listings/photoUpload";
it("reuses its request ID after a lost upload response", async () => {
  const requests: string[] = [];
  let calls = 0;
  const upload = createPhotoUpload(
    "listing",
    new File(["photo"], "photo.jpg", { type: "image/jpeg" }),
    async (body) => {
      requests.push(String(body.get("request_id")));
      if (calls++ === 0) throw Error("Network lost");
    },
  );
  await expect(upload.send()).rejects.toThrow();
  await upload.send();
  expect(requests).toHaveLength(2);
  expect(requests[0]).toBe(requests[1]);
  expect(requests[0]).not.toBe("");
});
