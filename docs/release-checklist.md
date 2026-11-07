# Invite-pilot release checklist

## Local evidence

- [x] React/TypeScript app compiles and static bundle builds.
- [x] Validation, image decoding, message reconciliation and embedded PostgreSQL authorization tests pass.
- [x] Public home, auth/setup states and navigation checked in the browser at desktop and 390px phone width.
- [ ] Run committed Playwright smoke tests in CI with installed browser.

## Actual Supabase verification — not yet run

- [ ] Apply migrations and seed to a disposable development project.
- [ ] Run actual email confirmation, login/logout, password recovery and expired-session flows.
- [ ] Onboard an MSU-affiliated user searching UMich without changing affiliation.
- [ ] Use two member accounts and an outsider to test direct REST/RPC access, not just UI guards.
- [ ] Publish, find, edit, reconfirm and deactivate a real test listing. Verify stale/expired inventory is hidden in search including from its owner.
- [ ] Deploy and type-check Edge upload function; verify JPEG/PNG/WebP, malformed/oversize files, quota races, retries and object cleanup on real Storage.
- [ ] Verify private photo access, signed URL expiration and draft/removed/block boundaries.
- [ ] Start a conversation twice; prove one thread and idempotent send behavior with concurrent requests.
- [ ] Verify Realtime privacy and reconnect reconciliation; block while subscribed and confirm no new messages can be written.
- [ ] Verify reports stay private; exercise moderator actions, audit rows and restriction enforcement.
- [ ] Request account deletion: profile/listings hidden immediately, no new writes, records retained pending approved policy.
- [ ] Test every member screen at phone and desktop widths with keyboard access, slow/offline networks, error and empty states.
- [ ] Verify nested routes refresh on deployed static host; correct Auth redirect and CORS origins.

## Implementation follow-ups before pilot

- [x] Add upload retry UX retaining the request ID.
- [ ] Automate operator upload cleanup and validate function abuse/rate limiting.
- [x] Add owner-only, transactional photo reordering.
- [x] Wire allowlisted pilot events and self-reported connection confirmation.
- [ ] Validate outcome measurement and follow-up in the real pilot.
- [ ] Add hosted-stack integration tests to CI; the current embedded test harness is not equivalent.
- [ ] Establish retention periods, permanent-deletion workflow, data export/contact route and operator recovery tests.

## Operating prerequisites

- [ ] Verify supported university domains and institute rules.
- [ ] Add intended test/pilot addresses to the private invite allowlist; verify an uninvited confirmed university account is denied.
- [ ] Name report owner, backup, coverage and escalation/appeal procedures.
- [ ] Publish reviewed terms, privacy policy and community standards; add contact details.
- [ ] Verify backup and recovery in the actual project.
- [ ] Define the observation window and measurement owner; recruit real supply with permission.

Do not describe the project as production-ready or launch-ready while these items remain open.
