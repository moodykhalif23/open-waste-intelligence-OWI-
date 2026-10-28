# OpenWaste Intelligence (OWI)

**A field-reporting and analytics platform for understanding waste generation, collection planning, recycling potential, and environmental health.**

Anchored by a real operating partner — **Safi Cleaners and Recyclers**, a Community-Based Organization (CBO) with active waste collection operations, community members, and access to municipalities, schools, estates, and businesses.

> Not another waste management app. Instead of saying *"there is garbage here,"* OWI answers:
> How much? What type? How fast is it accumulating? How long before overflow? How efficient are collections? Which neighborhoods need more bins? Which routes waste fuel? Which recyclables are most common? Which locations are repeatedly littered?

## What works today

The current operational flow is field-photo reporting, not end-to-end automated
waste detection or tracking. A collector captures a photo, optionally identifies
a registered bin with its QR code, and records a human fill-level tap. The PWA
queues reports offline and syncs them to the API. Ingestion checks image quality
and applies a person-privacy gate before storage. When a material classifier is
active, its predictions enter a review queue; analytics use the latest
prediction and any human correction.

```
Field photo + optional bin QR + human fill tap
      │
Offline PWA queue → API image-quality and privacy checks
      │
Active ONNX material classifier → human review/correction
      │
Fill, composition, collection, and location analytics
      │
Ops dashboard and delayed, privacy-screened ward-week open-data API
```

## Product questions: current coverage and limits

| Question | Current capability | Important limit |
|---|---|---|
| How much waste? | Estimated bin weights plus weighed route totals at route completion; volunteer-reported weights are also supported. | Route totals are manual weigh-ins, not automated scale integration or per-material weights. |
| What type? | Photo-derived material counts and shares; reviewed corrections can replace model predictions. | The published evaluation is on public datasets, not representative local field photos; small samples are flagged insufficient. |
| How fast is it accumulating? | Fill velocity calculated from human-reported fill taps for registered bins. | No automated fill-level model; estimates need multiple time-separated reports. |
| How long before overflow? | A v1 estimate and risk recommendation based on recent fill history. | It is unavailable or uncertain with sparse reports and is not a sensor-based forecast. |
| How efficient are collections? | Route plans and modeled fixed-sweep versus need-driven comparison, alongside GPS aggregate distance, elapsed duration, actual fuel, and weighed tonnage from completed routes. | Measured performance is available only for routes explicitly started and completed in the field app. |
| Which neighborhoods need more bins? | A ward-level assessment view flags registered sites without bins and wards where at least half of at least three bins with recorded health data have medium/high fill risk; it shows the latest health date. | This is an assessment priority, not an estimate of bin count or placement; population, area, and service-target denominators are not recorded, and health records may be stale. |
| Which routes waste fuel? | Completed routes expose actual fuel against planned fuel, distance, duration, and weighed tonnage. | Fuel use is manually entered and the comparison is operational, not a causal fuel-efficiency model. |
| Which recyclables are most common? | Material counts and shares over a selected time window. | These are image-classification estimates, not audited material weights. |
| Which locations are repeatedly littered? | Staff-reviewed dumping observations are grouped into recurring dumping hotspots. | Hotspots are human-confirmed dumping sites, not automated street-litter detection. |

These are current product boundaries, not a claim that every question is fully
resolved. In particular, object-level waste detection and tracking, automated
fill estimation, denominator-based bin-coverage recommendations, and automated
litter detection remain future work. See
[the ML evaluation report](ml/reports/classifier-evaluation.md) for the public
dataset metrics and the local-data limitation. See the
[product readiness tracker](docs/product-readiness.md) for implementation
progress and validation evidence.

## Modules

| # | Module | Current status |
|---|---|---|
| 1 | Waste material classification | Active ONNX classifier, review queue, and aggregate composition; requires local field validation. |
| 2 | Bin health monitoring | Human fill taps, estimated accumulation, overflow risk, and collection recommendations. |
| 3 | Illegal-dumping hotspots | Staff-reviewed, human-confirmed locations; no automated litter/dumping detector. |
| 4 | Collection route planning | Optimizes planned stops and estimates fuel; route completion records aggregate GPS distance/duration, manually entered fuel and weighed tonnage. |
| 5 | Recycling intelligence | Estimated material value and partner matching from composition and configured prices. |
| 6 | Community cleanliness | Site-level, data-qualified index; litter-detection component is not yet available. |
| 7 | Carbon impact | Method-versioned estimates using composition, estimated collected weight, and published factors. |
| 8 | Volunteer analytics | Manually entered event, participant, volunteer-hour, and self-reported collected-weight summaries; these weights are not independently verified. |

## Run it

```sh
# create the repo-root .env with secrets — see docs/deployment.md for the template
make web               # builds + starts the backend (API, workers, db, storage)
make dash              # dashboard, in another terminal
make app               # field PWA, in another terminal
```

Docker runs the backend only. The three frontends (`dash`, `app`, `site`) build and run outside Docker and consume the API over HTTP: `http://localhost:8000`, proxied at `/api` by their dev servers. Dashboard at `http://localhost:5174`, field app at `https://localhost:5173` (accept the self-signed cert once per device), landing page at `http://localhost:5175`, Label Studio at `http://localhost:8080`. `make help` lists all targets.

The dashboard login comes from `.env` (`OWI_ADMIN_PHONE` / `OWI_ADMIN_PASSWORD`) and is applied on every `make up`; only its hash is stored in the database. Change the value there and `make up` to rotate it.

Contributors: see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

The intended licenses are Apache-2.0 for code and CC-BY-4.0 for open data, but
they have not been confirmed and no license files are present yet. Do not treat
the repository as formally licensed open-source software or published open
data until those terms are approved and added.
