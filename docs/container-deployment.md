# Docker and Kubernetes: React + Python

The Docker setup runs two containers: `web` serves React through Nginx and `api` runs Python/FastAPI. Nginx forwards `/api/` to Python on the private Docker network. Only the frontend port is exposed on localhost. Supabase remains hosted.

Docker Desktop is installed on this Intel Mac. Open it and wait for the engine before running commands. If `docker` is not found, run `export PATH="$HOME/.docker/bin:$PATH"` in that Terminal.

## Start on this Mac

```sh
cd /Users/vivaan/Documents/Codex/2026-11-07/new-chat/work/subletsafe
docker compose --env-file .env.local up --build -d --wait
docker compose --env-file .env.local ps
sh scripts/check-container.sh
```

Open http://127.0.0.1:8080. Use the extracted source directory instead on another computer. Copy `.env.example` to `.env.local` first if needed and set the public Supabase URL/key. Environment files are excluded from both Docker build contexts. Python receives public configuration at runtime; React receives it at build time. Rebuild React when those values change. Never supply backend administrator keys to either image.

```sh
docker compose --env-file .env.local logs -f web api
docker compose --env-file .env.local down
```

Stopping these containers does not delete hosted Supabase data. Code changes require rebuilding. Both containers run as non-root UID 101 with a read-only root filesystem, no extra capabilities and writable temporary storage. API health checks validate process/configuration, not hosted Supabase uptime.

## Supabase redirect settings

In Authentication → URL Configuration allow the frontend origin's `/auth/callback` and `/auth/update-password` URLs. For this Docker setup:

```text
http://127.0.0.1:8080/auth/callback
http://127.0.0.1:8080/auth/update-password
```

Add exact localhost equivalents only if using localhost. Keep port 5173 entries while using Vite. Set the primary Site URL for the environment. Python's `APP_ORIGINS` must include your exact frontend origin in deployed environments. The photo worker is called server-to-server without forwarding browser Origin; its existing Auth/ownership validation still applies.

## Local Kubernetes

The Deployment has a `web` and `api` container. The frontend Service exposes port 80 privately; the `api` Service routes private port 8000 to the Python sidecar. Kubernetes is not automatically enabled or provisioned by this code.

1. Enable a local cluster and install kubectl. Confirm `kubectl config current-context` points to your intended local cluster.
2. Build both images with Compose. Load **both** into the cluster's image store. For kind use `kind load docker-image subletsafe:local subletsafe-api:local --name YOUR_CLUSTER_NAME`; for minikube use `minikube image load subletsafe:local subletsafe-api:local`. Docker Desktop cluster image-sharing depends on its chosen provisioner/store.
3. Edit `k8s/config.yaml` with the same **public** Supabase configuration used for the React build and exact `APP_ORIGINS`. The committed values are placeholders; they deliberately do not configure an environment. No secrets are required in that ConfigMap.
4. Review and apply:

```sh
kubectl kustomize k8s
kubectl apply -f k8s/namespace.yaml
kubectl apply --dry-run=server -k k8s
kubectl apply -k k8s
kubectl -n subletsafe rollout status deployment/subletsafe --timeout=120s
kubectl -n subletsafe get pods,svc
kubectl -n subletsafe port-forward service/subletsafe 8080:80
```

Stop Compose first if it uses port 8080. Keep port-forward open and run `sh scripts/check-container.sh` from another Terminal. For new local builds reload both images, then restart the Deployment and check rollout status. There is no public URL or TLS provisioning in these manifests.

For hosted Kubernetes, choose the registry, cluster, domain and budget before deployment. Build images for the cluster architecture, push uniquely tagged releases and update **both** image entries in `k8s/kustomization.yaml`. Configure private registry credentials in the cluster if required. Add your platform's HTTPS Ingress or Gateway, set Supabase redirects and `APP_ORIGINS`, review resources/replicas, scan images and pin by digest under your release policy.

## Verification scope

Application tests, HTTP boundary tests, Python image validation tests, and Docker smoke checks cover different layers. Full member flows and a real Kubernetes rollout must be reported separately. See the build status for the latest actual results. No cloud resources are created by these files.
