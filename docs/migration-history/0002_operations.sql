create function public.moderate_report(report uuid,action text,reason text) returns void language plpgsql security definer set search_path='' as $$
declare r public.reports;
begin
 if not public.is_moderator() then raise exception 'Moderator access required';end if;
 if length(trim(reason)) not between 1 and 1000 then raise exception 'Record a reason';end if;
 select * into r from public.reports where id=report for update;if r.id is null then raise exception 'Report not found';end if;
 if action='review' then update public.reports set status='reviewing' where id=report;
 elsif action='resolve' then update public.reports set status='resolved' where id=report;
 elsif action='remove_listing' and r.listing_id is not null then update public.housing_listings set status='removed' where id=r.listing_id;
 elsif action='restrict_user' and r.reported_user_id is not null then update public.profiles set restricted=true,seeking_roommate=false where id=r.reported_user_id;
 else raise exception 'Invalid action';end if;
 insert into public.moderation_actions(actor_id,report_id,action,reason) values(auth.uid(),report,action,trim(reason));
end;$$;
revoke all on function public.moderate_report(uuid,text,text) from public, anon, authenticated;
grant execute on function public.moderate_report(uuid,text,text) to authenticated;
create function public.request_deletion() returns void language plpgsql security definer set search_path='' as $$begin
 if auth.uid() is null then raise exception 'Sign in first';end if;
 insert into public.deletion_requests(user_id) values(auth.uid()) on conflict do nothing;
 update public.profiles set deleted_at=now(),seeking_roommate=false where id=auth.uid();
 -- Listing visibility already excludes deleted owners, preserving historical records.
end;$$;
revoke all on function public.request_deletion() from public, anon, authenticated;
grant execute on function public.request_deletion() to authenticated;
alter table public.listing_images add column ready boolean not null default false;
drop policy image_read on public.listing_images;
create policy image_read on public.listing_images for select to authenticated using(ready and public.listing_visible(listing_id));
-- Image reservations are service-only. The function rechecks the supplied owner's current eligibility.
create function public.reserve_listing_image(owner uuid,listing uuid,request_id uuid) returns public.listing_images language plpgsql security definer set search_path='' as $$
declare result public.listing_images; slot integer;
begin
 perform 1 from public.housing_listings where id=listing and owner_id=owner and status<>'removed' for update;if not found then raise exception 'Listing unavailable';end if;
 if not exists(select 1 from auth.users u join public.profiles p on p.id=u.id where u.id=owner and public.member_eligible(owner) and u.email_confirmed_at is not null and not p.restricted and p.deleted_at is null) then raise exception 'Owner unavailable';end if;
 select * into result from public.listing_images where id=request_id;if result.id is not null then if result.listing_id<>listing then raise exception 'Invalid retry';end if;return result;end if;
 select i into slot from generate_series(0,7) i where not exists(select 1 from public.listing_images where listing_id=listing and display_order=i) order by i limit 1;
 if slot is null then raise exception 'A listing can have at most 8 photos';end if;
 insert into public.listing_images(id,listing_id,storage_path,display_order) values(request_id,listing,owner::text||'/'||listing::text||'/'||request_id::text||'.jpg',slot) returning * into result;return result;
end;$$;
revoke all on function public.reserve_listing_image(uuid,uuid,uuid) from public, anon, authenticated;
-- Supabase service_role exists in hosted/local Supabase; PGlite tests create an equivalent role.
grant execute on function public.reserve_listing_image(uuid,uuid,uuid) to service_role;
grant all on public.listing_images to service_role;
-- Append-only events contain identifiers only, never chat text or email.
create table public.pilot_events(id uuid primary key default gen_random_uuid(),user_id uuid not null references profiles,event text not null check(event in ('profile_completed','listing_published','connection_confirmed')),entity_id uuid,created_at timestamptz not null default now());
alter table public.pilot_events enable row level security;
revoke all on public.pilot_events from anon,authenticated;
grant insert on public.pilot_events to authenticated;
create policy event_insert on public.pilot_events for insert to authenticated with check(user_id=auth.uid() and public.has_profile() and (event<>'connection_confirmed' or public.is_participant(entity_id)));
create unique index unique_pilot_event on public.pilot_events(user_id,event,entity_id) nulls not distinct;
