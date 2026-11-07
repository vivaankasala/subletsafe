# SubletSafe Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for native execution, or superpowers:subagent-driven-development if the user selects delegation. Steps use checkbox tracking.

**Goal:** Build a working, invite-only student housing and roommate pilot with private conversations and moderation.

**Architecture:** A React SPA uses Supabase Auth and user-scoped database/storage access protected by RLS. Transactional database RPCs create conversations and send messages; Edge Functions perform privileged moderation and inspect uploads. Realtime augments paginated message reads without changing authorization.

**Tech Stack:** React, Vite, React Router, TypeScript, Tailwind, Supabase, Vitest, Playwright. Verify supported package and runtime versions from official documentation before installation; commit a lockfile.

**Spec:** `docs/design.md`

## Global constraints

- Build in `work/subletsafe/` relative to this workspace. Paths below are relative to that application root.
- Real backend operations require Supabase configuration; never silently substitute fixtures. Fixture mode is an explicit development-only selection.
- Confirmed university accounts can browse and contact; minimum onboarding is required to publish or send messages.
- No exact residential address, public account email, payments, compatibility score or fabricated live inventory.
- Money uses integer USD cents; availability uses inclusive calendar dates. Housing dates must fully cover a requested interval.
- Uploads: JPEG/PNG/WebP, 5 MB maximum, 8 images per listing; verify bytes server-side and use private storage.
- Secrets never reach browser bundles or Git. Policies enforce access even when clients bypass the UI.
- Live invitations require verified university-domain configuration, policy review, retention decisions and a named moderation operator.

## Review focus

1. An expired session must stop protected reads and preserve a recoverable login path (Task 1).
2. Transfer students must be able to search another campus without changing affiliation (Task 1).
3. End-of-month dates and open-ended listing dates must obey inclusive interval rules (Task 2).
4. Double submissions and reconnects must not create duplicate threads or messages (Task 4).
5. Blocking after a realtime subscription starts must prevent new communication and discovery (Task 5).

## Delivery order

Complete and demonstrate each task before proceeding. The first demonstration is authentication and onboarding. Local preparation can continue without live credentials; hosted integration and live-policy validation cannot be declared complete until tested against Supabase.

### Task 1: Authenticated onboarding and private profile foundation

**Files:** Create `package.json`, `vite.config.ts`, `tsconfig.json`, `.env.example`, `.gitignore`, `README.md`, `src/main.tsx`, `src/app/router.tsx`, `src/lib/supabase.ts`, `src/features/auth/AuthProvider.tsx`, `src/features/auth/AuthPage.tsx`, `src/features/profiles/OnboardingPage.tsx`, `src/features/profiles/profile.ts`, `supabase/config.toml`, `supabase/migrations/0001_profiles.sql`, `supabase/seed.sql`, `tests/profile.test.ts`, `supabase/tests/profile_access.sql`, `tests/e2e/onboarding.spec.ts`, `.github/workflows/ci.yml`.

**Interfaces:** `getSupabase(): SupabaseClient` validates publishable environment configuration. `validateProfile(input: unknown): ProfileInput` accepts display name, affiliation university UUID, target university UUID, optional bio and intent. `useAuth(): {session: Session|null; loading: boolean}` wraps Supabase session lifecycle. Tables: `universities`, `profiles`, `private_accounts`, `roommate_preferences`; `is_confirmed_member(): boolean` derives confirmation and university email eligibility from trusted Auth data.

- [ ] Write profile tests: distinct affiliation/target allowed; blank name rejected; invalid budget/date bounds rejected; protected route waits for session resolution and redirects after expiry.
- [ ] Run `npm run test -- tests/profile.test.ts`; confirm the missing implementation fails before implementing behavior.
- [ ] Scaffold React/Vite/Router/TypeScript, define scripts (`dev`, `lint`, `typecheck`, `test`, `build`, `test:e2e`) and explicit missing-configuration screen. Add confirmation, login/logout and onboarding routes.
- [ ] Add migrations and seed both universities. Restrict own drafts to owner, member-visible fields to confirmed members, private account fields to owner. Do not allow client role or confirmation changes. Route guards supplement database policies.
- [ ] Implement AuthProvider subscription cleanup, confirmation return route and recoverable error states; validate redirect destinations as local paths.
- [ ] Run unit checks and build. With local Supabase available, run `supabase db reset` and `supabase test db`: anonymous/unconfirmed member reads denied; owner can edit self; another confirmed user cannot edit or read private account fields. Test transfer onboarding and expiry in Playwright.
- [ ] Document config, startup and observed test status. Review diff and commit this slice only if the project is in a suitable Git checkout.

