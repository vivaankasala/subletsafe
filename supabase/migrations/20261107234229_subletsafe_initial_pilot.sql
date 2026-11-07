-- User-scoped access is enforced here, independently of browser controls.
create table public.universities(id uuid primary key default gen_random_uuid(),name text not null,slug text unique not null,email_domains text[] not null,city text not null,is_active boolean not null default true);
create table public.profiles(id uuid primary key references auth.users on delete cascade,display_name text not null check(length(trim(display_name)) between 1 and 80),university_id uuid not null references universities,target_university_id uuid not null references universities,bio text not null default '' check(length(bio)<=1000),min_budget integer check(min_budget between 0 and 10000000),max_budget integer check(max_budget between 0 and 10000000),move_in_date date,move_out_date date,seeking_roommate boolean not null default false,cleanliness text not null default 'Not specified',sleep_schedule text not null default 'Not specified',pets_preference text not null default 'Not specified',smoking_preference text not null default 'Not specified',restricted boolean not null default false,deleted_at timestamptz,created_at timestamptz not null default now(),check(min_budget<=max_budget),check(move_in_date<=move_out_date));
create table public.moderator_roles(user_id uuid primary key references auth.users on delete cascade);
create table public.blocks(blocker_id uuid references auth.users on delete cascade,blocked_id uuid references auth.users on delete cascade,created_at timestamptz not null default now(),primary key(blocker_id,blocked_id),check(blocker_id<>blocked_id));
create table public.housing_listings(id uuid primary key default gen_random_uuid(),owner_id uuid not null references profiles,university_id uuid not null references universities,title text not null check(length(trim(title)) between 1 and 120),description text not null check(length(trim(description)) between 1 and 5000),monthly_rent integer not null check(monthly_rent between 0 and 10000000),approximate_location text not null check(length(approximate_location) between 1 and 120),property_type text not null check(property_type in ('room','apartment','house','studio')),available_from date not null,available_until date,bedrooms integer not null default 1 check(bedrooms between 0 and 20),bathrooms numeric(3,1) not null default 1 check(bathrooms between 0 and 20),status text not null default 'draft' check(status in ('draft','active','unavailable','expired','removed')),last_confirmed_at timestamptz not null default now(),created_at timestamptz not null default now(),check(available_from<=available_until));
create index listings_search on housing_listings(university_id,status,monthly_rent,available_from);
create table public.conversations(id uuid primary key default gen_random_uuid(),user_a uuid not null references profiles,user_b uuid not null references profiles,context_type text not null check(context_type in ('profile','listing')),context_id uuid not null,created_at timestamptz not null default now(),check(user_a<user_b),unique(user_a,user_b,context_type,context_id));
create table public.messages(id uuid primary key default gen_random_uuid(),conversation_id uuid not null references conversations,sender_id uuid not null references profiles,client_request_id uuid not null,content text not null check(length(trim(content)) between 1 and 2000),created_at timestamptz not null default now(),unique(sender_id,client_request_id));
create index message_history on messages(conversation_id,created_at,id);
create table public.reports(id uuid primary key default gen_random_uuid(),reporter_id uuid not null references profiles,reported_user_id uuid references profiles,listing_id uuid references housing_listings,conversation_id uuid references conversations,reason text not null check(reason in ('misleading','scam','harassment','other')),details text not null check(length(details) between 1 and 3000),status text not null default 'open' check(status in ('open','reviewing','resolved')),created_at timestamptz not null default now(),check(reported_user_id is not null or listing_id is not null));
create table public.moderation_actions(id uuid primary key default gen_random_uuid(),actor_id uuid not null references auth.users,report_id uuid not null references reports,action text not null,reason text not null,created_at timestamptz not null default now());
create table public.write_limits(user_id uuid not null references auth.users,kind text not null,window_start timestamptz not null,count integer not null,primary key(user_id,kind,window_start));
create table public.listing_images(id uuid primary key default gen_random_uuid(),listing_id uuid not null references housing_listings on delete cascade,storage_path text unique not null,display_order integer not null check(display_order between 0 and 7),created_at timestamptz not null default now(),unique(listing_id,display_order));
create table public.deletion_requests(user_id uuid primary key references auth.users,requested_at timestamptz not null default now());

