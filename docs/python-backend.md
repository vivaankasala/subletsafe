# React + Python architecture

React keeps the existing interface and its TypeScript safety checks. FastAPI is the application HTTP backend. The Supabase SDK still manages browser sessions, password recovery and Realtime subscriptions, but its HTTP requests use `src/lib/backendFetch.ts` to call Python at `/api/supabase/…`.

Browser → Nginx `/api/` → Python/FastAPI → hosted Supabase Auth, PostgREST, Storage and photo worker. Supabase Realtime WebSockets and short-lived signed image downloads remain direct managed transports.

## Python responsibilities

- Allow only the app's needed Auth paths, tables, RPCs and storage signing requests. Unknown operations are rejected, not forwarded.
- Verify each protected request through Supabase Auth and forward the same caller token to preserve RLS. No administrator key, new user database or schema migration.
- Validate profile/listing writes with Pydantic, remove immutable identity fields on updates, bind inserted actor IDs to the verified user, and validate reporting/messaging/moderation RPC parameters.
- Validate exact MSU/UMich signup domains on the server; the existing database trigger still protects direct Supabase calls.
- Bound request bodies and timeouts; constrain forwarded headers and sanitize local errors. Auth error responses retain SDK-compatible status and code handling.
- Parse multipart photo requests in Python, validate UUIDs/actions/MIME and pixel limits, remove metadata, normalize orientation and re-encode static photos to JPEG. The existing hosted photo Edge Function commits private storage and image reservations with its existing server-only privileges. Its deployed TypeScript worker and database SQL remain part of the managed backend; no administrative secret is added to FastAPI.

## API surface

- `GET /api/healthz`: process liveness.
- `GET /api/readyz`: valid backend configuration; does not probe Supabase on every health check.
- `/api/docs`: generated FastAPI documentation. The gateway is intentionally constrained by Python allowlists rather than exposing arbitrary upstream APIs.
- `/api/supabase/auth/v1/…`: supported Auth operations including refresh, recovery and signup.
- `/api/supabase/rest/v1/…`: supported tables and RPCs under the caller's RLS permissions.
- `/api/supabase/storage/v1/object/sign/listing-photos/…`: authenticated signed URL creation.
- `/api/supabase/functions/v1/upload-listing-image`: Python photo validation followed by the hosted storage adapter.

Auth data stays in the Supabase browser session mechanism used before the rewrite. This does not introduce cookie sessions or claim HttpOnly protection. Do not put tokens in URLs or logging statements. Supabase confirmation links continue using the frontend origin and existing callback routes.

## Development

Use Python 3.12+ and the existing Node/pnpm versions. Create `.env.local` from `.env.example` with public Supabase values. Never add a service-role or secret key. FastAPI accepts `SUPABASE_URL`/`SUPABASE_PUBLISHABLE_KEY`, falling back to the existing `VITE_` names for local development.

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements-dev.txt
.venv/bin/python -m uvicorn backend.app:app --env-file .env.local --reload --port 8000
```

In another Terminal run `pnpm dev`. Vite proxies `/api/` to localhost:8000. Configure `APP_ORIGINS` as a comma-separated list of exact frontend origins for other ports/domains. Default development origins are localhost and 127.0.0.1 on ports 5173 and 8080. Restart Python after configuration changes.

```sh
.venv/bin/python -m pytest backend/tests -q
.venv/bin/ruff check backend
pnpm test
pnpm lint
pnpm build
```

Python tests use in-process ASGI requests and mocked upstream HTTP. They exercise validation, authentication enforcement, upstream contract handling, uploads and hostile inputs without sending emails or creating accounts. Existing PGlite tests still validate actual SQL policies. Docker and public upstream smoke checks complement these; they do not substitute for full member acceptance tests.

## Deployment

See [Docker and Kubernetes guide](container-deployment.md). Deploy the frontend and API together. Python dependencies are fully pinned in `backend/requirements.txt`; dev dependencies extend that lock. `requirements.in` describes allowed upgrade ranges; do not install directly from it for releases. Base images use maintained tags and should be scanned/refreshed and pinned by digest under a release policy.

The rewrite preserves the existing schema/data and public routes. Complete real member login, refresh, recovery, listing edits, upload retry/deletion, conversations, Realtime and moderation checks before inviting students. No real student password was used during automated tests.
