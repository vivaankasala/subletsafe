-- Enforce the signup boundary even when a caller bypasses the React app.
-- A private, invoker-rights trigger is used so enforcement is active immediately,
-- without relying on an additional dashboard hook configuration step.
create schema if not exists subletsafe_private;
revoke all on schema subletsafe_private from public,anon,authenticated;
create function subletsafe_private.enforce_university_auth_email() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.email is null or length(new.email)>254 or new.email !~* '^[^[:space:]@]+@(msu[.]edu|umich[.]edu)$' then
  raise exception using errcode='23514',message='Use an @msu.edu or @umich.edu university email to sign up.';
 end if;
 return new;
end;$$;
revoke all on function subletsafe_private.enforce_university_auth_email() from public,anon,authenticated;
grant usage on schema subletsafe_private to supabase_auth_admin;
grant execute on function subletsafe_private.enforce_university_auth_email() to supabase_auth_admin;
create trigger subletsafe_university_email_guard before insert or update of email on auth.users
for each row execute function subletsafe_private.enforce_university_auth_email();
