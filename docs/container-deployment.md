# Run SubletSafe with Docker and Kubernetes

Docker packages the built website and its web server. Kubernetes runs that image and restarts it when needed. Supabase continues to provide hosted accounts, database, photos, and messages.

## Start with Docker on your Mac

1. Install [Docker Desktop for Mac](https://docs.docker.com/desktop/setup/install/mac-install/) and open it. Wait until Docker is running. Docker Desktop 4.98.0 (Intel) has now been installed on this Mac. The local Docker engine and SubletSafe container have been verified running.
2. Open Terminal and go to the source directory:

   ```sh
   cd /Users/vivaan/Documents/Codex/2026-11-07/new-chat/work/subletsafe
   ```

   If using the source ZIP on another computer, go to its extracted directory instead.
3. This Mac already has `.env.local`. On another computer, copy `.env.example` to `.env.local` and enter the Supabase URL and **publishable** key. Never use a secret key or service-role key here.
4. Build and start the container:

   ```sh
   docker compose --env-file .env.local up --build -d
   docker compose --env-file .env.local ps
   ```

5. Open <http://127.0.0.1:8080>. The existing Vite development server uses port 5173; Docker uses 8080.
6. Run the HTTP checks:

   ```sh
   sh scripts/check-container.sh
   ```

If a new Terminal says `docker: command not found`, run `export PATH="$HOME/.docker/bin:$PATH"` in that Terminal, then retry. Docker Desktop placed its command-line tools there.

Useful commands:

```sh
docker compose --env-file .env.local logs -f web
docker compose --env-file .env.local down
```

Stopping the frontend does not delete Supabase data. Docker builds need internet access for the base images and locked npm packages. The first build takes longer; later builds reuse dependency layers.

## Supabase settings for the new URL

In the project's **Authentication → URL Configuration**, add these allowed redirect URLs for local Docker use:

```text
http://127.0.0.1:8080/auth/callback
http://127.0.0.1:8080/auth/update-password
```

If you use `localhost` instead, add that exact origin too. Keep port 5173 redirects if you still use Vite. Set Site URL to the primary app origin for the environment. Set the upload Edge Function's `APP_ORIGIN` to the exact frontend origin when testing uploads; its existing default permits only port 5173. Changing this setting changes which frontend may upload, so coordinate it with your current development setup.

Supabase values are compiled into the browser JavaScript by Vite. Changing container environment variables or adding a Kubernetes Secret does not change them. Rebuild the image with the new public values. The Docker context excludes `.env.local`; Compose passes only the two named public build arguments. Never put backend secrets in build arguments, frontend variables, or Kubernetes manifests for this static frontend.

## Run on a local Kubernetes cluster

Docker is the easiest way to start. Kubernetes is useful for learning deployment and for a future hosted cluster; it does not add app features by itself.

1. In Docker Desktop, enable a local Kubernetes cluster and install `kubectl` using the [official macOS guide](https://kubernetes.io/docs/tasks/tools/install-kubectl-macos/).
2. Build the Docker image with Compose first. It is named `subletsafe:local`.
3. Check that you are targeting your **local** cluster:

   ```sh
   kubectl config current-context
   kubectl get nodes
   ```

4. Make the image available to your cluster. Some Docker Desktop configurations share the Docker image store; others require loading it into the cluster. If a pod reports `ImagePullBackOff`, the image is not available. For a separately installed kind cluster:

   ```sh
   kind load docker-image subletsafe:local --name YOUR_CLUSTER_NAME
   ```

   For minikube, use `minikube image load subletsafe:local`. Use the cluster name you created; this repository does not create one.
5. Preview, apply, and check the deployment:

   ```sh
   kubectl kustomize k8s
   kubectl apply -f k8s/namespace.yaml
   kubectl apply --dry-run=server -k k8s
   kubectl apply -k k8s
   kubectl -n subletsafe rollout status deployment/subletsafe --timeout=120s
   kubectl -n subletsafe get pods,svc
   kubectl -n subletsafe port-forward service/subletsafe 8080:80
   ```

6. Leave that Terminal open. Visit <http://127.0.0.1:8080>, then run `sh scripts/check-container.sh` from another Terminal in the project. Stop Compose first if it is already using port 8080.

The Service is private to the cluster; port-forward exposes it only locally. No public endpoint or TLS certificate is created. One replica is the local default. Kubernetes probes check Nginx and the built index, not hosted Supabase availability. The frontend is stateless; it has no persistent volume.

After rebuilding the `local` tag, load it into the cluster again if necessary, then run:

```sh
kubectl -n subletsafe rollout restart deployment/subletsafe
kubectl -n subletsafe rollout status deployment/subletsafe --timeout=120s
```

Inspect failures with:

```sh
kubectl -n subletsafe logs deployment/subletsafe
kubectl -n subletsafe get events --sort-by=.lastTimestamp
```

## Later: deploy to a hosted cluster

Choose the registry, cluster, domain, and budget before publishing anything. This change does not provision or deploy cloud resources.

- Build with the target environment's public Supabase configuration. For mixed Mac ARM/cloud AMD64, use Docker Buildx with the target platform; do not assume your Mac's image matches the cluster architecture.
- Tag and push the image to your registry using a unique release tag. Update `newName` and `newTag` in `k8s/kustomization.yaml` to that registry path and release tag. Production deployments should use immutable tags or digests; the `local` tag is for local practice.
- Configure an image pull secret on the Deployment if your registry is private. Credentials belong in the cluster, never the committed YAML.
- Review resource sizing and replica count for your cluster. The manifests use one replica and conservative starting limits, not measured production capacity.
- Add your platform's supported HTTPS routing (Ingress or Gateway) and DNS. The included ClusterIP Service alone does not publish the app.
- Configure Supabase Auth redirects and upload `APP_ORIGIN` for the deployed HTTPS origin. Verify confirmation, recovery, and photo uploads there before inviting users.
- Scan images and refresh base-image versions regularly. The Node builder uses the maintained Node 24 Alpine tag; Nginx uses an explicit release tag. Pin both by digest under your release policy for byte-for-byte base-image reproducibility.

## What is included

- `Dockerfile`: locked dependency install, TypeScript/Vite build, static Nginx runtime.
- `.dockerignore`: allowlisted source only; local configuration and repository metadata are excluded.
- `docker/nginx.conf`: React route fallback, asset 404s, index revalidation, hashed-asset caching, health endpoint.
- `compose.yaml`: localhost binding, read-only root, dropped capabilities, writable temporary storage.
- `k8s/`: Deployment, private Service, namespace, Kustomize image configuration, probes and resource limits.
- `scripts/check-container.sh`: actual HTTP checks against Docker or a Kubernetes port-forward.

Both runtime configurations use non-root UID/GID 101. Nginx writes its PID and temporary files under `/tmp`, with logs on stdout/stderr. Node, source tests, and build tools are absent from the final runtime image.

## Validation status

Verified during implementation:

- All 52 existing tests, ESLint, and the TypeScript/Vite production build pass.
- A separate build containing only Docker's copied source files passes with synthetic public configuration. It caught missing shared test imports before they were fixed. This reuses the host's installed dependencies; it does not validate Alpine package installation.
- Compose YAML passes the Compose Specification JSON Schema. Namespace, Deployment, and Service pass Kubernetes 1.34 OpenAPI validation, including its int-or-string field semantics. Kustomize resource paths, selectors, namespaces, and target ports agree.
- Shell syntax and Git whitespace checks pass. Selected Node/Nginx image tags exist and include Linux AMD64 and ARM64 variants.

Runtime verification completed on this Intel Mac with Docker Desktop 4.98.0, Engine 29.9.2, and Compose 5.6.1:

- Docker’s own Compose configuration check passes. The actual multi-stage image builds from the frozen lockfile, including package installation on Alpine.
- `subletsafe-web-1` runs from `subletsafe:local`, is healthy, and listens only on `127.0.0.1:8080`.
- `sh scripts/check-container.sh` passes against the running container: health, nested SPA routes, missing assets, caching and headers.
- `nginx -t` passes inside the container. UID/GID 101, read-only root, all capabilities dropped, no-new-privileges, writable /tmp, and absent build/source directories are verified.

The frontend is running locally, not published online. No Kubernetes cluster has been enabled or deployed. Full authenticated browser journeys, confirmation/recovery emails on port 8080, and photo uploads still require the Supabase origin configuration and integration checks described above.

References: [Docker multi-stage builds](https://docs.docker.com/build/building/multi-stage/), [Vite environment configuration](https://vite.dev/guide/env-and-mode), and [Kubernetes security contexts](https://kubernetes.io/docs/tasks/configure-pod-container/security-context/).
