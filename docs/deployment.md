# Deployment

One `docker compose` runs the backend: Postgres+PostGIS, Redis, Garage, Label Studio, the API, the inference worker, and the maintenance scheduler. Target: a single VPS (≤ USD 50/month) or an on-prem mini-PC.

The three frontends (`dash`, `app`, `site`) are **not** built in Docker. They are static Vite builds produced outside it. The optional `edge` compose profile serves them with Caddy, which also terminates TLS and proxies `/api` to the API (see [TLS edge](#tls-edge-caddy)). Otherwise serve them from whatever you prefer: a static host (Netlify, Cloudflare Pages, S3) or an existing nginx/Caddy on the box. They consume the API over HTTP; nothing else in the compose stack depends on them.

Every port the stack publishes is bound to `127.0.0.1`, except the edge's 80 and 443. Docker-published ports bypass host firewalls such as ufw, so this loopback binding is what keeps Postgres, Redis, Garage, Label Studio and the API off the network.

## Prerequisites

- Docker Engine + Compose plugin (Linux VPS) or Docker Desktop (mini-PC/Windows)
- Node 22 + pnpm, wherever the frontends get built (a CI runner, your laptop, or the server itself when the edge serves them)
- 2 GB RAM minimum, 4 GB comfortable; ~10 GB disk to start
- TLS for the API and for whatever serves the frontends; the `edge` profile provides both. The field app needs a secure context (camera, geolocation, service worker), so it must be served over HTTPS

## Steps

```sh
git clone <repo> owi && cd owi

# 1. Secrets :
cat > .env <<'EOF'
POSTGRES_USER=owi
POSTGRES_PASSWORD=<random>
POSTGRES_DB=owi
GARAGE_RPC_SECRET=<random, 64 hex chars>
GARAGE_ADMIN_TOKEN=<random, 64 hex chars>
REDIS_PASSWORD=<random, 64 hex chars>
OWI_S3_ACCESS_KEY=<GK + 24 random hex chars>
OWI_S3_SECRET_KEY=<random, 64 hex chars>
OWI_JWT_SECRET=<random, 32+ chars>
LABEL_STUDIO_USERNAME=<admin email>
LABEL_STUDIO_PASSWORD=<random>
LABEL_STUDIO_USER_TOKEN=<random hex>
# Dashboard admin login — the single place this credential is written down.
OWI_ADMIN_PHONE=+2547...
OWI_ADMIN_PASSWORD=<random, 8+ chars>
OWI_ADMIN_NAME=Admin
OWI_ORG_NAME=<your organization>
# Origins the frontends are served from — required whenever they call the API
# cross-origin (i.e. VITE_API_URL is set rather than a same-origin /api proxy).
OWI_CORS_ORIGINS=["https://dash.example.org","https://app.example.org"]
EOF
# generate values with: python3 -c "import secrets; print(secrets.token_urlsafe(32))"
# hex values with:      python3 -c "import secrets; print(secrets.token_hex(32))"

# 2. Build and start the backend (make web wraps this):
make web        # or: docker compose --profile prod up -d --build
#    The organization, admin user and object-store bucket/key come from .env on first boot.

# 3. Build the frontends and publish the dist/ folders to your static host,
#    or serve them from this box with the edge profile (next section):
VITE_API_URL=https://api.example.org pnpm --dir dash build   # → dash/dist
VITE_API_URL=https://api.example.org pnpm --dir app  build   # → app/dist
pnpm --dir site build                                        # → site/dist (no API calls)
```

`VITE_API_URL` is baked in at build time. Leave it unset when the frontend is served from the same origin as the API (a proxy in front of both forwarding `/api` → `api:8000`, as the edge does) — then no CORS entry is needed either.

`REDIS_PASSWORD` is mandatory: compose refuses to start without it, Redis requires it from every client, and the API, worker and scheduler receive it through `OWI_REDIS_URL`. Use hex (as above) so it is safe inside a URL. Running the API from source on the host instead? Set `OWI_REDIS_URL=redis://:<REDIS_PASSWORD>@localhost:6379/0` in `.env` too.

## TLS edge (Caddy)

The `edge` profile adds a Caddy container (`deploy/Caddyfile`) that gets Let's Encrypt certificates for three hostnames and redirects HTTP to HTTPS:

| Hostname          | Serves                       | `/api/*` → `api:8000` |
| ----------------- | ---------------------------- | --------------------- |
| `OWI_APP_DOMAIN`  | `app/dist` (field PWA)       | yes                   |
| `OWI_DASH_DOMAIN` | `dash/dist` (dashboard)      | yes                   |
| `OWI_SITE_DOMAIN` | `site/dist` (landing page)   | no                    |

The `dist/` folders are mounted read-only. Unknown paths fall back to `index.html` so client-side routes survive a reload. Responses carry HSTS (without `includeSubDomains`, so a shared municipal domain is unaffected), `nosniff`, `X-Frame-Options: DENY`, a strict referrer policy and a `Permissions-Policy` that allows camera and geolocation for the page itself only. The field PWA gets its own origin, so its service worker (`/sw.js`, scope `/`) and camera work as-is. The frontends call relative `/api`, so build them **without** `VITE_API_URL` and leave `OWI_CORS_ORIGINS` at its default (`[]`).

1. Point DNS for all three hostnames at the server and allow 80/tcp, 443/tcp and 443/udp through the firewall.
2. Add the hostnames to `.env`:

   ```sh
   OWI_APP_DOMAIN=app.example.org
   OWI_DASH_DOMAIN=dash.example.org
   OWI_SITE_DOMAIN=example.org
   ```

3. Build the three frontends into the checkout. Build on the server, or build elsewhere and copy each `dist/` folder to the same path:

   ```sh
   pnpm --dir app  install --frozen-lockfile && pnpm --dir app  build   # → app/dist
   pnpm --dir dash install --frozen-lockfile && pnpm --dir dash build   # → dash/dist
   pnpm --dir site install --frozen-lockfile && pnpm --dir site build   # → site/dist
   ```

4. Start the backend and the edge together:

   ```sh
   docker compose --profile prod --profile edge up -d --build
   ```

Caddy will not start while a `dist/` folder is missing, so build first. Later rebuilds need no restart: Vite empties `dist/` in place and Caddy serves the new files at once. If you delete a `dist/` folder itself, run `docker compose --profile edge restart caddy`. Hashed files under `/assets/` are cached for a year. Everything else, including `index.html` and `sw.js`, is revalidated on each load, so phones pick up a new build on their next visit.

The `make` targets pass only `--profile prod`, so plain `make up` / `docker compose up` never start Caddy. Add `--profile edge` yourself when you stop or update the edge, e.g. `docker compose --profile prod --profile edge down`.

Hostnames left unset default to `app.localhost`, `dash.localhost` and `site.localhost`, with certificates from Caddy's internal CA. That is enough to try the edge on a laptop, not to serve phones.

Client IPs: the API runs uvicorn with `--proxy-headers --forwarded-allow-ips 172.16.240.10`, Caddy's fixed address on the `edge` network (`172.16.240.0/28`). Only Caddy can set the client address through `X-Forwarded-For`, and Caddy overwrites whatever a client sends. Requests to `127.0.0.1:8000` from the host keep their socket address (the Docker bridge gateway). If `172.16.240.0/28` collides with a network on your host, change the subnet, Caddy's `ipv4_address` and `--forwarded-allow-ips` together in `docker-compose.yml`.

## The dashboard login

`.env` is the source of truth. `OWI_ADMIN_PHONE` / `OWI_ADMIN_PASSWORD` are read on
every `up`: the admin is created if missing, and the password is re-synced if it
changed. Only the argon2 hash is written to Postgres — the plaintext exists solely
in `.env` (gitignored), so it can be read and rotated in one place but never
recovered from a database dump.

```sh
# forgot it, or want to rotate it
$EDITOR .env          # change OWI_ADMIN_PASSWORD
make up               # re-syncs; every existing dashboard session is signed out
```

Rotating bumps `token_version`, which invalidates outstanding JWTs. Leave the two
variables empty and the database is left untouched — useful once accounts are
managed from the dashboard itself.

Migrations run automatically when the `api` container starts. Model weights are baked into the image at build time (SHA256-pinned), so the privacy gate never depends on a runtime download.

## What runs where

| Service                   | Role                                          | Exposed                                                    |
| ------------------------- | --------------------------------------------- | ---------------------------------------------------------- |
| `api`                     | FastAPI: ingestion, registry, auth, analytics | `127.0.0.1:8000`; public as `/api` through `caddy`         |
| `worker`                  | RQ batch inference jobs                       | —                                                          |
| `scheduler`               | hourly maintenance (quarantine purge)         | —                                                          |
| `db` / `redis` / `garage` | Postgres+PostGIS / queue / object store       | `127.0.0.1` only: 5432 / 6379 / 3900 + 3903                |
| `labelstudio`             | labeling UI for the Safi Waste Dataset        | `127.0.0.1:8080`                                           |
| `osrm`                    | road distances for route planning             | — (the API reaches it as `osrm:5000`)                      |
| `caddy` (`edge` profile)  | TLS, static frontends, `/api` proxy           | 80, 443/tcp, 443/udp                                       |
| `dash` (built outside)    | dashboard SPA — static `dist/`, calls the API | `OWI_DASH_DOMAIN` via `caddy`, or wherever you host it     |
| `app` (built outside)     | field PWA — static `dist/`, calls the API     | `OWI_APP_DOMAIN` via `caddy`, or any host (HTTPS required) |
| `site` (built outside)    | landing page — static `dist/`, no API calls   | `OWI_SITE_DOMAIN` via `caddy`, or wherever you host it     |

Local pilot without a static host: run the frontends from source against the containerised API — `make dash` (`http://localhost:5174`), `make app` (`https://localhost:5173`, accept the self-signed certificate once per device), `make site` (`http://localhost:5175`). Their dev servers proxy `/api` to `http://127.0.0.1:8000`; point that elsewhere with `OWI_API_PROXY` in `.env`.

## Production checklist

- [ ] `.env` secrets are unique and random — the API **refuses to boot** in production with dev defaults
- [ ] Firewall: allow only 80/tcp, 443/tcp and 443/udp (the edge) plus SSH. Every other published port is bound to `127.0.0.1`. Remote labelers reach Label Studio through an SSH tunnel (`ssh -L 8080:127.0.0.1:8080 <server>`)
- [ ] `REDIS_PASSWORD` is set to a random hex value. Compose refuses to start without it
- [ ] `OWI_CORS_ORIGINS` lists exactly the frontend origins — no wildcard; unset it when the frontends are same-origin with the API
- [X] Backups are automated in compose: `db-backup` (nightly rotated pg_dump → `var/backups/postgres`, keeps 14 daily / 8 weekly / 6 monthly) and `garage-backup` (daily image mirror → `var/backups/garage`, quarantine excluded, deletions propagate). `make backup` runs one now; `make restore CONFIRM=yes` restores the newest dump. Copy `var/backups/` off-box (rsync/rclone) — an off-site copy must honor the same erasure rules
- [ ] Run one restore drill per phase (`make backup && make restore CONFIRM=yes`, then the smoke suite)
- [ ] Provision collector phones: dashboard login → issue device tokens (or `POST /api/v1/auth/device-tokens`)
- [ ] After any deploy: `docker compose exec api uv run python scripts/smoke.py http://localhost:8000 <admin-phone> <password>` must print ALL PASS

## Road distances for route optimization (automatic)

Road distances via self-hosted OSRM are part of the stack from day one. On first
`make web`, two one-shot services download the OpenStreetMap extract (default:
Kenya from Geofabrik) and prepare it (~5–15 min and a few GB of RAM/disk, once,
into `var/osrm/`); every later boot skips straight to serving. While preparation
runs, route planning transparently falls back to straight-line distances — a log
line says so — and switches to road distances as soon as OSRM answers.

Operating elsewhere? Set your region's extract in `.env` before first boot:

```sh
OSRM_PBF_URL=https://download.geofabrik.de/europe/portugal-latest.osm.pbf
```

To re-prepare after changing regions: delete `var/osrm/` and `make web` again.
To opt out entirely (tiny hosts), set `OWI_OSRM_URL=` (empty) in `.env` —
straight-line distances only, nothing else changes.

## Updating

```sh
git pull
docker compose --profile prod up -d --build   # backend: rebuilds changed images, restarts, re-migrates
pnpm --dir dash build && pnpm --dir app build && pnpm --dir site build   # frontends: redeploy dist/
```

Backend and frontends deploy independently — a frontend change never rebuilds an image, and an API deploy never interrupts static hosting. With the edge, add `--profile edge` to the compose command; the rebuilt `dist/` folders are live as soon as the build finishes.
