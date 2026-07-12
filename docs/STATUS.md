# Build Status — single source of truth

**This is the only place build progress is tracked.** Other docs describe the product and its plans; when something ships, it gets recorded here and removed from any checklist elsewhere. Last updated: **2026-07-12**.

## Done

### Backend (`/api`) — Python 3.12, FastAPI, Postgres 16 + PostGIS
- Monorepo scaffolding, CI (ruff, mypy strict, pytest × app/dash tsc, eslint, build), uv tooling
- Data model v1 (migrations 0001–0002): organizations, users, sites, bins, observations — `org_id` on every table, soft deletes, UTC, PostGIS points, content-hash dedupe constraint
- Ingestion service: batch upload → dedupe → privacy gate (person blur before storage, quarantine of originals) → object store (MinIO/local) → inference queue (Redis + RQ, placeholder job)
- Bin registry: sites + bins CRUD, unguessable QR slugs, printable QR SVG endpoint, collector by-QR lookup
- Registry-based location: observations accept GPS **or** a bin reference; QR-only reports get the bin's registered location
- Auth: argon2 passwords, JWT with role claims, long-lived collector device tokens, per-user `token_version` revocation, bootstrap CLI (`python -m owi_api.bootstrap`)
- Security baseline: production refuses to boot on dev-default secrets, login rate limiting (per phone + per IP), CORS allowlist, security headers, secrets only in gitignored `.env`
- Dashboard-facing reads: observations list + authenticated image endpoint (staff roles only; `api_consumer` can never reach raw observations)
- **Verified live** (2026-07-12): migrations on real PostGIS, 21/21 E2E smoke checks (`api/scripts/smoke.py`) against Postgres + Redis + MinIO, 22 unit tests

### Field PWA spike (`/app`) — Vite + React + TS
- Photo via native camera → client-side compression to ~300 KB → GPS (10 s timeout, never blocks) → fill tap → IndexedDB offline queue → auto-sync
- Bin QR scanning (`BarcodeDetector` + manual entry fallback); QR-only reports sync without GPS
- EN + SW from first screen; on-screen per-report timer (≤ 20 s target); installable PWA; HTTPS dev server for phone-on-LAN testing

### Dashboard skeleton (`/dash`) — Vite + React + TS + Apache ECharts
- Login (JWT), flat no-gradient UI, EN/SW toggle, lazy-loaded routes (57 KB gzip shell; ECharts only on Overview)
- Overview: stat tiles + reports-per-day and fill-distribution charts (palette validated)
- Bins: site/bin creation, registry table, printable QR sticker download
- Reports: latest observations with authenticated photo viewer

### Infra
- `docker-compose.yml` at repo root (Postgres+PostGIS, Redis, MinIO), all secrets via `.env` (`.env.example` committed)

## In progress / blocked on a human

- **Phone test of the PWA spike** (Android 10 / 2 GB) — validates the PWA-over-Flutter decision; the project's #1 risk. Owner: Brian.

## Next up (rough order)

1. Quarantine auto-deletion job (≤ 72 h retention for pre-blur originals) — governance requirement, currently manual
2. Image quality gate at ingestion (reject blurry/dark with instant retake feedback)
3. Replace bootstrap HOG person detector with high-recall ONNX person model (then revisit the `opencv<5` pin)
4. Label Studio deployment + export-to-COCO pipeline (last Phase 0 engineering task)
5. Production deployment story: api + worker Dockerfiles wired into compose, deploy-to-VPS doc
6. Dashboard: review queue and collect-today list (arrive with Phase 1 models)
