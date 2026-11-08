# Container Deployment Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan inline.

**Goal:** Package the existing app for local Docker and Kubernetes deployment.

**Architecture:** Build Vite in Node, serve dist with non-root Nginx, and use the same image in Compose and Kubernetes. Supabase stays hosted.

**Tech Stack:** Node 24, pnpm 11.25.0, Nginx Alpine, Docker Compose, Kubernetes Kustomize.

**Spec:** docs/superpowers/specs/2026-11-07-containers-design.md

## Global Constraints

No hosting provisioning or backend migration. Public Supabase values are build-time configuration; exclude .env files and reject missing configuration. UID/GID 101, port 8080, read-only root, writable /tmp.

## Review Focus

Missing static assets must not return HTML; auth deep links must survive refresh; an image must not include local env files; Kubernetes image naming must match documented local loading; Nginx must not write outside /tmp under restricted runtime settings.

## Task 1: Container and local serving

- [x] Create Dockerfile, .dockerignore, docker/nginx.conf, and compose.yaml.
- [x] Add scripts/check-container.sh to exercise HTTP behavior against a running container, including nested auth routes and missing assets.
- [x] Parse Compose and validate its configuration when tooling is available; check shell syntax. Build/run and execute HTTP checks if Docker is available; record any unavailable checks.

## Task 2: Kubernetes and handoff

- [x] Add k8s namespace, Deployment, Service and kustomization with image subletsafe:local.
- [x] Add docs/container-deployment.md and link it from README. Include local Docker, local Kubernetes, registry customization, redirects, and operational limitations.
- [x] Validate YAML/schema and cross-resource references; run tests, lint and build. Obtain a scoped fresh review and resolve material findings.
- [x] Commit, refresh the source ZIP, and deliver the setup guide and actual validation results.

## Execution record

Completed inline. Review identified omitted shared test modules and the initial namespace dry-run ordering. The isolated build reproduced the missing-module failure, then passed after including the shared files; the deployment instructions now create the namespace first. Compose workspace build-script settings are copied before dependency installation. All 52 app tests, lint, build, YAML/schema checks and shell syntax checks pass. Docker image execution and Kubernetes rollout remain unverified because neither Docker nor kubectl is installed. No cloud deployment or Supabase configuration was changed.

## Subsequent Docker runtime verification

At the user’s request, installed the official checksum-verified Intel Docker Desktop 4.98.0 app. Engine 29.9.2 and Compose 5.6.1 run. Actual Compose configuration, Alpine dependency installation, image build, container startup, HTTP smoke script, Nginx validation, health and restricted runtime settings all pass. SubletSafe remains running locally on 127.0.0.1:8080. Kubernetes was not enabled or deployed; Supabase auth/Edge origins were not changed.
