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
- Quarantine auto-deletion (2026-07-13): hourly scheduler process (`python -m owi_api.scheduler`) purges pre-blur originals past the 72 h retention, stamps `quarantine_deleted_at` as the audit trail; on-demand admin endpoint `POST /api/v1/admin/quarantine/purge`
- Image quality gate (2026-07-13): ingestion rejects blurry / dark / overexposed / tiny images with the reason in the batch response; accepted images store brightness + sharpness metrics in `image_quality_flags` for threshold tuning; field app warns the collector at capture time (client-side brightness + Laplacian check on the compressed canvas, EN + SW) while retaking is one tap away
- ONNX person detector (2026-07-13): privacy gate now runs YOLOX-tiny (Apache-2.0) on CPU via onnxruntime — score threshold 0.2 tuned for recall over precision; weights fetched by `scripts/fetch_models.py` (SHA256-pinned), server refuses to ingest without them; verified live: 13 people found in a real photo in 50 ms, end-to-end `privacy_status=blurred` with the original quarantined; bootstrap HOG deleted and the `opencv<5` pin lifted (now on OpenCV 5)
- **Verified live** (2026-07-13): migrations 0001–0003 on real PostGIS, 25/25 E2E smoke checks (`api/scripts/smoke.py`, rerunnable back-to-back) against Postgres + Redis + MinIO, 27 unit tests

### Field PWA spike (`/app`) — Vite + React + TS
- Photo via native camera → client-side compression to ~300 KB → GPS (10 s timeout, never blocks) → fill tap → IndexedDB offline queue → auto-sync
- Bin QR scanning (`BarcodeDetector` + manual entry fallback); QR-only reports sync without GPS
- EN + SW from first screen; on-screen per-report timer (≤ 20 s target); installable PWA; HTTPS dev server for phone-on-LAN testing

### Dashboard skeleton (`/dash`) — Vite + React + TS + Apache ECharts
- Login (JWT), flat no-gradient UI, EN/SW toggle, lazy-loaded routes (57 KB gzip shell; ECharts only on Overview)
- Overview: stat tiles + reports-per-day and fill-distribution charts (palette validated)
- Bins: site/bin creation, registry table, printable QR sticker download
- Reports: latest observations with authenticated photo viewer
- Users (2026-07-13): create users, issue collector device tokens (shown once, copy-to-clipboard), revoke tokens — phone provisioning without a terminal

### Labeling pipeline (`/ml`) — Label Studio + COCO export (2026-07-13)
- Label Studio in compose (UI at `:8080`, credentials + legacy API token in `.env`, `LABEL_STUDIO_LEGACY_API_TOKENS_ENABLED` for scripted access)
- `python -m owi_ml.labeling.setup_project` (idempotent): creates the "OWI Waste Detection" project with the 8-class taxonomy, attaches MinIO as S3 source storage (proxied — browser never touches MinIO), syncs new images into the labeling queue
- `python -m owi_ml.labeling.export_coco`: COCO snapshot zip → `ml/datasets/snapshots/` (gitignored)
- Verified live: 12 ingested images synced as tasks; export produces valid COCO with all 8 categories
- **Phase 0 engineering tasks (roadmap build order 1–6) are now all delivered**

### Infra & deployment
- `docker-compose.yml` at repo root (Postgres+PostGIS, Redis, MinIO, Label Studio); all secrets and URLs in the single gitignored repo-root `.env`; frontends are same-origin (`/api` proxied in dev, reverse proxy in production) with zero hardcoded URLs
- `make web` one-command launcher (Makefile at repo root: web / up / down / logs / ps / smoke / bootstrap / clean); screenshots live in the gitignored `screens/`
- Production deploy (2026-07-13): compose `prod` profile runs the whole platform — one `api` image (model weights baked in, SHA256-verified at build; migrations auto-run on start; non-root) serving as api / worker / scheduler, plus a `web` image (both frontends built and served by Caddy, `/api` reverse-proxied, auto-TLS with domains or self-signed for LAN pilots); healthchecked dependencies; deploy guide in `docs/11-deployment.md`. Verified live: full containerized stack (8 services) passes all 25 smoke checks; Caddy serves both frontends and proxies `/api`; worker executed a real queued job; scheduler ran its purge cycle in-container

### Phase 1 start — Bin health & collect-today (M2, 2026-07-13)
- Collection events (`POST /api/v1/collections`) and daily `bin_health_daily` analytics (migration 0004)
- Bin health engine: fill % from collector taps (band midpoints), fill-velocity regression, days-to-full, days-since-collection, overflow risk + recommendation per the v1 formula — pure function, 9 unit tests (published numbers are tested, per CONTRIBUTING)
- Recomputed hourly by the scheduler, on demand via `POST /api/v1/admin/analytics/refresh`, and immediately when a collection is recorded; ranked `GET /api/v1/bins/health`
- Dashboard "Collect today" page: ranked list with fill %, days-to-full, risk badges (label + color, never color alone), recommendation, mark-collected
- Works from human fill taps now; model fill predictions slot into the same series when Phase 1 models land
- Verified live in containers: fill sequence low→half→high over 3 days → bin flagged HIGH/collect-today; recording a collection resets days-since-collection
- Docker fixes from the live run: model fetch layer moved before source copy (code edits no longer re-download weights); `UV_NO_SYNC` so containers never install packages at runtime

