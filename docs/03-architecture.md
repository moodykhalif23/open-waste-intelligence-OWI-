# 03 — System Architecture

## Design principles

1. **Photos are the sensor.** No per-bin hardware. Everything derives from geotagged images plus a small amount of registry data (bins, trucks, routes).
2. **Offline-first, cheap-first.** The field app must work with zero connectivity; the whole backend must run on one modest server (≤ USD 50/month cloud, or an on-prem mini-PC at Safi's office).
3. **Batch over real-time.** Waste accumulates over hours and days. Inference that runs every 15 minutes is indistinguishable from real-time for every decision this system supports. This kills a whole class of cost and complexity.
4. **Human-in-the-loop by default.** Every prediction is reviewable and correctable; corrections become training data. The system gets better *because* Safi uses it.
5. **Privacy at the edge of the pipeline.** Face/person blurring happens at ingestion, before anything is persisted to primary storage.
6. **Everything replaceable.** Standard formats (COCO annotations, ONNX models, GeoJSON, Parquet) so no component locks us in.

## High-level architecture

```
┌────────────────────────────── FIELD ──────────────────────────────┐
│  Collector Android app (offline-first PWA or Flutter)             │
│  • QR/GPS bin identification  • photo capture + compression       │
│  • manual fill-level tap (label)  • route display  • sync queue   │
└─────────────────────────────┬─────────────────────────────────────┘
                              │ HTTPS sync (batched, resumable)
┌─────────────────────────────▼─────────────────────────────────────┐
│                        INGESTION SERVICE                          │
│  • auth, dedup, EXIF/GPS validation                               │
│  • PRIVACY GATE: person/face detection → blur → then store        │
│  • writes image → object store, metadata → DB, job → queue        │
└─────────────────────────────┬─────────────────────────────────────┘
                              │
        ┌─────────────────────┼──────────────────────┐
        ▼                     ▼                      ▼
┌───────────────┐   ┌──────────────────┐   ┌──────────────────┐
│ Object store  │   │  PostgreSQL      │   │  Job queue       │
│ (MinIO / S3)  │   │  + PostGIS       │   │  (Redis + worker)│
└───────────────┘   └──────────────────┘   └────────┬─────────┘
                                                    │
┌───────────────────────────────────────────────────▼──────────────┐
│                       ML INFERENCE WORKERS (batch)               │
│  OpenCV preprocessing → detection (YOLO-family, ONNX runtime)    │
│  → material classification → fill-level estimation               │
│  → scene change/dumping candidate flagging                       │
│  Results written back to DB with model version + confidence      │
└───────────────────────────────────────────────────┬──────────────┘
                                                    │
┌───────────────────────────────────────────────────▼──────────────┐
│                       ANALYTICS ENGINE                           │
│  • bin health scores        • composition aggregates             │
│  • overflow forecasting     • cleanliness index                  │
│  • route optimization (OR-Tools + OSRM)                          │
│  • carbon estimates         • recycling value (KES price table)  │
│  Scheduled jobs (nightly + on-demand); outputs to DB tables      │
└───────────────────────────────────────────────────┬──────────────┘
                                                    │
              ┌─────────────────────────────────────┼───────────────┐
              ▼                                     ▼               ▼
   ┌────────────────────┐              ┌─────────────────┐  ┌──────────────┐
   │ Ops Dashboard      │              │ Internal API    │  │ OPEN DATA API│
   │ (React web app)    │              │ (FastAPI, auth) │  │ (aggregates  │
   │ Amina, Wanjiru,    │              │ feeds dashboard │  │ only, keyed, │
   │ review queue       │              │ + field app     │  │ rate-limited)│
   └────────────────────┘              └─────────────────┘  └──────────────┘
```

## Component choices (proposed, with rationale)

| Component | Choice | Rationale / alternatives |
|---|---|---|
| Field app | **Flutter** (single codebase, strong offline story, camera control) | Alt: PWA — cheaper to build, weaker camera/offline. Decide via Phase 0 spike. |
| Backend API | **Python + FastAPI** | Same language as ML code; async; OpenAPI docs for free. |
| Database | **PostgreSQL + PostGIS** | Geospatial queries (nearest bin, ward aggregates) are core. One DB for everything at this scale. |
| Object storage | **MinIO** (self-host) or S3-compatible | Standard API; swappable. |
| Queue/workers | **Redis + RQ** (or Celery) | Simplest thing that supports batch inference jobs. |
| CV preprocessing | **OpenCV** | Resize, normalize, blur regions, perspective checks, duplicate detection. |
| Detection model | **YOLO-family → exported to ONNX** | Well-trodden for waste (TACO baselines exist). ONNX runtime keeps deployment license-clean and CPU-friendly. See ML strategy doc for licensing note on Ultralytics (AGPL) vs alternatives. |
| Routing | **Google OR-Tools** (VRP solver) + **OSRM/Valhalla** (road distances, self-hosted with OSM data) | Fully open-source stack; Kenya OSM coverage is good in urban areas. |
| Dashboard | **React + a chart library** | Standard, hireable. Server renders nothing fancy. |
| Reports | Server-side HTML→PDF | Grant reports must be pixel-stable. |
| Deployment | **Docker Compose on one VPS** (pilot) | k8s explicitly rejected at this scale. On-prem mini-PC variant documented for zero-cloud deployments. |
| Auth | Simple JWT + roles (admin, coordinator, collector, viewer, api-consumer) | Keycloak is overkill for pilot. |

## Key architectural decisions (ADR summaries)

### ADR-1: Phones over fixed cameras
Fixed cameras create cost (hardware, power, connectivity, theft risk) and privacy exposure (continuous filming of public space). Phones held by collectors capture images only during work, at known bins, with a human already present. Fixed cameras become an *opt-in extension* for site owners (e.g., a school gate) in a later phase, subject to the governance doc.

### ADR-2: Batch inference over real-time
No decision in this system needs sub-minute latency. Batch inference on CPU (or one small GPU) every N minutes cuts infra cost by an order of magnitude and lets us use bigger/better models than edge deployment would allow. On-device inference is a Phase 3+ optimization for instant collector feedback, not a foundation.

### ADR-3: Fill-level from photos + human tap, not sensors
A collector's one-tap fill estimate is simultaneously (a) immediately useful data, (b) a training label for the vision model, and (c) a fallback when the model is wrong. The model earns trust by matching human labels before anyone relies on it alone.

### ADR-4: One Postgres, not a data platform
At 150 bins × a few photos/day, we generate thousands of rows per day, not millions. PostGIS handles geo-aggregation; Parquet exports handle research use. Kafka/warehouse/lakehouse discussions are banned until data volume forces the issue.

### ADR-5: Open Data API serves aggregates only
Raw images and precise illegal-dumping coordinates never leave the internal system. The public API serves ward/site-level aggregates with k-anonymity-style thresholds (suppress cells with < 3 contributing bins). This is a hard line, detailed in the governance doc.

## Data flow example: one photo, end to end

1. Kevin photographs bin #43 → app compresses to ~300 KB, attaches GPS/time/bin-ID/fill-tap → queued locally.
2. Sync uploads it; ingestion validates, runs person detection, blurs a passerby's face, stores image + metadata, enqueues inference.
3. Worker (next batch, ≤15 min): detects waste objects, classifies materials (42% plastic…), estimates fill band (HIGH, 0.87 conf), writes results with model version.
4. Nightly analytics: bin #43 health score updates (fill 92%, 4 days since collection → overflow risk HIGH → "collect today"); composition aggregates for the estate update.
5. Morning: Amina's dashboard ranks bin #43 near the top; route optimizer includes it in Truck 1's route; Kevin sees it on his route screen.
6. Kevin collects it, photographs the emptied bin → closes the loop: collection event recorded, prediction vs. actual compared, disagreements queued for labeling review.

## Scale envelope (design targets)

| Dimension | Pilot | Design ceiling (no re-architecture) |
|---|---|---|
| Bins | 150 | 5,000 |
| Photos/day | ~300 | 20,000 |
| Organizations (multi-tenant) | 1 (Safi) | 20 |
| Dashboard users | ~10 | 500 |
| Open API consumers | ~5 | 200 |

Multi-tenancy is schema-level (`org_id` on every table) from day one — cheap now, painful to retrofit.
