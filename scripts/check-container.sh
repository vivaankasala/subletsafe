#!/bin/sh
# Run against a running Compose container or a Kubernetes port-forward.
set -eu
base=${1:-http://127.0.0.1:8080}
base=${base%/}
temporary=$(mktemp -d)
trap 'rm -rf "$temporary"' EXIT HUP INT TERM

curl -fsS "$base/healthz" -o "$temporary/health"
test "$(cat "$temporary/health")" = ok
curl -fsS -D "$temporary/index-headers" "$base/" -o "$temporary/index"
grep -qi 'cache-control: no-cache' "$temporary/index-headers"
grep -qi 'x-content-type-options: nosniff' "$temporary/index-headers"

for route in /auth /auth/callback /auth/update-password /housing/example /messages/example; do
    curl -fsS "$base$route" -o "$temporary/route"
    cmp "$temporary/index" "$temporary/route"
done

for missing in /assets/missing.js /assets/missing.css /missing.js /.env.local; do
    status=$(curl -sS -o /dev/null -w '%{http_code}' "$base$missing")
    test "$status" = 404 || { echo "Expected 404 for $missing, got $status" >&2; exit 1; }
done

asset=$(sed -n 's/.*src="\(\/assets\/[^" ]*\.js\)".*/\1/p' "$temporary/index" | head -n 1)
test -n "$asset" || { echo 'No compiled JavaScript asset found' >&2; exit 1; }
curl -fsS -D "$temporary/asset-headers" "$base$asset" -o "$temporary/asset"
grep -qi 'content-type: application/javascript' "$temporary/asset-headers"
grep -qi 'cache-control: max-age=31536000' "$temporary/asset-headers"
test -s "$temporary/asset"
echo 'Container HTTP checks passed: health, SPA routes, asset handling, caching, and headers.'