### Task 2: Housing publishing and discovery

**Files:** Create `supabase/migrations/0002_listings.sql`, `src/features/listings/{types,validation,filters,api}.ts`, `src/features/listings/{MarketplacePage,ListingPage,ListingEditorPage}.tsx`, `tests/listings.test.ts`, `supabase/tests/listing_access.sql`, `tests/e2e/listings.spec.ts`.

**Interfaces:** `ListingFilters` contains campus UUID, optional maxRentCents, propertyType, from and until (ISO dates). `coversDates(listing: Availability, requested: Availability): boolean`; `searchListings(filters: ListingFilters, cursor?: string): Promise<ListingPageResult>`; `saveListing(input: ListingInput): Promise<Listing>` derives owner from session/database.

- [ ] Write tests for equal inclusive endpoints, month boundary, invalid intervals, either omitted bound, and listing full coverage versus partial overlap. Confirm red with `npm run test -- tests/listings.test.ts`.
- [ ] Add controlled listing states, nonnegative integer rents, date constraints, indexes and ownership policies. Active visibility additionally requires unexpired availability and confirmation within 30 days; do not rely solely on a scheduler.
- [ ] Implement editor, member marketplace, combined filters and detail route with URL-backed filters, pagination and loading/empty/error states. Enforce onboarding before publish; show freshness and approximate area only.
- [ ] Run unit tests and `supabase test db`: cross-owner writes denied, drafts private, active/expired/removed visibility correct. Browser-test publish → search → edit → deactivate, mobile layout and keyboard controls.
- [ ] Run lint/typecheck/build, review diff and record completion.

### Task 3: Secure listing images

**Files:** Create `supabase/migrations/0003_images.sql`, `supabase/functions/upload-listing-image/index.ts`, `supabase/functions/_shared/image-validation.ts`, `src/features/listings/ListingImages.tsx`, `supabase/functions/upload-listing-image/index.test.ts`, `supabase/tests/image_access.sql`.

**Interfaces:** Authenticated multipart upload endpoint accepts listing UUID and file; returns `{imageId: string}`. `validateImage(bytes: Uint8Array, claimedType: string): ValidatedImage` verifies decoded image format and size. `listing_images` stores generated private object path and display order.

- [ ] Write failing function tests: forged MIME, non-image bytes, >5 MB, eighth versus ninth image, another owner's listing and duplicate retry idempotency.
- [ ] Implement authenticated upload with server-side decode validation, atomic quota reservation and cleanup on failed storage writes. Generate paths; reject arbitrary client object attachments. Private delivery checks current listing visibility; use short-lived signed URLs and document their bounded revocation delay.
- [ ] Add owner remove/reorder controls and a documented abandoned-upload cleanup procedure; do not include images in public buckets.
- [ ] Run `deno test supabase/functions/`, storage/database authorization tests and browser upload/remove checks. Confirm draft files are unavailable to other users and failed uploads do not consume slots permanently.
- [ ] Run app checks, review diff and record completion.

### Task 4: Roommate discovery and private messaging

**Files:** Create `supabase/migrations/0004_conversations.sql`, `src/features/roommates/{RoommatesPage,RoommatePage}.tsx`, `src/features/messages/{api,mergeMessages}.ts`, `src/features/messages/{InboxPage,ConversationPage}.tsx`, `tests/messages.test.ts`, `supabase/tests/conversation_access.sql`, `tests/e2e/messages.spec.ts`.

**Interfaces:** SQL `start_conversation(recipient uuid, context_type text, context_id uuid) returns uuid`; `send_message(conversation uuid, client_request_id uuid, body text) returns messages`. Unique sender/request ID gives retry idempotency. `mergeMessages(previous: Message[], incoming: Message[]): Message[]` deduplicates IDs and sorts by timestamp then ID. Contexts are listing or profile; participants are immutable.

