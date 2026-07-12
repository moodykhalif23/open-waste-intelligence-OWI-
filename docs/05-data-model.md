# 05 — Data Model & APIs

## Core entities

```
Organization ─┬─ User (role: admin | coordinator | collector | viewer)
              ├─ Site (estate, school, market, business, public area)
              │    └─ Bin (id, QR code, geo point, volume_liters, type, reference_photo)
              ├─ Truck (capacity, fuel type, consumption baseline)
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
  ├─ bin_id, truck_id, collector_id, occurred_at
  ├─ pre_observation_id, post_observation_id (photo before/after)
  └─ estimated_weight_kg, weight_source (estimated | weighed)

Route
  ├─ date, truck_id, status (planned | active | done)
  ├─ stops[] (ordered bin_ids, ETAs)
  └─ metrics (planned_km, actual_km, fuel_est, bins_served)

DumpingSite  (human-confirmed only)
  ├─ geo point (internal precision), first_seen, last_seen
  ├─ event_count, status (active | cleaned | recurring)
  └─ linked observation_ids

VolunteerEvent
  ├─ date, site/area, participant_count, hours_total
  ├─ waste_collected (per-material kg, may reference observations)
  └─ organizer, notes

Derived (analytics tables, recomputed nightly)
  ├─ BinHealthDaily (bin_id, date, fill_pct, overflow_risk, days_since_collection, recommendation)
  ├─ CompositionAggregate (scope: site|ward|org, window, material → share, item_count, kg_est)
  ├─ CleanlinessIndexDaily (area_id, date, score 0–100, components)
  └─ CarbonImpact (scope, window, co2e_kg, method_version, inputs)
```

Conventions: every table carries `org_id` (multi-tenant from day one); soft deletes; all times UTC with local-time display; images referenced by object-store key, never stored in DB.

## Bin health score (v1 formula — will evolve)

```
fill_pct        = model fill band midpoint, overridden by human tap if present
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

## Cleanliness index (v1 components)

Score 0–100 per area (estate/ward), weighted sum — weights tuned with Safi during Phase 2:

| Component | Signal | Weight (initial) |
|---|---|---|
| Litter density | detections per street-segment photo, normalized | 35% |
| Bin overflow rate | % of observations in overflow band | 30% |
| Illegal dumping | active confirmed sites per km², recency-decayed | 20% |
| Collection reliability | on-time collection rate for the area's bins | 15% |

Published with methodology version; never compare scores across methodology versions.

## Carbon estimate (v1)

`co2e_avoided = Σ (kg_material_recycled × factor_material)` using published per-material avoided-emissions factors (e.g., EPA WARM or IPCC-derived; factor table with citations committed to repo as `carbon-factors-v1.csv`). Landfill space via density tables. Always shown with "estimated — methodology v1" label and a link. **Never sold as offsets** — this is reporting, not carbon markets.

## Internal API (authenticated, versioned `/api/v1`)

| Area | Endpoints (sketch) |
|---|---|
| Sync | `POST /observations/batch` (multipart, resumable), `GET /sync/manifest` |
| Registry | CRUD `/bins`, `/sites`, `/trucks`, `/users`, `/routes` |
| Ops | `GET /bins/health?date=`, `POST /routes/optimize`, `PATCH /routes/{id}` |
| Review | `GET /predictions?status=unreviewed`, `POST /predictions/{id}/correct` |
| Analytics | `GET /analytics/composition`, `/cleanliness`, `/carbon`, `/volunteers` with `scope` + `window` params |
| Reports | `POST /reports` (template, range) → PDF/CSV |

## Open Data API (public, API-keyed, read-only)

Hard rules (from governance doc): aggregates only; no images; no bin-level or dump-site coordinates (ward/area centroids only); suppress any cell aggregating < 3 bins or < 20 observations; 7-day publication delay.

| Endpoint | Returns |
|---|---|
| `GET /open/v1/composition?area=&window=` | material shares, item counts, kg estimates |
| `GET /open/v1/cleanliness?area=&window=` | index + component breakdown + methodology version |
| `GET /open/v1/collections?area=&window=` | bins served, tonnage estimates, on-time rate |
| `GET /open/v1/carbon?area=&window=` | CO₂e estimates + methodology link |
| `GET /open/v1/areas` | available areas (GeoJSON boundaries at ward level) |
| `GET /open/v1/datasets` | links to published dataset snapshots (Parquet/CSV) |

All open endpoints CC-BY-4.0; attribution string included in every response.
