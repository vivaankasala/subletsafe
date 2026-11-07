# SubletSafe

Student housing and roommate discovery for Michigan universities. React + Vite + React Router + Supabase.

## Status

This is a working local codebase, not a launched marketplace. Home, auth, profile, housing, roommate, messaging, moderation and account routes are implemented. SQL migrations define ownership, membership, blocks, reports, quotas and privileged operations. A Supabase development project is connected and its initial database and upload function have been deployed. No real student records have been created. Missing configuration displays setup information; it never substitutes invented listings.

Local unit and embedded PostgreSQL tests exercise validation and RLS. Live campus reads and unauthorized upload rejection have been verified; full member Auth, positive Storage uploads and Realtime journeys still need integration verification. See docs/backend-status.md. Do not invite students until `docs/release-checklist.md` is satisfied.

## Run locally

Use Node.js 22.12+ (24 recommended) and pnpm 11.25.0.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the Local URL printed by Vite (normally http://localhost:5173). Without configuration you can inspect the home, sign-in and safety pages. Protected routes show a setup message.

## Connect Supabase

1. Create a dedicated development Supabase project or start the local Supabase stack with its CLI and Docker. Never point development tests at production.
2. Copy `.env.example` to `.env.local`. Add your project URL and **publishable** key from the Supabase project API settings:

   ```dotenv
   VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
   ```

   A local stack's legacy **anon** JWT is supported. Secret keys and service-role JWTs are rejected by the frontend configuration validator. Do not put them in any `VITE_` variable.
3. This project’s initial migrations have now been applied through the connected Supabase tools. For a fresh project, apply the timestamped SQL files under `supabase/migrations/` in order. They include university seed data. The drafts in `docs/migration-history/` are historical references, not additional migrations. For local development, `supabase db reset` uses the timestamped files.
4. In Auth, enable email confirmation; set Site URL to the actual frontend origin and allow `/auth/callback` and `/auth/update-password` on that origin. Configure a development mail service or use local Supabase's mail inbox. Configure password policy to match or exceed the UI's 10-character signup minimum.
5. The pilot is invitation-only. Through trusted SQL, add each invited student's normalized university address to `pilot_invites`; no client can read or modify this list. Registration alone does not grant access. Review university email domains in `universities` before enabling live accounts. University affiliation and search campus are intentionally separate.
6. Deploy `upload-listing-image` with the Supabase CLI. Set the function's `APP_ORIGIN` to the exact frontend origin (e.g. http://localhost:5173). Supabase supplies its server URL, anon key and service-role key to the function. Never move those server secrets into frontend config. Verify this function under the actual Edge runtime before relying on uploads.
7. Restart Vite after editing `.env.local`.

For a fresh local stack:

```sh
supabase start
supabase db reset
supabase functions serve upload-listing-image
```

The seed contains universities only, not fake users or properties.

## Checks

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

`tests/database.test.ts` creates an in-memory PGlite PostgreSQL database with simulated Supabase auth/storage schemas and roles, then applies the actual migrations. This validates SQL policies and RPC behavior; it does not prove hosted API, Storage JWT or Realtime behavior. No real student records are used.

```sh
pnpm exec playwright install chromium
pnpm test:e2e
```

The browser smoke suite starts Vite on port 5175 with empty Supabase config and tests public navigation and setup states. Live member journeys are separately listed in the release checklist. The browser smoke suite is not a replacement for those checks.

## Routes

- `/`: public introduction; `/safety`: how it works and product safety guidance.
- `/auth`, `/auth/callback`, `/auth/update-password`: auth and recovery.
- `/profile`: onboarding and disclosed roommate preferences.
- `/housing`, `/housing/new`, `/housing/:id`, `/housing/:id/edit`: listings.
- `/roommates`: opted-in member discovery.
- `/messages`, `/messages/:id`: private conversations.
- `/account`: profile link, blocks, account hide/deletion request.
- `/moderation`: report queue, accessible only with a server-controlled moderator role.

## Security model

Database policies enforce confirmed-member reads, own-profile/listing writes and participant-only messages. Messages are created through a transaction RPC, never direct table insertion. Reporters can explicitly share up to 20 conversation messages as report evidence; moderators access only those snapshots through an audited report-detail operation, not arbitrary chats. A symmetric block prevents new contact and message writes while preserving participants' existing history. Rate limits are transactionally enforced in PostgreSQL. No payment or lease workflow exists.

University email confirmation is derived from Auth, not editable profile metadata. Profiles contain no account email or exact address. Photos are privately stored, validated by decoding, re-encoded to JPEG and delivered through 60-second signed URLs. Already issued URLs can remain usable until expiration; decoded images may remain cached on a viewer's device. Original photo metadata is not preserved.

For the invite pilot, assign an operator through trusted SQL by inserting their confirmed Auth UUID into `moderator_roles`; users cannot grant themselves that role. `moderate_report` verifies authorization inside the transaction and records an audit entry. Reversing restrictions/removals is an operator-only reviewed SQL task in this version; no client control exists for it.

Account deletion requests immediately hide the account and prevent new activity. Permanent deletion and retention are deliberately not automated until the founders approve policy. This must be resolved before live recruitment.

## Deployment

`pnpm build` produces a static `dist/` directory. Configure the host to serve `index.html` for non-asset application routes, including nested housing/auth paths; do not rewrite missing assets to HTML. Put publishable frontend values into build-time environment configuration. Set the exact deployed auth redirect origins and Edge Function origin separately. Rebuild when frontend configuration changes. No external hosting project or GitHub repository has been created. Database grants are explicitly reset for the application tables/functions so security does not depend on a Supabase project’s default grant settings.

## Next operational work

Connect a development Supabase project, validate the full journey with two members plus an outsider, finalize retention/community/privacy policies, name moderation coverage, then seed real inventory with permission. See `docs/pilot-runbook.md` and `docs/release-checklist.md`.

## University signup gate
Only exact @msu.edu and @umich.edu addresses can register. Frontend validation gives a clear error, and the private Auth-table trigger enforces the restriction against direct API bypass and account email changes. Email confirmation and pilot invitation are still required. See docs/signup-security.md for implementation and verification.
