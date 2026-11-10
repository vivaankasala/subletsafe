/** Route SDK HTTP through Python; managed Realtime and signed image delivery stay on Supabase. */
export function createBackendFetch(
  supabaseUrl: string,
  fetcher: typeof fetch = (input, init) => fetch(input, init),
): typeof fetch {
  const upstream = new URL(supabaseUrl);
  return async (input, init) => {
    const source = new URL(
      input instanceof Request ? input.url : String(input),
    );
    if (source.origin !== upstream.origin || source.username || source.password)
      throw Error("Unexpected backend destination.");
    const destination = `/api/supabase${source.pathname}${source.search}`;
    if (input instanceof Request) {
      const origin = globalThis.location?.origin || "http://localhost";
      return fetcher(new Request(new URL(destination, origin), input), init);
    }
    return fetcher(destination, init);
  };
}
