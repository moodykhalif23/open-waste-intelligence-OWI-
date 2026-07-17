# Build Status — single source of truth

**This is the only place build progress is tracked.** Other docs describe the product and its plans; when something ships, it gets recorded here and removed from any checklist elsewhere. The open-work backlog lives in `docs/FINISH_PLAN.md` (delete it when empty). Last updated: **2026-07-16**.

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

### Track D — landing page (2026-07-17)

- New `site/` — static Vite + vanilla TS (no framework): **8.4 KB CSS + 1.2 KB JS + self-hosted Inter Variable, zero external requests**. Sections alternate white/cream bands cut by hairlines, two gold rule-with-mark "moment" dividers, one dark-brown impact band — dividers instead of cards throughout, per the brief.
- **10 custom inline SVGs** drawn in the brand's flat geometric language (ink/gold/brown): photo-as-sensor, sorting loop, route pin, open ledger, leaf-on-scale, gate chart, licensed-document seal, human↔model review loop, privacy shield, mkokoteni handcart. No icon library.
- Content = mission (the Safi story in prose), sustainability (KES/kg, CO₂e *range*, km/tonne, 0–100 index — each with its honest qualifier + the explicit "never sold as offsets" line), **"The AI, honestly"** (the 0.80 golden gate, licensed-data-only policy, the closed review→retrain loop, blur-before-storage), governance hard lines, built-for-the-field (incl. handcarts), open-source deploy.
- Motion: one pattern only — 300 ms rise-and-fade per section, once, IntersectionObserver, disabled under `prefers-reduced-motion`. Anti-vibecoded checklist honored: no gradients, no emoji, no purple, no fake numbers, zero exclamation marks.
- Served by Caddy from the same `web` image at `LANDING_DOMAIN` (default **https://localhost:8085**; real domains get automatic TLS); `deploy/web.Dockerfile` builds all three frontends. Verified live alongside dash/app; desktop + mobile screenshots in `screens/landing-*.png`. (During verification: learned headless-Edge clamps window width ~500 px — the "mobile clipping" was the tool, not the page.)
- Follow-ups noted in FINISH_PLAN: real canonical/OG URL when a domain exists, OG image, optional Kiswahili version.

### Track C — premium UI/UX pass, both apps (2026-07-17)

- **Typography is real now**: Inter Variable self-hosted in dash + app (`@fontsource-variable/inter`, no CDN — works offline/LAN); every fractional weight the themes specify (450/620/690/720) finally renders as designed on all OSes instead of snapping to 400/700. ECharts canvas text uses the same family. Tabular numerals across tables, DataGrid, chips, stat values — and the DataTable flex-cell bug that broke right-alignment of numeric columns is fixed.
- **Skeletons + honest errors everywhere**: shared `StatRowSkeleton`/`TableSkeleton`/`PageSkeleton` primitives replace all 16 text-only "Loading…" gates (zero layout shift); a `useApi` hook + shared `ErrorPanel` with Retry ends the "failed fetch = stuck on Loading forever" bug on every dash page.
- **Empty states carry the next action**: shared `EmptyState` (icon tile + title + hint + CTA) replaces every bare "no data" line — including Users' untranslated DataGrid "No rows" overlay and Overview's flat-zero line chart, which now honestly says there's no data instead of drawing a zero line.
- **Motion baseline** (there was literally zero transition code): 120 ms hover/press on buttons/chips/tabs/nav, press-scale feedback, 200 ms route-content entrance keyed on pathname, a 2 px gold LinearProgress as the lazy-route fallback (was `null` → white flash), all disabled under `prefers-reduced-motion`.
- **Orientation**: AppBar shows "Section › Page" breadcrumbs (leaf bold), `document.title` is per-page ("Carbon · OpenWaste"), Ctrl+K focuses the jump-to-page search (with a `kbd` hint). Gold `:focus-visible` ring app-wide (WCAG 2.4.7); warm thin scrollbars; mimosa selection color; AppBar backdrop-blur replaced with solid white (glass rule).
- **Field app installability + ergonomics**: real 192/512 + maskable launcher PNGs rasterized from the brand SVG (manifest + apple-touch-icon), `beforeinstallprompt` banner ("Install OpenWaste — works offline", dismissible, EN+SW), safe-area insets on the bottom nav/snackbar (gesture-nav phones), sticky Save row within thumb reach while a photo is staged, a persistent amber "N reports queued" bar when offline so collectors trust the queue, 48 px settings target, stop-badge style cleanup.
- Login: busy spinner on submit (dead-feeling on slow networks before), outlined error Alert with a subtle shake, radius snaps. Detail sweep: 6/8 px radius violations → 4 px, off-grid paddings snapped, chart resize via ResizeObserver (reflows on drawer toggle), stale "emerald" comments fixed.
- Mechanics: 16 dash pages converted in parallel (one agent per file over shared primitives), zero compile errors on first assembly; verified serving via Caddy; screenshots in `screens/`.

### Track B — active-learning loop closed (B9, 2026-07-17)

- **Uncertainty sampling**: the review queue now serves the model's least-confident predictions first (`payload.confidence` ascending) — reviewer effort lands where a correction teaches the most. Verified live: queue head confidences 0.36/0.37/0.37 out of 280.
- **Training-labels export**: `GET /api/v1/predictions/export?task=classify|fill` (admin, audited) — one deduped label per observation, newest reviewed prediction wins, corrections beat confirmations, collector fill-taps are direct ground truth for the fill task; erased/retention-purged images are excluded.
- **Corrections → training folders**: `python -m owi_ml.data.export_reviewed` downloads each labeled observation's blurred image into `datasets/safi/<label>/safi_<obs>.jpg` — the exact layout the trainer eats; idempotent (re-runs only pull new reviews). The trainer now accepts multiple `--data` roots, so `--data datasets/merged datasets/safi` fine-tunes public+local, and `--data datasets/safi` alone re-freezes the Safi-local golden set for Gate B.
- **Cadence**: `make ml-export` / `make ml-retrain` (export + retrain; registering the result stays a deliberate human step after checking the gate). Verified live end-to-end: 3 predictions reviewed (2 confirm + 1 correct→plastic) → export → 3 images in the right class folders → re-run idempotent. **106/106 smoke checks** (2 new).

### Track B — classifier past the golden gate on licensed public data (2026-07-17)

- **Gate A PASSED: golden macro-F1 0.9543** (gate ≥ 0.80), accuracy 96.6% on a 3,964-image frozen golden split — up from the 0.73 TrashNet-only baseline. Per-class F1 ≥ 0.846 everywhere; the three classes the old model could never predict are now the strongest (e_waste 0.991, organic 0.983, textile 0.998). Registered + activated as `classify/dinov2-v1` (artifact in the object store).
- **Corpus**: manifest-driven downloader (`data/download.py`) pulls TrashNet (MIT, 2,528) + Garbage Dataset v2 (CC BY 4.0, 36,777, anonymous kagglehub) folded to the 8 OWI classes; **license policy is code-enforced** (`ml/DATA_LICENSES.md` + per-source `shippable` flag — NC/unverifiable sources can't reach the training tree).
- **Dedup mattered**: cross-source dHash (`data/dedupe.py`) removed **12,881 duplicates (33% of raw)** before the hash-frozen split — without it the gate score would have been leak-inflated. Final corpus 26,424 unique images.
- **Recipe for a GPU-less machine**: DINOv2 ViT-S (Apache-2.0, timm) frozen backbone + inverse-frequency-weighted linear head (cosine LR, label smoothing); one bounded CPU feature pass (~3 h on the pilot laptop), head trains in minutes and is instantly re-trainable. ONNX export unchanged on the worker's 224²/ImageNet contract; per-class F1 persisted in `metrics.json`. `--backbone mobilenet` keeps the old path; ConvNeXt fine-tune is the GPU upgrade path.
- **Inference backfill** (`POST /api/v1/admin/inference/backfill`, admin, audited): enqueues every observation active models haven't scored — activation is now retroactive. Verified live: 280 observations backfilled, worker drained the queue, **review queue holds 280 predictions and Composition computes (`sufficient=true`) for the first time from a legitimately gated model**. (Seeded demo images are synthetic noise, so demo shares are meaningless by design — real field photos produce real composition.)
- Honest remaining line: **Gate B** — re-freeze a Safi-local golden set from review-queue corrections before claiming production accuracy on Nairobi street photos; public-set accuracy does not transfer automatically. Tooling: `uv` now installed on the dev machine; ml lockfile carries `timm` + `kagglehub`.

### Enterprise Track A part 2 — per-org config, MFA, readiness, notifications (2026-07-16)

- **Per-org operational config** (migration 0016): `fuel_price_kes_per_l` and `waste_density_kg_per_l` on `org_settings` (nullable → deployment default); consumed by route demand (`_bin_demand`), collection-weight estimates, and the savings report; partial-PATCH `/api/v1/admin/settings`; dash Settings covers every knob.
- **TOTP MFA** (migration 0017, zero new dependencies — RFC 6238 in stdlib with RFC test vectors in the suite): enroll → QR (segno, served only during enrollment) → activate returns 8 single-use argon2-hashed recovery codes → login challenges with `otp required`; disable needs a valid code; dash: OTP field appears on demand at login + account-menu **Two-factor auth** dialog (EN+SW); `mfa.enable/disable` audited. Full lifecycle smoke-tested incl. spent-recovery-code rejection.
- **Readiness** : `GET /readyz` pings DB, Redis, and the object store (healthz was process-liveness only); compose healthcheck turns the api service `(healthy)`.
- **Notifications + M2-F5 overflow digest** (migration 0018): provider adapters for **Africa's Talking SMS** and **WhatsApp Cloud** over httpx with a console/log fallback (path exercisable with zero credentials — creds via `OWI_AT_*`/`OWI_WA_*` in `.env`); `notifications` delivery-log table + admin log endpoint; per-org alert phones in Settings; scheduler sends the digest once daily in the 6–8 am window, `POST /api/v1/admin/notifications/digest` sends on demand (audited).
- Verified live: **103/103 smoke checks** (14 new), 108 api unit tests, mypy strict, both frontends green, api container healthy.

### Enterprise Track A — backups, audit, retention, DSAR, tenant scoping (2026-07-16)

- **Automated backups + restore drill**: compose sidecars `db-backup` (nightly rotated pg_dump → `var/backups/postgres`, 14d/8w/6m) and `minio-backup` (daily image mirror, **quarantine excluded and deletions propagate** so erased images never survive in backups); `make backup` / `make restore CONFIRM=yes`; a full backup→destructive-restore→smoke drill was executed live.
- **Append-only audit log** (migration 0014): `record_audit` joins the mutation's transaction; wired into user create/erase/export, token revoke, device-token issue, API-key create/revoke, model register, prediction review, quarantine purge, retention purge, org settings, observation erase, org export. Admin-only `GET /api/v1/admin/audit` + dash **Admin → Audit** page (DataGrid, EN+SW).
- **Retention engine** (migration 0015): per-org `image_retention_months` (default 24) in the new `org_settings` table; hourly scheduler job aggregate-then-deletes expired operational images (`image_deleted_at` stamp, image endpoint returns 410); on-demand `POST /api/v1/admin/images/purge`; dash **Admin → Settings** page. Closes the docs/08 promise that had no implementation.
- **DSAR / erasure** (docs/08 + Kenya DPA): `DELETE /api/v1/observations/{id}` — the collector "do-not-use" flag (photo hard-deleted from store incl. quarantine, row retired, collectors limited to their own reports) with a **"Sent reports" delete surface in the field app**; `GET /users/{id}/export` (access/portability JSON) + `DELETE /users/{id}` (anonymize name/phone, kill tokens, de-attribute observations/collections — aggregates stay); `GET /api/v1/admin/export` org-exit zip (one CSV per org-scoped table, geometry as lat/lng, password hashes excluded).
- **Public API tenant scoping**: composition/collections/cleanliness aggregates are now scoped to the API key's org (previously cross-org!) and every payload carries per-org attribution from the organizations table — "Safi Cleaners and Recyclers" is no longer hardcoded in code.
- **Deploy hardening**: `minio`/`mc`/`label-studio` images digest-pinned, `osrm` on v5.27.1; migrations moved to a one-shot `migrate` service that gates api/worker/scheduler (`service_completed_successfully`) — no more migration races.
- **Latent bug fixed**: ~39% of minted Open-Data API keys were rejected as "malformed" (urlsafe-base64 tail can contain `_`, validator split on every underscore). All previously-minted keys work after the `split("_", 2)` fix.
- Verified live end-to-end: **89/89 smoke checks** (11 new), 99 api unit tests, mypy strict, both frontends build green.

### Configurable collection methods — manual collection is first-class (2026-07-16)

- **Vehicles now carry a `method`**: truck / tricycle (tuk-tuk) / motorbike / bicycle / handcart / on-foot (migration 0013, enum `collection_method`; existing rows default to `truck`). The CVRP planner already only cared about capacity, so every method routes correctly; **non-motorized methods are forced to 0 L/100km** at creation and the savings report averages fuel over motorized vehicles only — no more phantom fuel litres for a handcart.
- **Adding a new method is one enum member + one spec line** (`api/src/owi_api/fleet.py`): defaults (capacity, fuel, motorized) are served by `GET /api/v1/collection-methods` (authenticated), so both frontends render whatever the backend defines — 6 unit tests.
- Dashboard Routes page: method selector on the (renamed) "Add vehicle" form pre-fills per-method defaults and hides the fuel field for manual methods; fleet table + route cards show the method (fuel chip hidden when 0); form got error/busy handling and depot NaN validation. Field app driver view shows the method under the vehicle name. EN + SW labels (mkokoteni, tuktuk, pikipiki…).
- Manual collection *without* routes was already live (`POST /collections` from the app's Collect fallback + dash mark-collected) — unchanged, now documented.
- Seed fleet is method-typed (2 trucks, tuk-tuk as `tricycle`, new `handcart` crew); smoke suite gained 4 checks (catalog served + auth-gated, manual vehicle forced to zero fuel, routes report their method).
- Ops fixes: compose now forwards optional `OWI_OSRM_URL` / `OWI_FUEL_PRICE_KES_PER_L` / public-API tuning from `.env` into containers (documented flows previously did nothing in prod) and every service has `restart: unless-stopped`.
- Full-repo audit written to `docs/FINISH_PLAN.md` — prioritized backlog of every remaining defect/gap.

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
- Ingestion service: batch upload → dedupe → privacy gate (person blur before storage, quarantine of originals) → object store (MinIO/local) → inference queue (Redis + RQ; live worker inference since 2026-07-13)
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
- `make web` one-command launcher (Makefile at repo root: web / up / down / logs / ps / smoke / seed / bootstrap / clean); `make seed` loads a realistic, idempotent demo dataset (`api/scripts/seed.py`) so a fresh install isn't empty; screenshots live in the gitignored `screens/`
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

## Next up

The full prioritized backlog (wiring defects → product hygiene → unbuilt module features → data-gated
items) lives in **`docs/FINISH_PLAN.md`**. Top of that list: make the seeded demo produce predictions
(artifact upload + inference backfill), fix stale collect-today selection + single-depot planning,
then fine-tune the classifier past the 0.80 golden gate on real Safi data.

With all six Phase 0 engineering tasks delivered, the remaining Phase 0 work is operational, not code: partner kickoff, bin registry data entry, collector training, capture-rate tracking (gate G0).
