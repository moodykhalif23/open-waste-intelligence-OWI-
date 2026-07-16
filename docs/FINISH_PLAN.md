# Finish Plan — every known gap, in priority order

Working checklist produced by a full-repo audit (2026-07-16). **STATUS.md stays the record of what
shipped**; this file is the to-do side. When an item ships, record it in STATUS.md and delete it
here; delete the whole file when it's empty.

Legend: effort **S**mall (≤½ day) / **M**edium (≤2 days) / **L**arge. Items marked ✅ shipped 2026-07-16.

## P0 — wiring defects (platform says it works, but the wire is cut)

| # | Item | Evidence | Effort |
|---|------|----------|--------|
| 1 | ✅ **Configurable collection methods** — trucks table/API/UI assumed motorized trucks only; handcart/bicycle/on-foot operators had no honest way to model their fleet, and non-motorized vehicles got phantom fuel litres | `models/route.py`, `routers/routes.py`, seed's "Tuktuk" shoehorned as a truck | M |
| 2 | **Seeded demo never produces predictions** — `seed.py` registers models without uploading an ONNX artifact and leaves classify inactive; the worker skips artifact-less models, so Composition / Recycling value / Carbon / Review stay empty after `make seed` | `api/scripts/seed.py:139-148` vs `worker/jobs.py:33-40` | M |
| 3 | **No inference backfill** — predictions are enqueued only at ingestion; activating a model after data exists never scores the backlog. Add `POST /api/v1/admin/inference/backfill` (admin) enqueuing unscored observations for active models | `ingestion/service.py:104` is the only `enqueue_inference` caller; `routers/admin.py` has no rescore | S |
| 4 | **Fill-model predictions are produced but never consumed** — worker writes `fill_band` payloads, but bin-health refresh reads only `human_fill_tap`; the entire fill-model path changes nothing user-visible | `worker/jobs.py:64` vs `analytics/refresh.py:43-56` | M |
| 5 | **Stale collect-today selection** — `overflow_risk != LOW` is applied *before* `DISTINCT ON (bin_id) … ORDER BY date DESC`, so a bin whose latest row is LOW is still selected via an older HIGH row; recently-collected bins keep reappearing in plans | `routers/routes.py:257-267, 334-345` | S |
| 6 | **Single-depot planning** — optimize/replan/savings all read the depot from `trucks[0]` only; per-vehicle depots are stored NOT NULL but ignored (seed even gives its 3 vehicles 3 different depots) | `routers/routes.py:246-249, 352-355` | M |
| 7 | ✅ **Prod compose can't carry optional settings** — the env anchor passed exactly 8 vars, so the documented `OWI_OSRM_URL` / `OWI_FUEL_PRICE_KES_PER_L` flows did nothing in prod | `docker-compose.yml:3-11` vs `docs/11-deployment.md:78` | S |
| 8 | **Plan persistence defects** — `_plan_and_persist` commits inside the per-vehicle loop (partial plans on mid-loop error); zero-stop routes are persisted as clutter; `/routes/optimize` doesn't supersede an existing same-day plan (duplicates stack — only `/replan` soft-deletes) | `routers/routes.py:372-390, 394-406` | S |
| 9 | **OSRM failure = 500** — `_plan_and_persist` catches only `ValueError`; a down OSRM raises httpx errors and turns planning into 500s instead of 422s | `routers/routes.py:358-367` | S |
| 10 | **`Route.status` lifecycle is dead** — enum has planned/active/done but only PLANNED is ever written; nothing marks a route done even when every stop is collected | grep `RouteStatus.` → only `routes.py:379` | S |
| 11 | **Unknown fill assumed 100%** — bins with no health rows inflate demand and can 422 every optimize on fresh datasets ("demand exceeds fleet capacity") | `routers/routes.py:153`, `weights.py:22` | S |
| 12 | **App sync pairing is positional** — server results map to queued reports by array index; any reorder/partial result deletes the *wrong* IndexedDB rows. Carry the client id in meta and match on it | `app/src/lib/sync.ts:40-58` | S |
| 13 | **Driver taps have no offline path** — `doStop`/`doBin` are un-caught awaits; a network drop loses the tap and the tab degrades to an error alert. Queue completed stops like reports | `app/src/components/CollectList.tsx:52-60` | L |
| 14 | **Stranded/vanishing queue entries** — reports with no GPS *and* no QR sync never (promised GPS retry doesn't exist); rejected reports are deleted silently (toast set to null). Add per-report queue UI + rejection notice | `app/src/lib/sync.ts:22-46`, `app/src/App.tsx:71, 317-329` | M |
| 15 | **Concurrent sync double-POSTs** — online event + post-save hook + manual button can run `syncQueue` simultaneously; only server dedupe saves us. Add an in-flight guard; chunk large backlogs (one giant multipart POST can exceed body limits and wedge the queue) | `app/src/App.tsx:66-90,137,325`, `sync.ts:26-35` | S |
| 16 | **Offline-first dead on LAN pilots** — self-signed certs block service-worker registration (admitted in code), which is exactly the promoted `make web` LAN mode; also manifest has no 192/512 PNG icons so Android install is degraded, and `/api` has no runtime caching (Collect/Insights are 100% network) | `app/src/main.tsx:17-26`, `app/vite.config.ts:32`, `Makefile:27` | M |
| 17 | **Caddy site blocks are host-bound to `localhost`** — phones opening `https://<server-ip>:8443` don't match the site block; no doc says to set `DASH_DOMAIN`/`APP_DOMAIN` to the LAN IP | `deploy/Caddyfile:3,15` vs `docs/11-deployment.md:53` | S |
| 18 | ✅ **No restart policies** — a VPS reboot left the whole platform down until `make up` | `docker-compose.yml` | S |
| 19 | **DB/Redis/MinIO/Label Studio ports published unconditionally** in prod (redis unauthenticated); Label Studio has no profile so it boots even when unused | `docker-compose.yml:20-21,32-33,46-48,65-66` | S |
| 20 | **MapView never refits** — react-leaflet `MapContainer` props are immutable after mount; after Replan the viewport is stale. Use a child component with `map.fitBounds` | `dash/src/components/MapView.tsx:38-45` | S |
| 21 | **collect_stop race** — two simultaneous collects on one stop both pass the `collected` check → duplicate CollectionEvents | `routers/routes.py:308-320` | S |
| 22 | **`/routes/savings` runs two CVRP solves per GET** (5 s time limit each) uncached — slow and easy to hammer | `routers/routes.py:228-295` | S |
| 23 | **CI never exercises the person-detector** — the only real-inference test is skipped when weights are absent and CI never fetches them; privacy-gate regressions ship green | `api/tests/test_person_onnx.py:33`, `.github/workflows/ci.yml` | S |
| 24 | **bootstrap is not idempotent** — re-running with the same phone can leave an orphan Organization row | `owi_api/bootstrap.py` | S |

## P1 — product hygiene (missing CRUD, honesty, i18n)

- **No update/delete/deactivate anywhere in the registry**: bins, sites, users, vehicles are create-and-list only; `Truck.active` and all `deleted_at` columns are dead — a mistyped bin volume (drives route demand!), a moved bin, a retired vehicle, or a departed employee can never be corrected. Add PATCH + soft-DELETE with planner/admin roles. (M) — when adding, also fix `GET /bins/health` joins that lack `deleted_at` filters (`routers/operations.py:85-89`).
- **No password change/reset flow** — a forgotten password is a permanent lockout; admin can't reset, user can't rotate. (S)
- **TruckOut omits depot + active** so the dash can never display or correct a depot. (S)
- **Dead columns**: `CollectionEvent.post_observation_id`, `Bin.reference_photo_ref` — wire them or drop them in the next migration. `ApiKey.created_by` lacks its FK. (S)
- **`DumpingSite.area` never populated** → dumping analytics `by_area` is always `{"unknown": n}`. Derive from nearest site/ward at confirm time. (S)
- **Shared `EmptyState` component** (icon + one-liner + CTA) replacing ~16 bare `<Muted>` texts; Users page shows MUI's untranslated "No rows" overlay today; loading states blank whole pages (skeletons preserve layout). (M)
- **i18n debt**: 8 dead keys (`reportsTotal` etc. imply an unbuilt Reports stat row — build or delete); raw enum values shown to users (roles, site types, `location_source`, `privacy_status`, Review task chips); Overview weekday labels hardcoded English; `t()` lacks interpolation (manual `.replace` at 3 call sites); app `t()` replaces only the first placeholder occurrence. (M)
- **Dash forms swallow errors** — TruckForm (fixed ✅), Site/Bin/Price/Partner/Event forms have no try/catch, no busy state; failed POSTs do nothing visibly. NaN depot inputs serialized as null (fixed ✅ for vehicles). (S)
- **No API-level integration tests** — all 88+ unit tests are pure; router auth/org-scoping is only covered by live smoke. Add a testcontainers (or SQLite-PostGIS-stub) conftest with a TestClient. (L)
- **App Collect stops show only the QR code** — no site name, no map, though lat/lng are already fetched. (S)
- **Route-first Collect view shadows due bins not on any route**; 401 (revoked token) renders as "needs connectivity". (S)
- **seed.py**: route plan skipped when no bin is due after refresh — make seed guarantee ≥1 due bin; upload demo ONNX artifacts (fixes P0-2). (M)
- **In-process rate limiters** reset on restart and silently stop protecting under multi-worker uvicorn — document the single-process constraint or move to Redis. (S)
- **STATUS.md self-contradictions** (✅ fixed): "Next up" still listed shipped modules; "placeholder job" wording predates live inference.
- **docs/05-data-model.md** promised a truck "fuel type" that never existed (✅ now `method`).

## P2 — unbuilt features from module specs (build when prioritized)

- **M2-F5** overflow WhatsApp/SMS digest (M) · **M2-F7** bin history page w/ fill curve (S)
- **M4-F4** plan-vs-actual GPS breadcrumbs — governance: only while route active (L) · **M4-F6** what-if scenario runner (M)
- **M8-F2** volunteer spreadsheet import (S) · **M8-F6** certificates + WeasyPrint server-side PDF for grant reports (M)
- **GPS-nearest-bin fallback** (PRD Flow A): GPS-only reports currently store `bin_id NULL` and feed no bin health; add a ≤30 m `ST_DWithin` match + nearby-bins picker in the app (M)
- **Active-learning export**: review corrections (`corrected_payload`, `human_fill_tap`) are stored but never exported to training — close PRD FR11 by generating a COCO/CSV snapshot from corrections (M)
- **Trainers for fill/detect/dumping tasks** — only classify has one, though the worker + Review UI already handle all four task types (L)
- **Classifier past the 0.80 golden gate** — TrashNet-only baseline (0.73) also *cannot* predict organic/e-waste/textile (3 of 8 classes absent from training data); needs the local labeled export (L, data-gated)
- **Privacy-gate recall eval** — person-containing test set, target recall ≥ 0.99 (M, data-gated)
- **M6 litter-density component + GeoJSON boundaries + opt-in public cleanliness page** (L, model-gated)
- **Open Data per-area publish opt-in + scrubbed dataset snapshot** with re-scan checklist (M)
- **Self-serve API key registration** (PRD Flow D) — keys are admin-issued only today (S)

## Gated on humans/data, not code

- Phone test of the PWA on the pilot device (Android 10 / 2 GB) — **project #1 risk, owner Brian**
- M1-F4 sorting ground-truth calibration; M5-F5 sorting-site reconciliation (need pilot weights)
- M7 external carbon methodology review (Kenyan-context factors)
- Deployment checklist (`docs/11-deployment.md`) and governance dataset-release checklist (`docs/08`) — unchecked
- `.env` template in docs omits `OWI_S3_ACCESS_KEY`/`OWI_S3_SECRET_KEY` needed by `ml/config.py` for Label Studio sync (S, doc fix)

## E2E verification runbook (what "everything wired" means)

1. `cd api && uv run ruff check && uv run ruff format --check && uv run mypy && uv run pytest` — all green
2. `dash`/`app`: `pnpm check && pnpm build` — both green
3. `make web` (compose prod profile) → 8 services healthy, migrations auto-applied
4. Bootstrap admin → `make seed PASSWORD=…` → dashboards populated
5. `python api/scripts/smoke.py http://localhost:8000 <phone> <pw>` — full suite green
6. Manual: dashboard login → Routes: add a handcart → Plan today → field app Collect shows the route with its method → mark stop collected
