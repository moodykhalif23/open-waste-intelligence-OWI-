# 07 — Roadmap & MVP Definition

## The MVP (end of Phase 1, ~month 6)

> **A collector photographs a bin in ≤ 20 seconds offline; by next morning the coordinator sees an accurate, ranked "collect today" list and this week's waste composition — and trusts both enough to act on them.**

Everything else (routes, dumping, value, index, carbon, volunteers, open API) builds on that loop. If that loop doesn't work, nothing else matters.

## Phase overview

| Phase                               | Months | Ships                                                                                                                                     | Gate                                                 |
| ----------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **0 — Foundation & Dataset** | 1–3   | Field app v0 (capture/offline/sync), bin registry + QR rollout, ingestion + privacy gate, labeling pipeline, baseline measurement         | G0: 5k+ images, 70%+ capture rate, baseline recorded |
| **1 — MVP: See the waste**   | 4–6   | Models T1/T2/T3, batch inference, review queue, dashboard v1 (M1 composition + M2 bin health), collect-today list                         | G1: model targets + coordinator adoption             |
| **2 — Act on it**            | 7–10  | M4 routes (OR-Tools + OSRM), driver route view, M3 dumping queue + hotspots, M5 recycling value, savings reports                          | G2: −15% km/tonne, −30% overflows                  |
| **3 — Prove & open it**      | 11–14 | M6 index, M7 carbon, M8 volunteers + grant reports, Open Data API, public dataset snapshot, deploy-anywhere docs                          | G3: grant application submitted, external usability  |
| **4 — Beyond (unscoped)**    | 15+    | Second-org deployment, on-device inference, opt-in fixed cameras, brand/EPR analytics, county dashboards, sensor fusion if ever justified | —                                                   |

## Build order within Phase 0 (first 6 engineering tasks when code starts)

1. Repo scaffolding: monorepo (`/app` field app, `/api` backend, `/ml` training, `/dash` dashboard, `/docs`), CI, licenses, this documentation moved in.
2. Data model migration v1 (Postgres + PostGIS): org/site/bin/user/observation tables.
3. Field app spike: Flutter vs PWA decision via a 1-week camera+offline+GPS prototype on a collector-class phone. **Decision ADR before building on.**
4. Ingestion service: upload, validate, dedupe, privacy-gate (off-the-shelf person detector + OpenCV blur), store.
5. Bin registry admin UI (can be crude) + QR generation/printing flow.
6. Label Studio deployment + export-to-COCO pipeline.

## Dependencies & critical path

```
Field app ──► Dataset ──► Models ──► M1/M2 ──► M4, M3, M5 ──► M6, M7 ──► Open API
     └────────────────────────────────────────────► M8 (independent, slot when capacity allows)
```

The critical path runs through **collector adoption** (week 2) and **dataset volume** (week 12). Both are human problems, not technical ones — staff them accordingly.

## What we deliberately do later

On-device inference (nice, not needed at 300 photos/day) · fixed cameras (governance-heavy) · multi-org SaaS polish (after a second org actually asks) · iOS app (collector phones are Android) · any real-time pipeline.
