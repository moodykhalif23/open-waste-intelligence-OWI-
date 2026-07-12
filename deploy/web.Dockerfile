# Build both frontends, serve them through one Caddy with /api reverse-proxied.
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /src

# Dependency layers cache independently of source: manifests first, then install.
COPY app/package.json app/pnpm-lock.yaml app/pnpm-workspace.yaml app/
RUN cd app && pnpm install --frozen-lockfile
COPY dash/package.json dash/pnpm-lock.yaml dash/pnpm-workspace.yaml dash/
RUN cd dash && pnpm install --frozen-lockfile

COPY app app
COPY dash dash
RUN cd app && pnpm build
RUN cd dash && pnpm build

FROM caddy:2-alpine
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /src/app/dist /srv/app
COPY --from=build /src/dash/dist /srv/dash
