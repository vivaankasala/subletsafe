# University signup restriction and email diagnosis

Updated November 7, 2026.

## Implemented

Only exact msu.edu and umich.edu email domains can create new accounts. The signup form normalizes case/whitespace and rejects other domains before contacting Auth. A private invoker-rights trigger on auth.users rejects off-domain inserts and changes to account email even when callers bypass the frontend. Domain lookalikes, suffix attacks and subdomains are rejected. Existing accounts are not deleted or automatically confirmed. Pilot invitation and email confirmation remain separate requirements.

The server guard is active through hosted migration 20261107235509. It does not depend on an unconfigured Auth-hook dashboard switch. The trigger is limited to inserts and email-column changes, so ordinary session/password/confirmation updates are unaffected.

A Resend confirmation email button is available on signup. It makes a request only when the user clicks it; no resend was automatically initiated during this work. The success text no longer implies a fresh email must be sent to an already-confirmed account.

## Email finding

Auth logs recorded a confirmation email send to the supplied address. The account is already marked confirmed, and subsequent link opens were rejected as used/expired. This establishes that sending and confirmation occurred; it does not establish where the message appears in the user's mailbox or who/what followed the link. Sign in with the existing password rather than creating the account again.

Hosted settings were checked: email login enabled, signup enabled, mailer_autoconfirm=false. Email confirmation was not disabled or bypassed.

## Verification

47 local tests pass, including exact-domain validation, database-boundary rejection, Auth-service-role execution and preservation of confirmation updates. Production build/TypeScript and ESLint pass. A fresh reviewer found no domain bypass or deployment blocker.

Live database probes accepted an MSU address inside a rolled-back subtransaction, rejected an off-campus account and off-campus email change, and verified Auth service function/schema privileges. Zero probe accounts persisted; the original account remains confirmed. Full new-account browser registration was not performed using someone else's address.

The security advisor added no trigger/schema-specific finding. Its existing authenticated-definer warnings and intentional inaccessible-table notices remain documented in backend-status.md. It also reports that [leaked-password protection is disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), a separate hosted Auth setting not changed by this domain restriction.