create function public.member_eligible(member uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from auth.users u where u.id=member and u.email_confirmed_at is not null and exists(select 1 from public.universities v where v.is_active and lower(split_part(u.email,'@',2))=any(v.email_domains)));$$;
create function public.is_confirmed_member() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null and exists(select 1 from public.universities v where v.is_active and lower(split_part(u.email,'@',2))=any(v.email_domains))) and not exists(select 1 from public.profiles p where p.id=auth.uid() and (p.restricted or p.deleted_at is not null));$$;
create function public.is_moderator() returns boolean language sql stable security definer set search_path='' as $$select public.is_confirmed_member() and exists(select 1 from public.moderator_roles where user_id=auth.uid());$$;
create function public.is_blocked(a uuid,b uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.blocks where (blocker_id=a and blocked_id=b) or (blocker_id=b and blocked_id=a));$$;
create function public.blocked_with_me(other_user uuid) returns boolean language sql stable security definer set search_path='' as $$select public.is_blocked(auth.uid(),other_user);$$;
create function public.has_profile() returns boolean language sql stable security definer set search_path='' as $$select public.is_confirmed_member() and exists(select 1 from public.profiles where id=auth.uid() and not restricted and deleted_at is null and (not seeking_roommate or public.is_confirmed_member()));$$;
create function public.is_participant(thread uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.conversations where id=thread and auth.uid() in (user_a,user_b));$$;
create function public.listing_visible(listing uuid) returns boolean language sql stable security definer set search_path='' as $$select public.is_confirmed_member() and exists(select 1 from public.housing_listings l join public.profiles p on p.id=l.owner_id where l.id=listing and public.member_eligible(p.id) and not p.restricted and p.deleted_at is null and not public.is_blocked(auth.uid(),l.owner_id) and (l.owner_id=auth.uid() or (l.status='active' and (l.available_until is null or l.available_until>=current_date) and l.last_confirmed_at>=now()-interval '30 days')));$$;

-- Narrow helpers only: never expose arbitrary user lookup or role writes.
revoke all on function public.is_blocked(uuid,uuid) from public, anon, authenticated;
create function public.consume_limit(kind_arg text,maximum integer,window_seconds integer) returns void language plpgsql security definer set search_path='' as $$
declare amount integer; bucket timestamptz:=to_timestamp(floor(extract(epoch from now())/window_seconds)*window_seconds);
begin
 insert into public.write_limits values(auth.uid(),kind_arg,bucket,1) on conflict(user_id,kind,window_start) do update set count=public.write_limits.count+1 returning count into amount;
 if amount>maximum then raise exception 'Too many requests. Please try again later.';end if;
end;$$;
revoke all on function public.consume_limit(text,integer,integer) from public, anon, authenticated;
create function public.listing_guard() returns trigger language plpgsql security definer set search_path='' as $$begin
 if auth.uid() is not null then
 if not public.has_profile() then raise exception 'Complete a confirmed profile first';end if;
 if TG_OP='INSERT' and new.status='removed' then raise exception 'Reserved status';end if;
 if TG_OP='UPDATE' and not public.is_moderator() and (old.status='removed' or new.status='removed') then raise exception 'Reserved status';end if;
 perform public.consume_limit('listing',10,60);
 end if;
 if TG_OP='INSERT' or new.status='active' then new.last_confirmed_at:=now();end if;return new;
end;$$;
create trigger listing_guard before insert or update on public.housing_listings for each row execute function public.listing_guard();
create function public.report_guard() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.reporter_id<>auth.uid() or not public.has_profile() then raise exception 'Unauthorized';end if;
 if new.conversation_id is not null and not public.is_participant(new.conversation_id) then raise exception 'Unauthorized conversation';end if;
 if new.listing_id is not null and not exists(select 1 from public.housing_listings l where l.id=new.listing_id and (l.owner_id=auth.uid() or (l.status='active' and (l.available_until is null or l.available_until>=current_date) and l.last_confirmed_at>=now()-interval '30 days') or exists(select 1 from public.conversations c where c.context_type='listing' and c.context_id=l.id and auth.uid() in(c.user_a,c.user_b)))) then raise exception 'Listing unavailable';end if;
 perform public.consume_limit('report',5,3600);return new;end;$$;
create trigger report_guard before insert on public.reports for each row execute function public.report_guard();

