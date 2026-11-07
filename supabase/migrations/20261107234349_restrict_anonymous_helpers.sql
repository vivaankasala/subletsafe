-- These helpers are used only by authenticated application requests and RLS.
revoke execute on function public.blocked_with_me(uuid),public.has_profile(),public.is_confirmed_member(),public.is_moderator(),public.is_participant(uuid),public.listing_visible(uuid) from public,anon,authenticated;
grant execute on function public.blocked_with_me(uuid),public.has_profile(),public.is_confirmed_member(),public.is_moderator(),public.is_participant(uuid),public.listing_visible(uuid) to authenticated;
