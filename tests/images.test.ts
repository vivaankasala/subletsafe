import { it, expect } from "vitest";
import { validateImage } from "../supabase/functions/_shared/image-validation";
import { readFileSync } from "node:fs";
const png = new Uint8Array(readFileSync("tests/fixtures/pixel.png"));
it("rejects forged MIME and malformed image bytes", async () => {
  await expect(
    validateImage(new Uint8Array([1, 2, 3]), "image/png"),
  ).rejects.toThrow();
  await expect(validateImage(png, "text/html")).rejects.toThrow();
});
it("rejects oversize input before decoding", async () => {
  await expect(
    validateImage(new Uint8Array(5 * 1024 * 1024 + 1), "image/png"),
  ).rejects.toThrow(/5 MB/);
});
it("decodes a real image and strips original metadata by reencoding", async () => {
  const image = await validateImage(png, "image/png");
  expect(image.type).toBe("image/jpeg");
  expect(image.bytes.length).toBeGreaterThan(0);
});
