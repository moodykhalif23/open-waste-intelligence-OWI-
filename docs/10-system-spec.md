# 10 — System Spec & Engineering Standards

This doc pins the decisions [03-architecture.md](03-architecture.md) left open, and sets the engineering standards all code follows from day one. Where this doc and 03 differ, this doc wins (it is newer and records resolved ADRs).

## Languages

| Layer | Language | Runtime / tooling |
|---|---|---|
| Backend API, ingestion, workers, ML | **Python 3.12** | uv (env + deps), ruff (lint + format), pytest, mypy on `api/` |
| Dashboard + field app (PWA) | **TypeScript** | Vite, pnpm, eslint + prettier |
| Infra | YAML / SQL | Docker Compose, Alembic migrations |

Python everywhere on the server because OpenCV, ONNX Runtime, and OR-Tools are Python-native — one language from ingestion to analytics. TypeScript everywhere in the browser because the field app is a PWA (ADR-6), so dashboard and field app share one toolchain.

## Resolved ADRs (were open in 03/04)

### ADR-6: Field app is a PWA, not Flutter
One TypeScript stack with the dashboard, instant updates without app-store review, zero install friction for collectors. Camera + GPS + offline (service worker + IndexedDB queue) on Android Chrome covers Flow A's needs. **Escape hatch:** the Phase 0 spike on a real collector-class phone (Android 10, 2 GB RAM) validates camera quality and offline sync; if it fails, revisit Flutter before building further.

### ADR-7: Detector is Apache-2.0-licensed (RT-DETR family), not Ultralytics
Ultralytics YOLOv8/11 is AGPL-3.0. OWI promises "all code Apache-2.0, any component replaceable" — an AGPL model pipeline taints that promise for downstream deployers. Baseline: **RT-DETR (or RF-DETR) fine-tuned TACO → Safi dataset, exported to ONNX**, run on CPU via onnxruntime. Ultralytics may be used for private experiments/benchmarks only; nothing it produces ships in the repo.

### ADR-8: Charts are Apache ECharts, exclusively
Every chart in every surface (dashboard, reports, public pages) uses Apache ECharts (Apache-2.0, canvas-based, fast at our data volumes, themeable to our flat UI). No second chart library, ever — consistency and bundle size beat per-chart convenience.

## Pinned component versions of the 03 table

| Component | Pinned choice |
|---|---|
| Backend API | FastAPI + Uvicorn |
| ORM / migrations | SQLAlchemy 2.0 + Alembic + GeoAlchemy2 |
| Database | PostgreSQL 16 + PostGIS 3.4 |
| Queue / workers | Redis 7 + RQ |
| Object storage | MinIO (S3 API); local-filesystem driver for dev/tests |
| CV engine | **OpenCV** (opencv-python-headless on server) |
| Inference runtime | ONNX Runtime, CPU |
| Routing | OR-Tools + self-hosted OSRM (OSM Kenya extract) |
| Dashboard | React 18 + Vite + TypeScript + Apache ECharts |
| Field app | PWA: Vite + React + TypeScript, Workbox service worker, IndexedDB sync queue |
| Reports | Server-side HTML → PDF (WeasyPrint) |
| Auth | JWT + roles (admin / coordinator / collector / viewer / api-consumer) |
| Deployment | Docker Compose, single VPS or on-prem mini-PC |

## Repo layout (monorepo)

```
/api      FastAPI backend: ingestion, registry, analytics, open API, workers
/ml       training, eval, dataset tooling, model registry
/app      field PWA (collector)
/dash     ops dashboard (React + ECharts)
/infra    docker-compose, deploy docs
/docs     this documentation
```

## Engineering standards

### Code
- **Comments: at most 3 lines, and only to state a *why* the code cannot show** (a constraint, a governance rule, a calibration source). Never restate what the code does. Zero tolerance for comment flooding.
- Functions stay as short as their idea: if it fits in 1–2 lines, it is 1–2 lines. No padding, no speculative abstraction.
- Python: full type hints; ruff enforces style; mypy runs in CI on `api/`.
- TypeScript: strict mode; API response types generated from FastAPI's OpenAPI schema (no hand-drift).
- Every table carries `org_id` (multi-tenant), soft deletes (`deleted_at`), UTC timestamps.
- **Tests are mandatory for anything that produces a published number** (bin health, cleanliness index, carbon, value estimates) and for ingestion invariants (dedupe, privacy status).
- Every ML prediction row stores model version + confidence; every analytics output stores method version.

### UI (dashboard + field app + public pages)
- **Flat and clean from day one: no gradients, no glassmorphism, no ornament.** Whitespace, typography, and a restrained palette do the work.
- Scalable, responsive, fast: mobile-first layouts, code-split routes, ECharts canvas renderer, no heavyweight UI kit — small composable components.
- All strings in i18n files (English + Swahili) from the first screen; nothing hardcoded.
- Data displays follow the product vision's plain tabular style (e.g., the Bin #43 card) — numbers first, chrome last.

### Governance in code (from [08-data-governance-ethics.md](08-data-governance-ethics.md))
- Privacy gate runs at ingestion, before primary storage; originals containing people are quarantined and deleted ≤ 72 h after blur verification.
- Open API endpoints can only read from aggregate tables — no code path from public routes to raw observations or images.
- No feature, field, or log that identifies people or scores workers. PRs violating this are declined regardless of merit.

## Development environment

- `docker compose up` in `/infra` brings up Postgres+PostGIS, Redis, MinIO.
- `/api`: `uv sync && uv run alembic upgrade head && uv run uvicorn owi_api.main:app --reload`.
- CI (GitHub Actions): ruff + mypy + pytest on `/api`; eslint + tsc + vitest on `/dash` and `/app` once they exist.
- Licenses: Apache-2.0 (code) — add `LICENSE` at first public release per README's pending confirmation.

## Kickoff order (matches roadmap build order, statuses live here)

1. ✅ Repo scaffolding (this doc, monorepo dirs, CI, tooling)
2. ✅ Data model migration v1: org / user / site / bin / observation
3. ⬜ Field app spike (PWA camera + offline + GPS on a collector-class phone) — validates ADR-6
4. ✅ Ingestion service skeleton: upload, validate, dedupe, privacy gate, store, enqueue
5. ⬜ Bin registry admin UI + QR generation flow
6. ⬜ Label Studio deployment + COCO export pipeline
