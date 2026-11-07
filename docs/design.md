# SubletSafe pilot design

Status: approved for implementation; local code built, hosted integration pending. November 7, 2026.

## Intent and approach

Build a responsive student housing and roommate application that helps a small university community discover relevant opportunities and start useful conversations. Success means real students making housing connections, rather than accumulating registrations.

The user accepted the recommended narrow working pilot. Alternatives considered: validation and a waitlist alone (fastest learning but no product connection journey), or the full PDF MVP including weighted compatibility scoring (broader functionality and longer implementation). The chosen approach delivers the connection journey and delays scoring until discovery establishes useful criteria.

UMich is the proposed first recruiting campus because the source problem is a transfer student's search there; this is an agent recommendation, not a confirmed user preference. MSU remains seeded and usable in the data model. Recruitment effort should concentrate on one campus until there is useful supply.

## Goals and exclusions

Deliver email confirmation, profiles, listing creation and discovery, roommate browsing, private one-to-one messaging, reporting, blocking, and authorized moderation. Support phones and desktop with useful loading, empty and failure states.

Exclude payments, deposits, leases, background checks, AI or numeric compatibility ranking, reviews, saved items, realtime typing/read receipts, broad notifications, native apps and automated growth campaigns. Avoid claims that university email confirmation proves identity, tenancy or listing legitimacy. Never make public inventory appear active through fabricated students or listings.

## Proposed implementation choices

Use React with Vite, React Router, TypeScript, Tailwind and accessible reusable components; Supabase PostgreSQL, Auth, Storage and Realtime. Deploy the frontend as a static application with SPA route fallback. Use Supabase Edge Functions for privileged server operations and version SQL migrations. Use database RLS and narrowly granted transactional RPCs for user-scoped operations. Supabase publishable configuration can reach the browser; secret and service-role keys cannot. Exact supported dependency versions will be checked at implementation time. Use one frontend and managed Supabase services, without a separate Express backend.

This workspace has no existing app. Create the local project under work/subletsafe after design approval. Keep development possible with clearly labeled fixture data when live credentials are unavailable; production must never silently fall back to fixtures. External accounts, deployments and repository publication depend on available access and explicit authorized scope.

## Users, affiliation and visibility

A user can seek housing, publish housing and seek roommates at the same time. Store university affiliation separately from target campus so an MSU student transferring to UMich can search there. Confirm control of an allowed university email through Auth; derive the confirmation label from authenticated server data rather than a writable profile field. Seed university names and email domains as configuration data requiring verification before live use.

Public visitors see general product information. Confirmed university accounts can browse active listings and opted-in roommate profiles, publish and message. An unconfirmed user can complete confirmation and manage their own draft onboarding but cannot browse member information or contact others. Affiliation does not limit target-campus selection.

Member-visible profile fields: display name, affiliation, target campus, short bio, optional image, budget/date preferences and voluntarily disclosed living preferences. Keep email and account identifiers out of profile responses. No exact address or private contact details are requested in pilot forms. Show approximate neighborhood only, and warn against posting sensitive information in free text.

## Core journeys

1. Sign up, confirm email, select affiliation and target campus, complete minimum profile, then choose housing, roommates or both.
2. Browse active listings by campus, maximum monthly rent, property type and dates. A date filter requires the listing to cover the complete requested interval; dates are inclusive calendar dates. Omitted bounds are unrestricted. Open-ended availability is permitted and explained. Inspect rent, dates, neighborhood, photos, description and freshness; contact the owner.
3. Create a draft listing, validate it, add photos, publish, edit, and mark unavailable. Only its owner can modify it; moderators can remove it. Listings expire after their available-until date, or 30 days without owner reconfirmation. Show last-confirmed date.
4. Opt into roommate discovery and browse students at the target campus by budget and date overlap. Show disclosed preferences directly without a score. Opting out immediately removes the profile from discovery.
5. Start or resume a conversation from a listing or roommate profile. Messages contain plain text only. Require a completed profile for contact. The sender is derived from the session. Restrict pilot conversations to two distinct participants and keep a unique normalized participant pair plus context so repeated clicks reuse a thread. A listing context must reference an active listing owned by the recipient. Profile context requires the recipient to be discoverable when starting the thread. Existing threads remain readable after listing deactivation or opting out.
6. Report a listing or user, optionally referencing an accessible conversation. Submit a category and details; reports are visible only to their reporter and authorized moderators. Block from a profile or conversation. Blocking in either direction prevents new contact, message writes, and discovery between the pair; participants retain access to existing history. Unblocking does not automatically send or restore messages.

