# Build Status — single source of truth

**This is the only place build progress is tracked.** Other docs describe the product and its plans; when something ships, it gets recorded here and removed from any checklist elsewhere. Last updated: **2026-07-13**.

## Feature completeness vs docs (honest audit)

Platform foundation (ingestion, privacy gate, image-quality gate, auth + RBAC, bin registry, object store, batch queue, model registry, review queue, deploy, ML training harness) is **done**. Per-module against the docs:

| Module                    | State                 | Remaining to be "fully featured"                                                                                                                                                                   |
| ------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M2 Bin Health             | **done**        | overflow WhatsApp/SMS digest (M2-F5); bin history page with fill curve (M2-F7)                                                                                                                     |
| M4 Route Optimization     | **done**        | plan-vs-actual from GPS breadcrumbs (M4-F4); what-if scenario runner (M4-F6)                                                                                                                       |
| M8 Volunteer Analytics    | **done**        | spreadsheet bulk import (M8-F2); volunteer certificates (M8-F6); WeasyPrint PDF.                                                                                                                   |
| M1 Waste Classification   | **done** (calibration pending data) | inference live (worker → review queue); composition aggregates + headline view (M1-F2); period-over-period comparison (M1-F3); material drill-down to observations (M1-F6). Only remaining: sorting-ground-truth calibration (M1-F4) — needs sorting-site weights that don't exist until the pilot |
| M3 Illegal Dumping        | **done** (model later) | human-confirm review queue over street observations, recency×frequency hotspot list, per-site timeline, intervention + recurrence tracking, coarse analytics. Candidate auto-flagging model comes with Phase 1 detection; a map view can replace the hotspot list later |
| M5 Recycling Intelligence | **done** (calibration pending data) | material kg tracking, dated KES price table, value dashboard, partner registry + matching, supply-profile export all live. Only remaining: sorting-site reconciliation (M5-F5) — needs real sorted weights from the pilot |
| M6 Cleanliness Index      | **done** (litter + public page later) | daily 0–100 per-area score from overflow + dumping + reliability signals, decomposable component breakdown, data-sufficiency guard, versioned methodology, stored daily for trends. Remaining: litter-density component (needs detection model), GeoJSON area boundaries + opt-in public page |
| M7 Carbon Impact          | **done** (external review pending) | cited factor table (`carbon-factors-v1.csv`), calc engine over M5 weights with method version + uncertainty ranges, dashboard, grant-report carbon block. Only remaining: external methodology review + Kenyan-context factors (governance ask, needs a reviewer) |
| Open Data API             | **done** | keyed aggregates-only public API (composition/cleanliness/collections by ward x week, JSON + CSV), small-cell suppression (< 3 bins or < 20 obs), 7-day delay, CC-BY-4.0, rate-limited; dashboard key management. Remaining: per-area publish opt-in (data-sovereignty gate) and a scrubbed dataset snapshot with the re-scan checklist |

These are tracked so we complete them **one module at a time, fully** — not half-built across the board. **All eight modules plus the Open Data API are now built.** What remains per module is data-gated calibration and governance follow-ups (real Safi sorting weights, external carbon review, litter-density model + public cleanliness page, per-area publish opt-in) — no unbuilt core features.

## Done

### UI/UX overhaul — Material UI + emerald theme (2026-07-13)

- **Both frontends rebuilt on Material UI (MUI v9)** with a single emerald design system, kept flat (solid fills + soft tints + light elevation, no gradients/glassmorphism). Charts stay on Apache ECharts (accent re-tuned to emerald); MUI covers layout, cards, grid, forms, tables, chips, icons.
- Shared emerald theme per app (`dash/src/theme.ts`, `app/src/theme.ts`): primary emerald `#059669`, neutral slate ink/muted, rounded surfaces, `CssBaseline`. Reusable page primitives in `dash/src/components/ui.tsx` (`PageStack`, `SectionCard`, `StatCard`, `Muted`) keep all 14 pages consistent.
- **Dashboard shell**: MUI `AppBar` (page title + language + sign-out) over a permanent light left `Drawer` with grouped icon nav (Operations / Intelligence / Records / Admin) and an emerald selected state; collapses to a temporary drawer on mobile. Airy `Container` content in card/grid layouts. **Split MUI sign-in** (brand panel + focused form).
- All 14 dashboard pages converted (Overview, Composition, Collect today, Routes, Recycling, Carbon, Cleanliness, Dumping, Bins, Reports, Review, Volunteers, Users) — behavior/i18n preserved, presentation-only. The dead hand-rolled `dash/src/styles.css` was deleted.
- **Field app** rebuilt on MUI too: `AppBar` + online `Chip` + settings, `BottomNavigation` (Report / Collect) with icons, `ToggleButtonGroup` fill picker, `Snackbar` toast, MUI forms — capture/GPS/offline-queue/sync logic untouched; old `app/src/styles.css` deleted, `theme-color` → emerald.
- Screenshots in `screens/` (`dashboard-{login,overview,recycling,routes,users}`, `fieldapp-report`). Both apps build green (tsc strict + eslint + vite); MUI adds ~140 KB gzip to each shell bundle.