create function public.start_conversation(recipient uuid,context_type text,context_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare thread uuid; me uuid:=auth.uid(); a uuid:=least(me,recipient);b uuid:=greatest(me,recipient);
begin
 if not public.has_profile() or me=recipient or public.is_blocked(me,recipient) then raise exception 'Contact unavailable';end if;
 if not exists(select 1 from public.profiles p where p.id=recipient and public.member_eligible(p.id) and not p.restricted and p.deleted_at is null) then raise exception 'Contact unavailable';end if;
 select c.id into thread from public.conversations c where c.user_a=a and c.user_b=b and c.context_type=start_conversation.context_type and c.context_id=start_conversation.context_id;
 if thread is not null then return thread;end if;
 if context_type='listing' then
 if not exists(select 1 from public.housing_listings l where l.id=context_id and l.owner_id=recipient and l.status='active' and public.listing_visible(l.id)) then raise exception 'Listing unavailable';end if;
 elsif context_type='profile' then
 if context_id<>recipient or not exists(select 1 from public.profiles p where p.id=recipient and p.seeking_roommate) then raise exception 'Profile unavailable';end if;
 else raise exception 'Invalid context';end if;
 insert into public.conversations(user_a,user_b,context_type,context_id) values(a,b,context_type,context_id) on conflict on constraint conversations_user_a_user_b_context_type_context_id_key do update set user_a=excluded.user_a returning id into thread;return thread;
end;$$;
create function public.send_message(conversation uuid,client_request_id uuid,body text) returns public.messages language plpgsql security definer set search_path='' as $$
declare c public.conversations; m public.messages;
begin
 select * into c from public.conversations where id=conversation;
 if not public.has_profile() or not public.is_participant(conversation) or public.is_blocked(c.user_a,c.user_b) or exists(select 1 from public.profiles where id in (c.user_a,c.user_b) and (restricted or deleted_at is not null)) then raise exception 'Messaging unavailable';end if;
 if length(trim(body)) not between 1 and 2000 then raise exception 'Message must be 1–2000 characters';end if;
 select * into m from public.messages where sender_id=auth.uid() and messages.client_request_id=send_message.client_request_id;
 if m.id is not null then if m.conversation_id<>conversation or m.content<>trim(body) then raise exception 'Retry does not match original message';end if;return m;end if;
 perform public.consume_limit('message',20,60);
 insert into public.messages(conversation_id,sender_id,client_request_id,content) values(conversation,auth.uid(),client_request_id,trim(body)) on conflict on constraint messages_sender_id_client_request_id_key do nothing returning * into m;
 if m.id is null then select * into m from public.messages where sender_id=auth.uid() and messages.client_request_id=send_message.client_request_id;end if;return m;
end;$$;

-- RLS is enabled even on tables that have no client grants.
DO $$declare t text;begin foreach t in array array['universities','profiles','moderator_roles','blocks','housing_listings','conversations','messages','reports','moderation_actions','write_limits','listing_images','deletion_requests'] loop execute format('alter table public.%I enable row level security',t);end loop;end$$;
revoke all on public.universities,public.profiles,public.moderator_roles,public.blocks,public.housing_listings,public.conversations,public.messages,public.reports,public.moderation_actions,public.write_limits,public.listing_images,public.deletion_requests from anon,authenticated;
grant usage on schema public to anon,authenticated;
grant select on universities to anon,authenticated;
create policy universities_read on universities for select using(is_active);
grant select,insert on profiles to authenticated;
grant update(display_name,university_id,target_university_id,bio,min_budget,max_budget,move_in_date,move_out_date,seeking_roommate,cleanliness,sleep_schedule,pets_preference,smoking_preference) on profiles to authenticated;
create policy profile_read on profiles for select to authenticated using(id=auth.uid() or (public.is_confirmed_member() and public.member_eligible(id) and deleted_at is null and not restricted and not public.blocked_with_me(id)));
create policy profile_insert on profiles for insert to authenticated with check(id=auth.uid() and not restricted and deleted_at is null and (not seeking_roommate or public.is_confirmed_member()));
create policy profile_update on profiles for update to authenticated using(id=auth.uid() and public.is_confirmed_member()) with check(id=auth.uid());
grant select,insert,delete on blocks to authenticated;
create policy block_owner on blocks to authenticated using(blocker_id=auth.uid()) with check(blocker_id=auth.uid() and public.has_profile());
grant select,insert on housing_listings to authenticated;
grant update(title,description,university_id,monthly_rent,approximate_location,property_type,available_from,available_until,bedrooms,bathrooms,status) on housing_listings to authenticated;
create policy listing_read on housing_listings for select to authenticated using((owner_id=auth.uid() and public.is_confirmed_member()) or public.listing_visible(id));
create policy listing_insert on housing_listings for insert to authenticated with check(owner_id=auth.uid() and public.has_profile());
create policy listing_update on housing_listings for update to authenticated using(owner_id=auth.uid() and public.has_profile()) with check(owner_id=auth.uid());
grant select on conversations,messages to authenticated;
create policy conversation_read on conversations for select to authenticated using(public.is_confirmed_member() and auth.uid() in(user_a,user_b));
create policy message_read on messages for select to authenticated using(public.is_confirmed_member() and public.is_participant(conversation_id));
grant select,insert on reports to authenticated;
create policy report_read on reports for select to authenticated using(reporter_id=auth.uid() or public.is_moderator());
create policy report_insert on reports for insert to authenticated with check(reporter_id=auth.uid() and status='open' and public.has_profile());
grant select on moderation_actions to authenticated;
create policy audit_read on moderation_actions for select to authenticated using(public.is_moderator());
grant select on listing_images to authenticated;
create policy image_read on listing_images for select to authenticated using(public.listing_visible(listing_id));
grant select,insert on deletion_requests to authenticated;
create policy deletion_owner on deletion_requests to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
revoke all on function public.start_conversation(uuid,text,uuid),public.send_message(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.start_conversation(uuid,text,uuid),public.send_message(uuid,uuid,text) to authenticated;
-- Trigger helpers must not be callable directly.
revoke all on function public.listing_guard(),public.report_guard() from public, anon, authenticated;

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

-- This migration needs the actual Supabase storage schema. Tests use a minimal stand-in.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('listing-photos','listing-photos',false,5242880,array['image/jpeg']) on conflict(id) do nothing;
create policy photo_read on storage.objects for select to authenticated using(bucket_id='listing-photos' and exists(select 1 from public.listing_images i where i.storage_path=name and i.ready and public.listing_visible(i.listing_id)));
-- No authenticated upload/update/delete policy: uploads go through authenticated byte-inspecting function.
DO $$begin if exists(select 1 from pg_publication where pubname='supabase_realtime') then alter publication supabase_realtime add table public.messages;end if;end$$;

-- Reorder only an owner's ready images, serializing with quota allocation.
alter table public.listing_images drop constraint listing_images_listing_id_display_order_key;
alter table public.listing_images add constraint listing_images_listing_id_display_order_key unique(listing_id,display_order) deferrable initially immediate;
create function public.move_listing_image(image uuid,direction integer) returns void language plpgsql security definer set search_path='' as $$
declare selected public.listing_images;neighbor public.listing_images;
begin
 if not public.has_profile() or direction not in(-1,1) then raise exception 'Unauthorized reorder';end if;
 select * into selected from public.listing_images where id=image and ready;if selected.id is null then raise exception 'Photo unavailable';end if;
 perform 1 from public.housing_listings where id=selected.listing_id and owner_id=auth.uid() and status<>'removed' for update;if not found then raise exception 'Only the owner can reorder';end if;
 -- Reload after taking the common listing lock.
 select * into selected from public.listing_images where id=image and ready;
 if direction=-1 then select * into neighbor from public.listing_images where listing_id=selected.listing_id and ready and display_order<selected.display_order order by display_order desc limit 1;
 else select * into neighbor from public.listing_images where listing_id=selected.listing_id and ready and display_order>selected.display_order order by display_order limit 1;end if;
 if neighbor.id is null then return;end if;
 set constraints public.listing_images_listing_id_display_order_key deferred;
 update public.listing_images set display_order=case when id=selected.id then neighbor.display_order else selected.display_order end where id in(selected.id,neighbor.id);
 set constraints public.listing_images_listing_id_display_order_key immediate;
end;$$;
revoke all on function public.move_listing_image(uuid,integer) from public, anon, authenticated;
grant execute on function public.move_listing_image(uuid,integer) to authenticated;

-- Reporters may explicitly attach at most 20 messages they are entitled to read.
-- Moderators receive only that snapshot, never general access to conversation history.
alter table public.reports add column evidence_message_ids uuid[] not null default '{}' check(cardinality(evidence_message_ids)<=20);
create table public.report_evidence(report_id uuid not null references public.reports,message_id uuid not null,sender_id uuid not null,content text not null,created_at timestamptz not null,primary key(report_id,message_id));
alter table public.report_evidence enable row level security;
revoke all on public.report_evidence from anon,authenticated;
create function public.snapshot_report_evidence() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if cardinality(new.evidence_message_ids)>0 then
 if new.conversation_id is null or not public.is_participant(new.conversation_id) then raise exception 'Conversation evidence unavailable';end if;
 if not exists(select 1 from public.conversations c where c.id=new.conversation_id and new.reported_user_id in(c.user_a,c.user_b) and new.reported_user_id<>auth.uid()) then raise exception 'Evidence must concern the reported participant';end if;
 if exists(select 1 from unnest(new.evidence_message_ids) selected where not exists(select 1 from public.messages m where m.id=selected and m.conversation_id=new.conversation_id)) then raise exception 'Evidence outside this conversation';end if;
 insert into public.report_evidence select new.id,m.id,m.sender_id,m.content,m.created_at from public.messages m where m.id=any(new.evidence_message_ids) and m.conversation_id=new.conversation_id;
 end if;return new;
end;$$;
revoke all on function public.snapshot_report_evidence() from public, anon, authenticated;
create trigger report_snapshot after insert on public.reports for each row execute function public.snapshot_report_evidence();
create function public.get_report_detail(report uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.reports;result jsonb;
begin
 if not public.is_moderator() then raise exception 'Moderator access required';end if;
 select * into r from public.reports where id=report;if r.id is null then raise exception 'Report unavailable';end if;
 select jsonb_build_object('report',to_jsonb(r),'target',(select jsonb_build_object('id',p.id,'name',p.display_name,'restricted',p.restricted) from public.profiles p where p.id=r.reported_user_id),'listing',(select jsonb_build_object('id',l.id,'title',l.title,'description',l.description,'status',l.status,'area',l.approximate_location) from public.housing_listings l where l.id=r.listing_id),'evidence',coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at,e.message_id) from public.report_evidence e where e.report_id=r.id),'[]'::jsonb)) into result;
 insert into public.moderation_actions(actor_id,report_id,action,reason) values(auth.uid(),report,'inspect','Opened reported evidence');return result;
