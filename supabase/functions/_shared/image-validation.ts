import { Image } from "imagescript";
export async function validateImage(
  bytes: Uint8Array,
  claimedType: string,
): Promise<{ type: "image/jpeg"; bytes: Uint8Array }> {
  if (bytes.length > 5 * 1024 * 1024)
    throw Error("Photos must be 5 MB or smaller.");
  const png =
    bytes.length > 8 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n);
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp =
    bytes.length > 12 &&
    new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
    new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  if (!(
    (png && claimedType === "image/png") ||
    (jpeg && claimedType === "image/jpeg") ||
    (webp && claimedType === "image/webp")
  ))
    throw Error("Choose a valid JPEG, PNG or WebP photo.");
  const image = await Image.decode(bytes, { maxPixels: 12000000 });
  if (image.width > 4096 || image.height > 4096)
    image.resize(Math.min(2048, image.width), Image.RESIZE_AUTO);
  return { type: "image/jpeg", bytes: await image.encodeJPEG({ quality: 85 }) };
}