### Open Data API (2026-07-13)

- Public, read-only, **aggregates-only** API under `/api/v1/public` — the hard governance boundary: no raw images, no coordinates, no bin identifiers ever leave it. Endpoints: `composition`, `cleanliness`, `collections`, each **ward x ISO-week**, plus a key-free `/meta` (license, delay, suppression rule, endpoints).
- **Small-cell suppression** (pure, unit-tested `analytics/public_data.py`): any ward-week cell backed by `< 3 bins` or `< 20 observations` is withheld, and the response reports `suppressed_cells`. **7-day delay**: nothing captured within the delay window is exposed. **CC-BY-4.0** attribution on every payload.
- **API keys** (`api_keys` table, migration 0012): admin mints a key (shown once, stored as an argon2 hash + lookup prefix), consumers pass it as `X-API-Key`; per-key sliding-window rate limit (60/min default). `api_consumer` role still can never reach raw observations. Keys are consumer identifiers, not tenants; per-area publish opt-in is a tracked follow-up.
- **JSON + CSV** responses (`?format=csv`) so counties/researchers can pull tables directly.
- Dashboard **Open Data** admin page: create/revoke keys (shown-once copy), key table (prefix, created, last used, status), and live public-API docs with an example request.
- Verified live: full smoke suite green including 11 new Open Data checks (meta public, missing-key 401, admin-only key creation, issue/list/query/CSV, revoke, revoked-key 401); 91 api unit tests (+3 public-data). **Open Data API is complete — all product modules are now done.**

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

### Real ML training (`/ml`, 2026-07-13)
- **T3 fill-level generalized** off Safi-specific bins → bin-type-agnostic (any bin photo; per-bin reference optional). Platform stays deployable by any operator.
- `train` optional dep group (PyTorch, torchvision, onnx/onnxscript); `make ml-setup / ml-data / ml-train / ml-register`
- `data/download.py`: pulls TrashNet (resized) → 2,528 real waste images mapped to OWI classes
- `train/classify.py`: real MobileNetV3 fine-tune → deterministic golden-split eval with the macro-F1 gate → ONNX export (legacy exporter) + labels.json + metrics.json
- `registry.py` CLI publishes to `POST /api/v1/models`; API register/activate/list endpoints (admin) — exactly one active model per task
- **Verified live end-to-end**: trained (loss 0.71→0.19, golden macro-F1 0.73 / 86% acc), exported valid ONNX (`onnx.checker`), registered + activated in the API registry. Gate correctly reports below-0.80 for a public-only baseline — refuses to bless an under-trained model
- Public-data strategy proven: pretrain on TrashNet now, fine-tune on the local Safi export when it exists; golden set stays local-only
- **Worker inference live (2026-07-13)**: model registration uploads the ONNX to the object store (`PUT /api/v1/models/{id}/artifact`) + stores class labels (migration 0008); the batch worker loads the active model's ONNX (cached), preprocesses with OpenCV, runs onnxruntime, and writes a Prediction per observation. Torch-free worker. Idempotent per (observation, model). Verified live end-to-end in containers: real glass image → worker → prediction `material=glass conf=0.9998` in the review queue. **The active-learning loop is closed** — corrections in the review queue feed the next training round
- **M1 composition (2026-07-13)**: `GET /api/v1/analytics/composition?days=&site_id=` aggregates each observation's effective material (human correction wins over prediction) into shares with previous-period deltas and a data-sufficiency guard (< 20 → flagged indicative); pure aggregator with 5 unit tests. Dashboard **Composition** page: period selector (7/30/90d), headline % tiles, ECharts bar, per-material change arrows, and drill-down to the filtered observations (`?material=`). Verified live (51/51 smoke checks)

### M5 Recycling Intelligence (2026-07-13)
- Dated KES price table (`material_prices`) — history revalues correctly (latest effective price ≤ today wins); dashboard editor
- Collections now estimate + store `estimated_weight_kg` (fill × volume × density) so tonnage is real; value engine splits that tonnage by composition share and prices each material (pure, 3 unit tests)
- `GET /api/v1/recycling/value` (per-material kg + KES + matching-partner count), partner registry + `partners/match` (accepts material AND meets monthly minimum), supply-profile HTML export for buyer negotiations
- Dashboard **Recycling** page: headline tiles (kg / est. value / partners), per-material value table, price editor, partner registry with material checkboxes
- Verified live in containers (55/55 smoke checks): tonnage → composition → priced value; missing prices correctly yield KES 0; partner matching respects material + minimum
- Honest: value chains two estimates (tonnage + photo composition), shown as indicative pending sorting-site calibration (M5-F5)

