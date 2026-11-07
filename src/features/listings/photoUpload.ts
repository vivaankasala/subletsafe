export function createPhotoUpload(
  listingId: string,
  file: File,
  invoke: (body: FormData) => Promise<unknown>,
) {
  const id = crypto.randomUUID();
  return {
    id,
    file,
    async send() {
      const form = new FormData();
      form.set("listing_id", listingId);
      form.set("request_id", id);
      form.set("file", file);
      await invoke(form);
    },
  };
}
