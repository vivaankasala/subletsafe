# Supabase connection and setup status

Updated November 7, 2026.

Project: uurgsyhfnggrnvxvgwub. The connected Supabase integration confirmed the target project and an empty public schema before applying setup.

## Completed and verified

- Initial migration and an anonymous-helper restriction migration applied successfully and recorded in hosted migration history.
- 15 public application tables; RLS enabled on all 15.
- University of Michigan and Michigan State University seeded.
- listing-photos storage bucket created as private.
- Messages included in the Realtime publication.
- Authenticated clients cannot update the profile restriction column; the internal member-eligibility lookup cannot be called anonymously.
- Unneeded anonymous helper function execution revoked.
- upload-listing-image version 1 deployed and ACTIVE. The function validates bearer credentials with Auth getUser before any privileged action. Gateway legacy-JWT verification is disabled because authentication is performed inside the handler.
- Live campus REST query returns both campuses.
- Live photo endpoint rejects unsigned requests with HTTP 401, permits the exact local preview preflight, and rejects unrelated browser origins with HTTP 403.

## Still required

- The user's chosen university email, to add to the private pilot allowlist. None has been added and no email has been sent.
- Auth dashboard URL configuration must allow http://127.0.0.1:5173/auth/callback and http://127.0.0.1:5173/auth/update-password; use http://127.0.0.1:5173 as the local Site URL. These settings have not been changed or verified through the available connector.
- Real confirmation/sign-in, full profile/listing/message journeys, positive upload tests and multi-account live authorization tests.
- Reviewed retention, privacy/community policies, moderation coverage and recovery remain pilot release gates.

## Security advisor review

The remaining [RLS without policies notices](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) concern four intentionally client-inaccessible tables: moderator_roles, pilot_invites, write_limits and report_evidence. No client policies or grants are intended; controlled server/definer operations access them.

The [authenticated SECURITY DEFINER notices](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) concern intentionally callable, permission-checking application RPCs and RLS helpers. Their execution surface and authorization checks were reviewed; the local regression suite exercises their boundaries. These notices are not a claim of a clean independent security audit. No anonymous SECURITY DEFINER warnings remain after revocation.

Local files now use timestamped migration names aligned to the actual hosted history. Earlier drafts are retained under docs/migration-history and must not be applied again. Do not rerun the initial setup script against this configured project.
