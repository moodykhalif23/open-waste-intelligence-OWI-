# Deployment

One `docker compose` runs the backend: Postgres+PostGIS, Redis, MinIO, Label Studio, the API, the inference worker, and the maintenance scheduler. Target: a single VPS (≤ USD 50/month) or an on-prem mini-PC.

The three frontends (`dash`, `app`, `site`) are **not** containerised. They are static Vite builds produced outside Docker and served by whatever you prefer — a static host (Netlify, Cloudflare Pages, S3), an existing nginx/Caddy on the box, or `pnpm preview` for a pilot. They consume the API over HTTP; nothing in the compose stack depends on them.

## Prerequisites

- Docker Engine + Compose plugin (Linux VPS) or Docker Desktop (mini-PC/Windows)
- Node 22 + pnpm, wherever the frontends get built (a CI runner or your laptop — not the server)
- 2 GB RAM minimum, 4 GB comfortable; ~10 GB disk to start
- TLS for the API and for whatever serves the frontends. The field app needs a secure context (camera + geolocation), so it must be served over HTTPS

## Steps

```sh
git clone <repo> owi && cd owi

# 1. Secrets :
cat > .env <<'EOF'
POSTGRES_USER=owi
POSTGRES_PASSWORD=<random>
POSTGRES_DB=owi
MINIO_ROOT_USER=owi
MINIO_ROOT_PASSWORD=<random>
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

# 2. Build and start the backend (make web wraps this):
make web        # or: docker compose --profile prod up -d --build
#    The organization and admin user are created from .env on first boot.

# 4. Build the frontends and publish the dist/ folders to your static host:
VITE_API_URL=https://api.example.org pnpm --dir dash build   # → dash/dist
VITE_API_URL=https://api.example.org pnpm --dir app  build   # → app/dist
pnpm --dir site build                                        # → site/dist (no API calls)
```

`VITE_API_URL` is baked in at build time. Leave it unset when the frontend is served from the same origin as the API (a proxy in front of both forwarding `/api` → `api:8000`) — then no CORS entry is needed either.

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

| Service                        | Role                                            | Exposed                               |
| ------------------------------ | ----------------------------------------------- | ------------------------------------- |
| `api`                        | FastAPI: ingestion, registry, auth, analytics   | 8000 (put TLS in front in production) |
| `worker`                     | RQ batch inference jobs                         | —                                    |
| `scheduler`                  | hourly maintenance (quarantine purge)           | —                                    |
| `db` / `redis` / `minio` | Postgres+PostGIS / queue / object store         | internal (+ dev ports)                |
| `labelstudio`                | labeling UI for the Safi Waste Dataset          | 8080                                  |
| *(not in Docker)* `dash`   | dashboard SPA — static`dist/`, calls the API  | wherever you host it                  |
| *(not in Docker)* `app`    | field PWA — static`dist/`, calls the API      | wherever you host it (HTTPS required) |
| *(not in Docker)* `site`   | landing page — static`dist/`, no API calls    | wherever you host it                  |

Local pilot without a static host: run the frontends from source against the containerised API — `make dash` (`http://localhost:5174`), `make app` (`https://localhost:5173`, accept the self-signed certificate once per device), `make site` (`http://localhost:5175`). Their dev servers proxy `/api` to `http://127.0.0.1:8000`; point that elsewhere with `OWI_API_PROXY` in `.env`.

## Production checklist

- [ ] `.env` secrets are unique and random — the API **refuses to boot** in production with dev defaults
- [ ] Firewall: expose only the API behind TLS (and 8080 if labelers are remote); keep 5432/6379/9000 internal
- [ ] `OWI_CORS_ORIGINS` lists exactly the frontend origins — no wildcard; unset it when the frontends are same-origin with the API
- [X] Backups are automated in compose: `db-backup` (nightly rotated pg_dump → `var/backups/postgres`, keeps 14 daily / 8 weekly / 6 monthly) and `minio-backup` (daily image mirror → `var/backups/minio`, quarantine excluded, deletions propagate). `make backup` runs one now; `make restore CONFIRM=yes` restores the newest dump. Copy `var/backups/` off-box (rsync/rclone) — an off-site copy must honor the same erasure rules
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

Backend and frontends deploy independently — a frontend change never rebuilds an image, and an API deploy never interrupts static hosting.
