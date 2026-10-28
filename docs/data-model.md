# Data Model & APIs

This document distinguishes implemented runtime behavior from design targets.
The entity outline is conceptual; the API tables below list current implemented
routes and explicitly identify planned routes.

## Core entities

```
Organization ─┬─ User (role: admin | coordinator | collector | viewer)
              ├─ Site (estate, school, market, business, public area)
              │    └─ Bin (id, QR code, geo point, volume_liters, type, reference_photo)
              ├─ Vehicle "Truck" (method: truck|tricycle|motorbike|bicycle|handcart|on_foot,
              │                   capacity_kg, fuel_l_per_100km — 0 for manual methods, depot)
              └─ MaterialPriceTable (material → KES/kg, effective_date)

Observation  (the atomic record — one photo event)
  ├─ id, org_id, captured_at, synced_at
  ├─ location (PostGIS point), location_source (gps | bin_registry)
  ├─ bin_id (nullable — street/dump observations have none)
  ├─ collector_id, image_ref (object store key), image_quality_flags
  ├─ human_fill_tap (nullable enum)
  └─ privacy_status (clean | blurred | quarantined)

Prediction   (ML output, versioned, many per observation)
  ├─ observation_id, model_id, task (detect|classify|fill|dumping)
  ├─ payload (JSONB: boxes, classes, confidences / fill_band + conf)
  └─ review_status (unreviewed | confirmed | corrected), corrected_payload

CollectionEvent
  ├─ bin_id, collector_id, occurred_at, route_stop_id (nullable)
  ├─ post_observation_id (nullable)
  └─ estimated_weight_kg (excluded from totals when its route has a measured weight)

Route
  ├─ date, truck_id, status (planned | active | done)
  ├─ stops[] (ordered bin_ids)
  ├─ started_at, completed_at, started_by_user_id
  └─ planned_km/fuel_l, actual_distance_km, actual_fuel_l, actual_weight_kg
     (actual duration is derived from started_at and completed_at)

The field app tracks GPS only while a collector explicitly starts a route. GPS fixes are
used transiently to calculate aggregate distance; raw coordinates are not sent to or
stored by the API. Fuel used and weighed waste are entered at route completion. Measured
route tonnage replaces estimated stop weights in recycling and carbon collection totals.

DumpingSite  (human-confirmed only)
  ├─ geo point (internal precision), first_seen, last_seen
  ├─ event_count, status (active | cleaned | recurring)
  └─ linked observation_ids

VolunteerEvent
  ├─ date, site/area, participant_count, hours_total
  ├─ waste_collected (per-material kg, may reference observations)
  └─ organizer, notes

Implemented derived tables (recomputed by the analytics refresh)
  ├─ BinHealthDaily (bin_id, date, fill_pct, overflow_risk, days_since_collection, recommendation)
  └─ CleanlinessDaily (site_id, date, score 0–100 or insufficient, components)
```

Conventions: every tenant-owned table carries `org_id` (the `organizations`
table is the tenant root); operational rows use soft deletes and UTC timestamps
with local-time display; images are referenced by object-store key, never stored
in the database.

Composition, recycling value, carbon, and public ward-week aggregates are
computed by API requests from operational records; they are not persisted in
`CompositionAggregate` or `CarbonImpact` tables.

## Bin health score (v1 formula — will evolve)

```
fill_pct        = human fill-tap band midpoint
fill_velocity   = regression over last N observations (pct/day)
days_to_full    = (100 - fill_pct) / max(fill_velocity, ε)
overflow_risk   = HIGH   if fill_pct ≥ 85 or days_to_full ≤ 1
                  MEDIUM if fill_pct ≥ 60 or days_to_full ≤ 3
                  LOW    otherwise
recommendation  = "collect today" if HIGH; "schedule within {days_to_full}d" if MEDIUM
```

Displayed exactly like the product vision:

```
Bin #43
Fill level              92%
Overflow risk           High
Days since collection   4
Recommendation          Collect today
```

