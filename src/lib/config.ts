export function isPublicConfiguration(url: unknown, key: unknown): boolean {
  if (typeof url !== "string" || typeof key !== "string" || !url || !key)
    return false;
  try {
    const u = new URL(url);
    if (u.username || u.password) return false;
    if (
      u.protocol !== "https:" &&
      !(
        u.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname)
      )
    )
      return false;
    if (key.startsWith("sb_publishable_")) return key.length > 15;
    if (!key.startsWith("eyJ")) return false;
    const payload = JSON.parse(
      atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    return payload.role === "anon";
  } catch {
    return false;
  }
}
