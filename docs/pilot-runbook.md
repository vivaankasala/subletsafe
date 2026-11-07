# Pilot operating runbook

Status: local implementation; no live pilot enabled.

## Before invitations

Name a primary operator and backup; agree hours of coverage and response expectations. Review user-facing community, privacy and terms documents with qualified advisers. Confirm institution domain configuration. Use development/test projects for test accounts; never email real users during automated tests. Public safety guidance in the app is not a completed legal policy.

## Reviewing reports

A confirmed user whose Auth UUID is in `moderator_roles` can open `/moderation`. Use Inspect target & reported evidence to open target/listing context and any message snapshots that the reporter explicitly chose to share. Every inspection is audited; moderators cannot browse arbitrary private chats. Each snapshot is attributed to the reporter or reported account. Record a reason when marking reviewing/resolved, restricting an account or removing a listing. Each action writes `moderation_actions` atomically. Reports are private to reporter and moderators. Do not paste private reports or chats into public issues.

Restrictions stop new publication and messaging; listings disappear via owner-state checks. Removed listing status is reserved for moderators. To reverse a restriction or removal, review evidence and record the reversal in the audit process through trusted administrative tooling; no browser profile update can grant or undo privileges. Operator tooling does not yet include automatic escalation, appeal handling or role management.

## Listing freshness

Search should show only active, current listings with an owner reconfirmation within 30 days. Owner can edit/re-save an active listing to reconfirm. End-date expiration is also evaluated on reads. Historic messages remain accessible to participants after a listing is unavailable.

## Photo operations

Uploads go through `upload-listing-image`. An owner is checked through the caller's JWT before the function uses its server-only role. A locked listing row allocates one of eight image slots. Request UUID supports backend retries; unfinished reservations can consume a slot until retried/cleaned. Photos are decoded with a 12-million-pixel cap and re-encoded to JPEG. Function runtime memory, decoder compatibility and storage policies must be verified against Supabase before release.

Daily during pilot: identify non-ready reservations older than one hour, ensure no upload is still in progress, remove their storage objects first and then their image records using trusted administrative tooling. Also reconcile objects with no image row. Do not delete recent uploads or any objects outside the listing-photos bucket. No scheduler has been enabled.

Signed photo URLs last 60 seconds. An issued URL may remain usable until it expires, even after a block/removal. Cached copies cannot be revoked from clients. Treat this as a disclosed access limit.

## Rate limits

Atomic database counters cap message writes at 20/minute, report submissions at 5/hour and listing writes at 10/minute per user. Old write-limit rows need periodic pruning after their windows end. Auth rate limiting and Edge Function global abuse protections are platform configuration gates; the photo count cap is not a complete upload abuse policy. Use Supabase Auth limits and function rate limiting before public growth.

## Recovery

Before migrations: record the target project and migration version; confirm backup availability and environment. Apply to staging first. Prefer reviewed forward fixes to destructive rollback. If data exposure is suspected, restrict affected entry points, revoke relevant server secrets if compromised, preserve evidence securely and follow the reviewed incident process. Restore testing and incident notification ownership remain launch prerequisites.

## Pilot measurements

Use a 14-day proposed observation window. Count completed profiles and real active listings; inquiries are distinct conversations with at least one message. Successful connection requires explicit participant follow-up, not an inferred chat event. `pilot_events` accepts identifiers and a small event allowlist only; no chat content or email. The conversation UI lets a participant explicitly record a successful connection. Treat this as self-reported, and follow up with participants rather than inferring a signed lease.
