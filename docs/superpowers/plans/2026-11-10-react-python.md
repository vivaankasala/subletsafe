# React + Python Implementation Plan

**Goal:** Preserve React UX while making Python/FastAPI the app HTTP backend and push the working result.
**Spec:** docs/superpowers/specs/2026-11-10-react-python-design.md

1. Implement constrained Supabase HTTP gateway, JWT verification via Auth, university signup validation and authoritative profile/listing validation. Add deterministic Python tests.
2. Port listing photo validation, re-encoding, upload/delete and retry/idempotency workflow to Python using existing RPCs. Add deterministic image tests.
3. Route React SDK HTTP through backend, retain Realtime, add frontend routing tests and Vite proxy.
4. Add pinned Python runtime/dependencies, Docker Compose API service, Nginx API proxy, Kubernetes sidecar/config/probes and updated setup docs.
5. Run frontend/backend/DB checks, build and launch Docker, smoke-test real public API and rejection paths, obtain fresh review, resolve material findings, commit and push verified code.

## Review focus
Token/header leaks, arbitrary proxy access, large upload bodies/decompression, SDK auth refresh compatibility, signed storage URLs, preserving per-user RLS, container health/read-only operation, API failures never falling back to SPA HTML.

## Progress
Implementation complete. Independent backend modules were delegated under the subagent-driven development skill; frontend/deployment integration was owned by the primary agent. Fresh review found one material reliability issue: Auth 429/5xx was mapped to invalid-session 401. Three regression tests reproduced the bug, then passed after preserving rate limits and mapping outages to sanitized gateway errors. No other important findings. Docker dependency restarts were also checked to ensure Nginx reconnects to the API.

## Verification

55 frontend/PGlite tests and 80 Python tests pass. ESLint, Ruff, Python dependency consistency, TypeScript/Vite builds, Compose configuration, Kubernetes schemas/resource routing and Docker image builds pass. Both local containers are healthy under UID101/read-only restrictions. Real public Auth settings and campus reads through Nginx/Python/Supabase pass, including an actual JS SDK call. Unauthenticated/invalid-token/private-table/outside-domain requests are rejected. API restart with dependent web restart and the HTTP smoke script pass.

The local Playwright run has 1/6 passing: phone WebKit is frozen on macOS14 and fails with unsupported PushAPIEnabled; two desktop clicks time out waiting for actionability. The UI components and styles are unchanged, and prior GitHub Linux CI passed on baseline77d9c91. The rewrite must be checked by its own CI run; do not count this local browser run as passing. Full member sessions/recovery/positive uploads/moderation and a Kubernetes rollout remain unverified. No student data/schema changes were made.