end;$$;
revoke all on function public.get_report_detail(uuid) from public, anon, authenticated;
grant execute on function public.get_report_detail(uuid) to authenticated;
-- Internal Auth lookup is not an account-enumeration API.
revoke all on function public.member_eligible(uuid) from public, anon, authenticated;
create function public.eligible_profile(member uuid) returns boolean language sql stable security definer set search_path='' as $$select public.is_confirmed_member() and public.member_eligible(member);$$;
revoke all on function public.eligible_profile(uuid) from public, anon, authenticated;
grant execute on function public.eligible_profile(uuid) to authenticated;
drop policy profile_read on public.profiles;
create policy profile_read on public.profiles for select to authenticated using(id=auth.uid() or (public.is_confirmed_member() and public.eligible_profile(id) and deleted_at is null and not restricted and not public.blocked_with_me(id)));
drop policy event_insert on public.pilot_events;
create policy event_insert on public.pilot_events for insert to authenticated with check(user_id=auth.uid() and public.has_profile() and ((event='profile_completed' and entity_id is null) or (event='listing_published' and exists(select 1 from public.housing_listings l where l.id=entity_id and l.owner_id=auth.uid() and l.status='active')) or (event='connection_confirmed' and public.is_participant(entity_id))));

-- Keep development and initial recruitment closed to specifically invited addresses.
create table public.pilot_invites(email text primary key check(email=lower(trim(email))),created_at timestamptz not null default now());
alter table public.pilot_invites enable row level security;
revoke all on public.pilot_invites from public,anon,authenticated;
create or replace function public.member_eligible(member uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from auth.users u where u.id=member and u.email_confirmed_at is not null and exists(select 1 from public.pilot_invites i where i.email=lower(u.email)) and exists(select 1 from public.universities v where v.is_active and lower(split_part(u.email,'@',2))=any(v.email_domains)));$$;
revoke all on function public.member_eligible(uuid) from public,anon,authenticated;
create or replace function public.is_confirmed_member() returns boolean language sql stable security definer set search_path='' as $$select public.member_eligible(auth.uid()) and not exists(select 1 from public.profiles p where p.id=auth.uid() and (p.restricted or p.deleted_at is not null));$$;

insert into public.universities(id,name,slug,email_domains,city) values
('11111111-1111-4111-8111-111111111111','University of Michigan','umich',array['umich.edu'],'Ann Arbor'),
('22222222-2222-4222-8222-222222222222','Michigan State University','msu',array['msu.edu'],'East Lansing') on conflict(slug) do nothing;
