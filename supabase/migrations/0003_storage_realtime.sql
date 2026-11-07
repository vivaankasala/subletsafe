-- This migration needs the actual Supabase storage schema. Tests use a minimal stand-in.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('listing-photos','listing-photos',false,5242880,array['image/jpeg']) on conflict(id) do nothing;
create policy photo_read on storage.objects for select to authenticated using(bucket_id='listing-photos' and exists(select 1 from public.listing_images i where i.storage_path=name and i.ready and public.listing_visible(i.listing_id)));
-- No authenticated upload/update/delete policy: uploads go through authenticated byte-inspecting function.
DO $$begin if exists(select 1 from pg_publication where pubname='supabase_realtime') then alter publication supabase_realtime add table public.messages;end if;end$$;
