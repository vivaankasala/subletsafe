# syntax=docker/dockerfile:1
FROM node:24-alpine AS build
WORKDIR /app
RUN npm install --global pnpm@11.25.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json vite.config.ts playwright.config.ts index.html ./
COPY src ./src
COPY tests ./tests
COPY supabase/functions/_shared ./supabase/functions/_shared

# These values are public and embedded in the browser bundle. Never pass server secrets.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
RUN test -n "$VITE_SUPABASE_URL" && test -n "$VITE_SUPABASE_PUBLISHABLE_KEY" \
    && pnpm build

FROM nginx:1.30.6-alpine AS runtime
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/dist /usr/share/nginx/html
USER 101:101
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/index.html || exit 1
# Bypass the upstream entrypoint's configuration writes; all runtime writes use /tmp.
ENTRYPOINT []
CMD ["nginx", "-g", "daemon off;"]