### Active-learning scaffolding + driver collect list (2026-07-13)
- Prediction data model (migration 0005): `ml_models` registry (task, version, git commit, dataset hash, metrics, active flag — full traceability) + `predictions` (payload, review_status, corrected_payload, reviewed_by)
- Review queue: `GET /api/v1/predictions` (reviewer-only, unreviewed count + items) and `POST /api/v1/predictions/{id}/review` (confirm / correct); transition logic is a pure function with 6 unit tests — a confirmed prediction's payload and a correction both become training ground truth
- Worker is now registry-aware: looks up active models and loops per task (no-op with a clear log until the first model activates, but the real contract is in place)
- Dashboard **Review** page: image thumbnail + predicted value, one-tap confirm or correct-fill; empty state until a model is active
- Field app now has a **Collect** tab (bottom tab bar): driver sees the ranked collect-today list with risk rings and marks bins collected on the spot — closes the M4 driver loop ahead of routing
- Verified live in containers: 33/33 smoke checks (review queue reachable + reviewer-only); driver device token retrieves 9 scored bins and can mark collected; both frontends served through Caddy

### M8 Volunteer Analytics — grant-ready reporting (2026-07-13)
- Volunteer events (migration 0006): date, type (cleanup/education/sorting), area, organizer, participant count, hours, per-material kg, notes — aggregate-first, no PII
- Aggregation engine: totals (events, participants, hours, kg), kg-by-material, monthly trend — pure function with 4 unit tests (grant figures are published numbers)
- Endpoints: event create/list, `/summary`, and `/report` (date-range **branded HTML grant report**, print-to-PDF ready; WeasyPrint server-side PDF is a later hardening step)
- Dashboard **Volunteers** page: stat tiles, hours-by-month chart, fast event-entry form with per-material kg, event table, one-click grant report
- Verified live in containers: event → aggregated summary → rendered report (visually checked — Safi-branded, four headline tiles, material + monthly breakdown); 36/36 smoke checks
- Build robustness fix (proved in a real flaky-network build): `scripts/fetch_models.py` now retries model download with backoff, so a transient GitHub failure no longer breaks the image build
- New product logo: person lifting the lid of a standalone green bin, no background — applied to field app + dashboard

### M4 Collection Route Optimization (2026-07-13)
- CVRP engine (OR-Tools, Apache-2.0): cheapest set of routes collecting every due bin within truck capacity; bin demand estimated from latest fill % x volume x waste density; 7 unit tests (haversine correctness, all-served, capacity split, infeasible-demand rejection, matrix-agnostic)
- **Distance-provider abstraction**: pure `HaversineMatrix` default (zero infra) + `OsrmMatrix` road-distance upgrade — set `OWI_OSRM_URL` to switch, nothing else changes
- Trucks + routes + route_stops (migration 0007); endpoints: truck CRUD, `POST /routes/optimize` (auto-selects collect-today bins or takes an explicit set), `GET /routes`
- Dashboard **Routes / Plan today** page: truck management, one-click optimize, per-truck ordered stop list with km + fuel + demand tiles
- OSRM is an optional compose service (`osrm` profile) with a one-time OSM-extract prep documented in docs/11-deployment.md — not required to run
- Verified live in containers: truck created → optimize planned a route over 13 collect-today bins with distance/fuel → driver reads today's routes (41/41 smoke checks)
- Two deploy fixes from the live run: `httpx` promoted to a runtime dependency (OSRM client needs it); model-fetch retry already in place held up
- Driver route view (2026-07-13): field app **Collect** tab is now route-first — shows the planned route's numbered stops per truck with a progress count; the driver taps a stop done, which records the collection, resets that bin's health, and ticks the stop (`POST /routes/stops/{id}/collect`). Falls back to the raw collect-today list when no route is planned. Verified live: driver marks a stop → it shows collected
- Savings report (G2 headline, 2026-07-13): `GET /routes/savings` compares a fixed full-sweep (optimized visit to every bin) against need-driven routing (only bins due) and reports the **km-per-tonne reduction %** plus fuel litres and optional KES (set `OWI_FUEL_PRICE_KES_PER_L`). Self-contained — no manual baseline entry; a measured Phase 0 fuel-log baseline can replace the computed one later. Pure savings math with 3 unit tests; dashboard savings panel on the Routes page (headline % + baseline-vs-optimized table)
- Mid-day replan (M4-F3, 2026-07-13): `POST /routes/replan` recomputes the **uncollected** stops (plus any added bins, minus broken-down trucks) over the remaining fleet, superseding today's plan while keeping collected stops as history (collections are recorded independently). Dashboard: "Replan remaining" button + per-truck "Breakdown" action on each route card. Optimize/replan share one `_plan_and_persist` helper. Verified live (46/46 smoke checks) — **M4 is complete**

## In progress / blocked on a human

- **Phone test of the PWA spike** (Android 10 / 2 GB) — validates the PWA-over-Flutter decision; the project's #1 risk. Owner: Brian.

## Next up (rough order)

1. Train the first models (T1/T2/T3) on Phase 0 data → activate in the registry → predictions flow into the review queue (needs the labeled dataset)
3. Privacy-gate recall eval: dedicated person-containing test set (target recall ≥ 0.99) once real field photos exist
4. M1 composition views + M5 recycling value on the dashboard (arrive with the classification model)
5. Grant report hardening: WeasyPrint server-side PDF; fold in composition (M1) + carbon (M7) sections once those land

With all six Phase 0 engineering tasks delivered, the remaining Phase 0 work is operational, not code: partner kickoff, bin registry data entry, collector training, capture-rate tracking (gate G0).
