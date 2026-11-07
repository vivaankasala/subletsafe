export function mergeMessages<T extends { id: string; created_at: string }>(
  previous: T[],
  incoming: T[],
): T[] {
  return [
    ...new Map([...previous, ...incoming].map((x) => [x.id, x])).values(),
  ].sort(
    (a, b) =>
      a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
  );
}
