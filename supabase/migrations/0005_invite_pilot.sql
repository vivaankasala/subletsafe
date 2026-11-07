-- Keep development and initial recruitment closed to specifically invited addresses.
create table public.pilot_invites(email text primary key check(email=lower(trim(email))),created_at timestamptz not null default now());
alter table public.pilot_invites enable row level security;
revoke all on public.pilot_invites from public,anon,authenticated;
create or replace function public.member_eligible(member uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from auth.users u where u.id=member and u.email_confirmed_at is not null and exists(select 1 from public.pilot_invites i where i.email=lower(u.email)) and exists(select 1 from public.universities v where v.is_active and lower(split_part(u.email,'@',2))=any(v.email_domains)));$$;
revoke all on function public.member_eligible(uuid) from public,anon,authenticated;
create or replace function public.is_confirmed_member() returns boolean language sql stable security definer set search_path='' as $$select public.member_eligible(auth.uid()) and not exists(select 1 from public.profiles p where p.id=auth.uid() and (p.restricted or p.deleted_at is not null));$$;