The staff dashboard also groups registered sites and their bins by the site's
recorded ward. It flags a ward for human assessment when a registered site has
no bins, or when at least half of three or more bins with recorded health data
have medium/high fill risk. The latest health-data date is shown; the records
may be stale. Fewer than three assessed bins is shown as insufficient evidence.
This does not estimate a required bin count or placement: population,
service-area size, and coverage targets are not captured.

## Cleanliness index (implemented v1)

Score 0–100 per site, weighted over components with data; at least 10
observations in the last 30 days are required. The litter component has no
current detection input and is omitted, with remaining weights renormalized:

| Component | Signal | Weight (initial) |
|---|---|---|
| Litter density | Planned: detections per street-segment photo, normalized; no detector input yet | 35% |
| Bin overflow | Human fill taps in high/overflow bands over the last 30 days | 30% |
| Dumping | Distance and recency-decayed penalty from nearby human-confirmed sites | 20% |
| Collection reliability | Recent collection count among bins currently rated high risk; not an on-time-rate measure | 15% |

Each score carries methodology version `cleanliness-v1`; insufficient data is
returned without a score.

## Carbon estimate (v1)

`co2e_avoided = Σ (kg_material_recycled × factor_material)` using the cited per-material avoided-emissions factors in `api/src/owi_api/data/carbon-factors-v1.csv`. Landfill space uses a configured density constant. API results carry method version `carbon-v1` and an uncertainty range. **Never sold as offsets** — this is reporting, not carbon markets.

## Implemented internal API (authenticated, versioned `/api/v1`)

These are selected implemented routes, not a complete OpenAPI listing:

| Area | Implemented endpoints |
|---|---|
| Field reports | `POST /observations/batch` (multipart upload; duplicate images are deduplicated; no resumable-upload protocol) |
| Registry | `GET`/`POST /bins`, `GET`/`POST /sites`, `GET`/`POST /trucks`, `GET`/`POST /users`; individual routes support only their implemented operations |
| Operations | `GET /bins/health`, `GET /bins/coverage`, `POST /collections`, `GET /routes`, `GET /routes/savings`, `POST /routes/optimize`, `POST /routes/{id}/start`, `POST /routes/{id}/complete`, `POST /routes/stops/{id}/collect` |
| Review | `GET /predictions?status=unreviewed`, `POST /predictions/{id}/review` |
| Analytics | `GET /api/v1/analytics/composition`, `/api/v1/cleanliness`, `/api/v1/cleanliness/methodology`, `/api/v1/cleanliness/trend`, `/api/v1/carbon`, `/api/v1/carbon/factors`, `/api/v1/recycling/value`, `/api/v1/volunteers/summary` |
| Volunteer reports | `GET /api/v1/volunteers/report` returns print-ready HTML |

Planned API sketches, including resumable sync, general-purpose report
generation, and unimplemented CRUD operations, are not available routes.

## Implemented Open Data API (API-keyed, read-only)

The public API is mounted at `/api/v1/public`. Data endpoints return delayed
ward-week aggregates only: no images, coordinates, or bin identifiers. Cells
below three bins or 20 observations are withheld; the default publication delay
is seven days. Data endpoints require an `X-API-Key`; `/meta` is available
without a key for discovery.

| Endpoint | Returns |
|---|---|
| `GET /api/v1/public/meta` | dataset version, license, attribution, delay, suppression policy, and available endpoint names |
| `GET /api/v1/public/composition?ward=&weeks=&format=` | ward-week observation counts and reviewed/model-derived material shares |
| `GET /api/v1/public/collections?ward=&weeks=&format=` | ward-week report counts, observed bin counts, and overflow-report share; not collected tonnage or on-time rate |
| `GET /api/v1/public/cleanliness?ward=&weeks=&format=` | ward-week mean site cleanliness score, subject to the same privacy floor |

The implemented open endpoints return CC-BY-4.0 attribution. Public carbon,
ward-boundary GeoJSON, and downloadable dataset-snapshot endpoints are not
implemented. Administrators manage API keys at `/api/v1/admin/api-keys`.
