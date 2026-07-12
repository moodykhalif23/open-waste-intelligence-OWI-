# Build both frontends, serve them through one Caddy with /api reverse-proxied.
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /src
COPY app app
COPY dash dash
RUN cd app && pnpm install --frozen-lockfile && pnpm build
RUN cd dash && pnpm install --frozen-lockfile && pnpm build

FROM caddy:2-alpine
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /src/app/dist /srv/app
COPY --from=build /src/dash/dist /srv/dash
