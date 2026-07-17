# Deployment

One `docker compose` runs the whole platform: Postgres+PostGIS, Redis, MinIO, Label Studio, the API, the inference worker, the maintenance scheduler, and a Caddy web server that serves both frontends and reverse-proxies `/api`. Target: a single VPS (≤ USD 50/month) or an on-prem mini-PC.

## Prerequisites

- Docker Engine + Compose plugin (Linux VPS) or Docker Desktop (mini-PC/Windows)
- 2 GB RAM minimum, 4 GB comfortable; ~10 GB disk to start
- Optional: two DNS records (dashboard + field app) pointing at the server — Caddy then provisions Let's Encrypt TLS automatically

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
DASH_DOMAIN=dash.example.org   # omit both for LAN mode (self-signed on :8443/:8444)
APP_DOMAIN=app.example.org
EOF
# generate values with: python3 -c "import secrets; print(secrets.token_urlsafe(32))"

# 2. Build and start everything (make web wraps this):
make web        # or: docker compose --profile prod up -d --build

# 3. First organization + admin:
docker compose exec api uv run python -m owi_api.bootstrap \
  --org "Safi Cleaners and Recyclers" --name "Admin" --phone "+2547..." --password "..."
```

Migrations run automatically when the `api` container starts. Model weights are baked into the image at build time (SHA256-pinned), so the privacy gate never depends on a runtime download.

## What runs where

| Service                        | Role                                                      | Exposed                                          |
| ------------------------------ | --------------------------------------------------------- | ------------------------------------------------ |
| `web` (Caddy)                | dashboard + field PWA statics,`/api` reverse proxy, TLS | 80/443 (domains) or 8443/8444 (LAN, self-signed) |
| `api`                        | FastAPI: ingestion, registry, auth, analytics             | 8000 (behind the proxy in production)            |
| `worker`                     | RQ batch inference jobs                                   | —                                               |
| `scheduler`                  | hourly maintenance (quarantine purge)                     | —                                               |
| `db` / `redis` / `minio` | Postgres+PostGIS / queue / object store                   | internal (+ dev ports)                           |
| `labelstudio`                | labeling UI for the Safi Waste Dataset                    | 8080                                             |

LAN mode (no domains): open `https://<server-ip>:8443` (dashboard) and `https://<server-ip>:8444` (field app) and accept the self-signed certificate once per device.

## Production checklist

- [ ] `.env` secrets are unique and random — the API **refuses to boot** in production with dev defaults
- [ ] Firewall: expose only 80/443 (and 8080 if labelers are remote); keep 5432/6379/9000 internal
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
docker compose --profile prod up -d --build   # rebuilds changed images, restarts, re-migrates
```
