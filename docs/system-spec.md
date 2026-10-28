# System Spec & Engineering Standards

This doc records the resolved architecture decisions and sets the engineering standards all code follows.

## Languages

| Layer                               | Language              | Runtime / tooling                                                           |
| ----------------------------------- | --------------------- | --------------------------------------------------------------------------- |
| Backend API, ingestion, workers, ML | **Python 3.12** | uv (env + deps), ruff (lint + format), pytest, mypy on `api/` and `ml/` |
| Dashboard + field app (PWA)         | **TypeScript**  | Vite, pnpm, eslint                                                          |
| Infra                               | YAML / SQL            | Docker Compose, Alembic migrations                                          |

Python everywhere on the server because OpenCV, ONNX Runtime, and OR-Tools are Python-native — one language from ingestion to analytics. TypeScript everywhere in the browser because the field app is a PWA (ADR-6), so dashboard and field app share one toolchain.

## Pinned components

| Component         | Pinned choice                                                                |
| ----------------- | ---------------------------------------------------------------------------- |
| Backend API       | FastAPI + Uvicorn                                                            |
| ORM / migrations  | SQLAlchemy 2.0 + Alembic + GeoAlchemy2                                       |
| Database          | PostgreSQL 16 + PostGIS 3.4                                                  |
| Queue / workers   | Redis 7 + RQ                                                                 |
| Object storage    | Garage (S3 API, single node); local-filesystem driver for dev/tests          |
| CV engine         | **OpenCV** (opencv-python-headless on server)                          |
| Inference runtime | ONNX Runtime, CPU                                                            |
| Routing           | OR-Tools + self-hosted OSRM (OSM Kenya extract)                              |
| Dashboard         | React 18 + Vite + TypeScript + Apache ECharts                                |
| Field app         | PWA: Vite + React + TypeScript, Workbox service worker, IndexedDB sync queue |
| Reports           | Print-optimised HTML; the browser's Save-as-PDF produces the A4 report       |
| Auth              | JWT + roles (admin / coordinator / collector / viewer / api-consumer)        |
| Deployment        | Docker Compose, single VPS or on-prem mini-PC                                |

## Engineering standards

### Code

- Python: full type hints; ruff enforces style; mypy runs in CI on `api/`.
- TypeScript: strict mode; API response types generated from FastAPI's OpenAPI schema (no hand-drift).
- Every table carries `org_id` (multi-tenant), soft deletes (`deleted_at`), UTC timestamps.
- **Tests are mandatory for anything that produces a published number** (bin health, cleanliness index, carbon, value estimates) and for ingestion invariants (dedupe, privacy status).
- Every ML prediction row stores model version + confidence; every analytics output stores method version.

### Governance in code

- Privacy gate runs at ingestion, before primary storage; originals containing people are quarantined and deleted ≤ 72 h after blur verification.
- Open API endpoints can only read from aggregate tables — no code path from public routes to raw observations or images.
- No feature, field, or log that identifies people or scores workers. PRs violating this are declined regardless of merit.

## Development environment

- `docker compose up` at the repo root brings up Postgres+PostGIS, Redis, Garage.
- `/api`: `uv sync && uv run alembic upgrade head && uv run uvicorn owi_api.main:app --reload`.
- CI (GitHub Actions): ruff + mypy + pytest on `/api` and `/ml`; tsc + eslint + build on `/app` and `/dash`.
- Licenses: Apache-2.0 (code)