### M3 Illegal Dumping (2026-07-13)
- Governance-first: finds **locations, never people** (privacy gate blurs at ingestion); every candidate is **human-confirmed** before it becomes a record; site coordinates stay staff-only (no open API)
- Data model (migration 0010): dumping sites / events / candidates / interventions
- Review queue over non-bin (street) observations: confirm / reject / duplicate; confirm folds the point into a nearby site within 100 m (PostGIS `ST_DWithin`) or opens a new one, records an event, and re-derives status
- Recency×frequency **hotspot list** (pure helper, 4 unit tests), per-site **timeline** (events + interventions), **intervention tracking** with automatic recurrence detection (a confirmed event after a cleanup → status `recurring` — the module's real product: which interventions actually work), and coarse analytics (by weekday / area)
- Dashboard **Dumping** page: candidate review with photo, hotspot table with status badges, site panel with timeline + record-intervention
- Verified live in containers (61/61 smoke checks): street obs → candidate → confirmed site → double-review blocked (409) → cleanup intervention → status flips to cleaned

### M7 Carbon Impact (2026-07-13)
- Cited factor table `api/src/owi_api/data/carbon-factors-v1.csv` (per-material CO2e-avoided kg/kg + source: EPA WARM / IPCC), packaged via hatchling force-include; `GET /api/v1/carbon/factors` exposes it
- Calc engine (pure, 5 unit tests): CO2e avoided = M5 material weights × factors, with method version (`carbon-v1`) on every result and a ±30% uncertainty **range** (never a point); also landfill m³ saved, plastic diverted, and ≈trees / ≈car-km equivalents
- `GET /api/v1/carbon` and a dashboard **Carbon** page (range headline, per-material table, equivalents, "not offsets" notice + method version)
- Carbon block folded into the grant report (M7-F4): a range line + "informational, not tradable offsets" disclaimer
- Hard line honored: never presented as carbon credits; no factor without a citation, no number without a version
- Verified live in containers (63/63 smoke checks)

### M6 Cleanliness Index (2026-07-13)
- Weighted 0–100 per-area score (pure engine, 4 unit tests) from the signals other modules already produce: bin overflow (M2), illegal dumping proximity (M3, PostGIS distance + recency decay), collection reliability (M2/M4). Litter density (0.35) awaits the detection model, so v1 renormalizes weights over present components and says so
- **Decomposable** (M6-F2): every score returns its component breakdown; **data-sufficiency guard** (M6-F4): < 10 observations → "insufficient data", never a misleading score; **versioned methodology** endpoint (M6-F6, `cleanliness-v1`) framed as trends-not-shame, never a staff metric
- Daily snapshots (`cleanliness_daily`, migration 0011) recomputed by the scheduler + admin refresh, so trends have real history; `GET /cleanliness`, `/cleanliness/methodology`, `/cleanliness/trend`
- Dashboard **Cleanliness** page: per-area score badge + component bars + methodology note
- Verified live in containers (65/65 smoke checks): components compute, sufficiency guard withholds scores on thin data

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

### ML training/eval harness (`/ml`, 2026-07-13)

- **Public-data strategy is built in**: `data/taxonomy_map.py` folds public-set categories (TACO/TrashNet/Roboflow) into the OWI 8 classes → pretrain on public data, fine-tune on the local export. `data/coco.py` loads + merges COCO exports (local wins on conflict); `data/split.py` freezes a deterministic golden set by image-name hash so it never leaks into training
- `eval/metrics.py`: macro-F1 + per-class precision/recall/F1 — the frozen-golden-set go/no-go gate (≥ 0.80); 6 unit tests
- `train/classify.py`: T2 pipeline entrypoint — data prep/split/golden run today; the model fit is behind an optional `train` dep group + real images (documented). `registry.py` publishes a trained model to the API
- API model registry endpoints: `POST /api/v1/models` (admin, register + activate — exactly one active model per task) and `GET /api/v1/models`; the batch worker already queries active models, so activating a trained model makes predictions start flowing into the review queue
- 12 ml unit tests; verified live: model register/activate/list (admin-only), worker runs against the active model (48/48 smoke checks)
- **This is scaffolding**: real training runs when the labeled Safi dataset exists; a public-data-pretrained baseline can seed the review queue before then

## In progress / blocked on a human

- **Phone test of the PWA spike** (Android 10 / 2 GB) — validates the PWA-over-Flutter decision; the project's #1 risk. Owner: Brian.

## Next up (rough order)

1. Open Data API (Phase 3): aggregates-only public endpoints, small-cell suppression (< 3 bins / < 20 obs), API keys, 7-day delay, CC-BY attribution — the last module
2. Fine-tune on real Safi data once Phase 0 collection runs; push the baseline past the 0.80 golden gate
2. Privacy-gate recall eval: dedicated person-containing test set (target recall ≥ 0.99) once real field photos exist
3. M1 composition views + M5 recycling value on the dashboard (arrive with the classification model)
4. Grant report hardening: WeasyPrint server-side PDF; fold in composition (M1) + carbon (M7) sections once those land

With all six Phase 0 engineering tasks delivered, the remaining Phase 0 work is operational, not code: partner kickoff, bin registry data entry, collector training, capture-rate tracking (gate G0).
