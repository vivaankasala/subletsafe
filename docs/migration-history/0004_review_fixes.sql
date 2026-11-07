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
