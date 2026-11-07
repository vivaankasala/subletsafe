export function allowedOrigin(
  requested: string | null,
  configured?: string,
): string | null {
  const origins = configured
    ? [configured]
    : ["http://localhost:5173", "http://127.0.0.1:5173"];
  return requested
    ? origins.includes(requested)
      ? requested
      : null
    : origins[0];
}
