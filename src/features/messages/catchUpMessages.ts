export interface MessageCursor {
  id: string;
  created_at: string;
}
export async function catchUpMessages<T extends MessageCursor>(
  after: MessageCursor,
  fetchPage: (cursor: MessageCursor) => Promise<T[]>,
): Promise<T[]> {
  const result: T[] = [];
  let cursor = after;
  for (;;) {
    const page = await fetchPage(cursor);
    if (!page.length) return result;
    const last = page[page.length - 1];
    if (
      last.created_at < cursor.created_at ||
      (last.created_at === cursor.created_at && last.id <= cursor.id)
    )
      throw Error("Message history did not advance. Please reload.");
    result.push(...page);
    cursor = last;
    if (page.length < 50) return result;
  }
}
