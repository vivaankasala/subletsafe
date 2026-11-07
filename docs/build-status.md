# Build handoff — November 7, 2026

## Delivered locally

- Responsive React/Vite/Router application with public home/safety pages and protected auth, profile, housing, roommate, messaging, moderation and account screens.
- Supabase migrations for invitation/member eligibility, owner-only edits, participant messaging, symmetric blocking, report/evidence handling, audited moderation, rate limits, image quotas/reordering and account-hide requests.
- Server upload function with bounded input, image decoding/re-encoding and private object storage.
- Explicit same-request upload retries, paginated message catch-up after reconnect and opt-in outcome recording.
- Setup guide, CI, browser smoke suite, operating runbook and release checklist.

## Verification performed

33 tests pass across nine suites. These cover validation, exact money/date handling, upload retry identity, real image decoding, message reconciliation, invitation/member eligibility, RLS, cross-user writes, thread/message idempotency, message rate limits, report privacy, moderator audit/evidence, deletion hiding, photo quota and reorder authorization. The embedded PostgreSQL harness simulates both Supabase Auth/Storage schemas and broad API default grants; these migrations explicitly revoke and regrant permissions.

TypeScript compilation, ESLint and production build pass. A negative build check rejects a fake secret key before bundling. Public pages, desktop/390px mobile layout, mobile navigation, missing-config states and disabled unconfigured sign-in were checked through the Codex browser.

A fresh reviewer examined source. Findings about recipient eligibility, message gaps after reconnect, report-after-block, moderator evidence and photo retry duplication were fixed. Follow-up improvements attribute evidence to the correct participant and remove direct access to the internal eligibility lookup.

## Still unverified / not launched

No Supabase account/project has been connected and no live migrations have been applied. Hosted email confirmation/recovery/session expiry, Storage, Edge runtime, Realtime and the complete authenticated browser journey are not verified. The committed Playwright suite has not been executed locally; CI is configured to run it, but no remote CI run has occurred.

No public deployment, remote repository, student outreach, or live data deletion has occurred. Retention periods, permanent deletion, reviewed terms/privacy/community policies, operational contacts, backup/recovery and moderation coverage remain release gates. Photo cleanup scheduling and platform-level upload abuse controls still need operational configuration.

See README.md for setup and docs/release-checklist.md for the exact remaining checks. Keep the local feature branch until integration is verified; there is no existing base branch or remote to merge/push to.