- [ ] Write failing tests for duplicate events, out-of-order messages, reconnect re-fetch and duplicate submissions. Database tests require only two intended members, reject spoofed senders and prevent outsider reads.
- [ ] Add roommate opt-in discovery by target campus, budget/date overlap and disclosed preferences. Hide opted-out profiles from discovery immediately.
- [ ] Implement atomic conversation RPC with normalized-pair/context uniqueness and valid recipient/context checks. Limit text to 2,000 characters. Keep existing history after listing deactivation or opt-out.
- [ ] Implement inbox, paginated history, authorized Realtime updates, unsubscribe on route/session change and history reconciliation on reconnect. Display send failures and support safe retry.
- [ ] Run unit/database tests and three-account browser checks; verify no private message content appears in analytics or application logs. Run standard app checks, review and record completion.

### Task 5: Blocking, reporting, moderation and abuse controls

**Files:** Create `supabase/migrations/0005_safety.sql`, `supabase/functions/moderate/index.ts`, `src/features/safety/{ReportDialog,BlockButton,ModerationPage}.tsx`, `supabase/tests/safety_access.sql`, `tests/e2e/safety.spec.ts`.

**Interfaces:** `blocks(blocker_id, blocked_id)`, `reports`, `moderation_actions`, server-controlled `moderator_roles`; `is_blocked(a uuid,b uuid): boolean`. Authenticated moderation endpoint accepts report ID, disposition and reason; authorized actions restrict accounts or remove listings and append an audit event.

- [ ] Write failing SQL tests for either-direction blocks, post-subscription blocking, forged moderator status, private reports, inaccessible conversation references and suspended account writes.
- [ ] Apply block restrictions to discovery, conversation creation and every message insert; retain participant history. Account restrictions prevent publish/contact immediately.
- [ ] Implement user reporting/blocking and moderator queue with server-authorized dispositions. Keep reporters' details private. Confirm audit entries cannot be changed by clients.
- [ ] Add database-backed per-user limits: 20 messages/minute, 5 reports/hour, 10 listing writes/minute. Use atomic counters and verify boundaries/concurrent requests; unavailable enforcement fails closed for writes.
- [ ] Run SQL/function tests and browser report → moderator action plus two-way blocking checks. Run app checks, review and record completion.

### Task 6: Pilot readiness and outcome measurement

**Files:** Create `src/features/account/AccountPage.tsx`, `supabase/functions/delete-account/index.ts`, `supabase/migrations/0006_pilot_operations.sql`, `src/lib/events.ts`, `docs/{pilot-runbook,release-checklist,retention-decisions}.md`, `tests/e2e/pilot.spec.ts`; modify `README.md` and CI.

**Interfaces:** `trackEvent(event: PilotEvent): Promise<void>` accepts allowlisted event names with campus/entity IDs, never message body/email. Confirmed outcomes are recorded explicitly, not inferred from chat activity. Deletion hides discovery immediately and applies approved retention rules; destructive deletion is unavailable until retention configuration is approved.

- [ ] Test events exclude text/email and duplicate inquiry events do not inflate unique-conversation counts. Test account restriction/deletion request immediately hides discovery without allowing unauthorized message erasure.
- [ ] Implement account controls, listing expiry/reconfirmation and outcome collection. Draft operational documentation covering retention decisions, deletion, reports, recovery, config and policy review; mark unresolved release gates plainly.
- [ ] Configure CI to run clean install, lint, types, unit tests, build and provisioned Supabase policy tests. Keep privileged credentials outside untrusted PR jobs. Document SPA hosting fallback and auth callback configuration.
- [ ] Run the full journey on mobile and desktop with two members plus an outsider. Include keyboard navigation, refresh on nested routes, auth recovery, empty inventory, failed upload, network loss and moderator restriction.
- [ ] Run all configured checks and inspect build for secret exposure. Produce a release report listing passed checks, actual environments tested and remaining blockers. No real student invitations until operating and policy gates are resolved.

## Self-review and execution

Coverage checked against the design: university/target distinction, private profiles, inclusive housing dates, all listing states, image validation, opted-in roommates, conversation uniqueness, Realtime recovery, RLS, blocks/reports, audit roles, rate limits, expiry, deletion gates and measurement each have an owning task. Server input validation lives in SQL constraints/RPCs and Edge Functions; frontend forms provide feedback only.

Recommendation: native execution in this chat, one task at a time, with review of the completed branch. Start Task 1 after this plan is reviewed. Do not create external projects or request secrets in chat; ask for configuration through environment settings when hosted verification is needed. Later tasks remain planned rather than represented as finished.


## Current execution status
Local implementation is available. See docs/build-status.md for verification and docs/release-checklist.md for outstanding live integration and operational gates. Task checkboxes remain open where their complete acceptance contract includes those unverified checks.
