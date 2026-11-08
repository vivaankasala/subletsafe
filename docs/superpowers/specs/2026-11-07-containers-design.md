# Docker and Kubernetes

The user requested Docker and Kubernetes for the existing Vite app and previously delegated implementation choices. Implement locally without provisioning hosting or changing Supabase.

## Approach

Use a multi-stage Node build and a non-root Nginx static server on port 8080. Docker Compose runs one instance on localhost:8080; Kubernetes runs the same image behind a ClusterIP Service. This follows the existing build-time Supabase configuration. A Node development server in production would add unnecessary build dependencies; self-hosting Supabase would change the approved hosted-backend architecture.

These are implementation choices made by the agent. No cluster, registry, public domain, paid resources, TLS issuer, or production release is assumed.

## Requirements

- Install from the committed pnpm lockfile using pnpm 11.25.0 and Node 24.
- Accept only the existing public Supabase URL and publishable/anon key as build arguments. Require both; preserve the existing key validator. Exclude local environment files from the Docker build context.
- Serve nested React routes through index.html; missing assets must return 404. Provide health checks and document auth redirects for the new origin.
- Run as UID/GID 101, drop capabilities, use a read-only root filesystem, and provide a writable temporary directory.
- Kubernetes needs resource requests/limits, readiness/liveness/startup probes, restricted security context, no service-account token, and a Service. Local defaults must use an explicitly named local image.
- Provide beginner instructions, a repeatable HTTP smoke check, and honest verification limits when Docker/cluster tooling is unavailable.

## Validation

Run existing tests, lint, and build. Parse Compose and Kubernetes YAML, validate Kubernetes resources against official schemas if available, and check the smoke script syntax. With Docker, build/run the image and check health, deep routes, asset responses, caching, and runtime restrictions. No public deployment is authorized by this implementation request alone.