## Data and authorization

Use UUID keys, foreign keys, calendar DATE for availability, TIMESTAMPTZ for activity, and integer cents for money. This deliberately differs from the source's NUMERIC suggestion while preserving exact arithmetic. All pilot prices use USD per month. Validate nonnegative prices and ordered budget/date bounds.

Core entities: universities, member profiles, roommate preferences, housing listings, listing images, conversations, conversation members, messages, blocks and reports. Keep discoverable profile data separate from private account data. Use explicit listing states draft, active, unavailable, expired and removed; report states open, reviewing and resolved. A listing-image record references an owner-controlled storage object and ordered position.

Enable RLS on all user/private tables. Express authorization in database policies and narrow transactional functions where multi-row creation is required. Check server input and permissions independently; browser validation is supplementary. No browser gets service-role credentials. Moderator privilege comes from server-controlled role data, cannot be set through profile edits, and must be checked for each moderation action. Record moderation actions with actor, target, reason and timestamp.

Only conversation members can read conversation history. A reporter may explicitly attach up to 20 messages to a report; moderators can inspect only those copied evidence snapshots through an audited report-detail operation. Message insertion requires membership, matching sender identity, an active account and no block in either direction. Enforce this in database authorization, including direct API access. Conversation membership cannot be changed by arbitrary client writes. Report creation verifies referenced targets; reporters cannot read other reports or change dispositions. Account restrictions immediately prevent publication and new messages.

Images accept JPEG, PNG or WebP, maximum 5 MB each and 8 per listing, with server-side file inspection, generated object names and ownership checks. Use private storage with access tied to listing visibility and signed delivery URLs; block arbitrary storage-path attachment. Draft images are owner-only. Delete abandoned uploads through a documented cleanup operation.

## Operations and release gates

Invite-only pilot launch requires a named moderation operator, a working report queue, documented escalation and takedown steps, agreed response coverage, and reviewed user-facing privacy/community guidance. These are release requirements; no legal compliance is asserted here. Avoid capturing message content in analytics or logs. Define retention and account-deletion handling before real participants are onboarded; deletion should hide listings/profiles and remove unnecessary personal data while preserving only explicitly justified report evidence under documented rules.

Use separate development and production configuration; keep secrets outside Git. Apply reviewed migrations to test before production. Provide recovery steps before live data exists. Do not promise a four-week delivery date until founder capacity and account availability are known.

## Measurement

Treat 50 registrations, 35 completed profiles, 15 real active listings, 20 inquiries and 10 confirmed connections as initial learning hypotheses from the source, not forecasts. Use a proposed 14-day invite pilot observation window. An inquiry is the first non-test message in a unique conversation; a successful connection requires participant follow-up. Record campus, listing freshness, reply rate and reports alongside totals. Conduct discovery interviews alongside development; do not contact people without authorization.

## Verification and builder discretion

Require type checks, lint, production build and meaningful tests for authorization, cross-user data isolation, listing/date filtering, conversation uniqueness, blocking and upload restrictions. Exercise onboarding → listing → discovery → conversation → report/block in a browser with two accounts, plus unauthorized third-account access attempts. Confirm responsive layouts, keyboard operation and empty/error states.

The implementer may choose component organization, validation utilities, pagination, and polling versus realtime updates. Use paginated message history and Supabase Realtime for authorized conversation updates; re-fetch on reconnect and deduplicate by message ID. Realtime subscriptions never replace RLS. Use bounded request sizes and rate limits for messages/reports/listing writes; fail safely if enforcement is unavailable in production. Exact limits and UI styling are implementation decisions to document. No missing credentials should be disguised as a functioning backend.

## Remaining user-facing approval

The user accepted the recommended pilot direction and React/Vite/React Router with Supabase. Review the implementation plan before scaffolding. UMich-first recruitment, member-only browsing, deferred scoring and the proposed stack are the main calls to review. Founder availability and existing accounts can be supplied later without blocking local development after approval. Retention, moderation ownership, university domain verification and reviewed launch policies remain explicit live-release gates.
