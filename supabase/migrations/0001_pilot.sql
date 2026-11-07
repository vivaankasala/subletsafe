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
