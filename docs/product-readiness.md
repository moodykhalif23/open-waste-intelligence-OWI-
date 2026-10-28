# Product readiness and implementation progress

Updated: 2026-10-28

This repository-tracked page records which product gaps are complete, active, or
waiting on evidence. It complements the capability descriptions in the
[README](../README.md); completion means the documented validation was run, not
just that code was written.

| Work item | Status | Progress and validation |
|---|---|---|
| Measure collection outcomes | Complete | Migration `0019` and the API smoke workflow passed on disposable PostGIS databases. The field-app route flow was exercised against an isolated API, and API tests, Ruff, mypy, and app/dashboard checks passed. The shared operational database was not migrated. |
| Align product claims with working features | Complete | README, data-model/API docs, system spec, and landing-page claims were checked against implementation, focused tests, and the full isolated API smoke workflow. Corrected overstated public-API capabilities, stale endpoint paths, cleanliness details, and unsupported claims about fill detection, privacy retention, model release/retraining, audit coverage, and licensing. No operational data was changed. Evidence map below. |
| Recommend neighborhood bin coverage | In progress | Implemented a ward-level assessment API and dashboard view using registered sites without bins and the share of assessed bins with medium/high fill risk. The API tests, dashboard type/lint/build checks, and full API smoke suite on a disposable PostGIS database passed. Rebuilt and restarted only the API service (no migration or collection-record changes) so the shared dashboard could load the route; API health is green and the route now responds. The shared dashboard currently shows one `Test Ward` with two bins and marks it insufficient data, so representative operational ward data and operator review remain. It does not prescribe bin counts or placement because population, land-area, and service-target denominators are not available. |
| Validate the classifier on local field data | Waiting | Requires a representative, locally labeled evaluation set and recorded model/version provenance. Public-dataset metrics alone do not close this gap. |

## Status definitions

- **Complete** — implementation and the stated validation are finished.
- **In progress** — work has started, but required evidence or validation remains.
- **Waiting** — blocked on data or an external prerequisite that is not available.

Product-specific reports and follow-up validation notes will be linked here as
they become available.

## Product claim evidence map

| README claim | Implementation evidence | Validation evidence and boundary |
|---|---|---|
| Offline field reports, photo checks, privacy gate, bin QR and human fill taps | `app/src/lib/queue.ts`, `app/src/lib/sync.ts`, `api/src/owi_api/routers/observations.py`, `api/src/owi_api/ingestion/` | API smoke covers report acceptance, QR resolution, deduplication, and image rejection; `api/tests/test_privacy.py` and `api/tests/test_person_onnx.py` cover image/privacy behavior. |
| Classification and reviewed composition | `api/src/owi_api/routers/analytics.py`, `api/src/owi_api/routers/review.py`, `api/src/owi_api/analytics/composition.py` | Composition/review paths covered in API smoke; public-dataset-only evaluation is documented in [the classifier report](../ml/reports/classifier-evaluation.md). Local field accuracy remains unvalidated. |
| Fill accumulation and overflow estimates | `api/src/owi_api/analytics/bin_health.py`, `api/src/owi_api/analytics/refresh.py`, `api/src/owi_api/routers/operations.py` | `api/tests/test_bin_health.py` and smoke analytics/collection checks; uses human taps and needs sufficient time-separated history for velocity. |
| Planned and measured collection outcomes | `api/src/owi_api/routers/routes.py`, `app/src/components/CollectList.tsx`, `dash/src/pages/Routes.tsx` | Route start/stop/completion and measured-weight precedence covered by `api/tests/test_recycling.py`, `api/tests/test_routes_replan.py`, and the isolated API/field-app validations. |
| Neighborhood coverage assessment | `api/src/owi_api/analytics/coverage.py`, `api/src/owi_api/routers/operations.py`, `dash/src/pages/Coverage.tsx` | Helper tests and isolated PostGIS smoke verify ward counts and assessment reasons. The rebuilt shared API returns the coverage route and the dashboard displays the single current `Test Ward` (2 bins, insufficient data). This is not representative ward evidence; operator review remains outstanding, and no bin counts or placement are prescribed. |
| Fuel and route-efficiency comparisons | `api/src/owi_api/routers/routes.py` (`/routes/savings`, completion outcomes) | Isolated smoke covers planned-vs-need-driven comparison and measured route outcomes; manual fuel entry is not a causal efficiency analysis. |
| Recycling value and partner matching | `api/src/owi_api/routers/recycling.py` | `api/tests/test_recycling.py` and API smoke; estimates use composition shares, collected tonnage, configured prices, and matching criteria. |
| Human-confirmed dumping hotspots | `api/src/owi_api/routers/dumping.py`, `api/src/owi_api/analytics/dumping.py` | `api/tests/test_dumping.py` and API smoke cover review, confirmation, recurrence, and ranking; no automated litter detector is present. |
| Site cleanliness and carbon estimates | `api/src/owi_api/routers/cleanliness.py`, `api/src/owi_api/analytics/cleanliness_refresh.py`, `api/src/owi_api/routers/carbon.py` | `api/tests/test_cleanliness.py`, `api/tests/test_carbon.py`, and API smoke cover methodology and calculations; cleanliness omits the unavailable litter input and carbon is estimated. |
| Volunteer summaries and public data | `api/src/owi_api/routers/volunteers.py`, `api/src/owi_api/routers/public.py` | `api/tests/test_volunteer.py`, `api/tests/test_public_data.py`, and smoke cover aggregation, attribution, API keys, delay, and suppression. Public data currently exposes ward-week composition, report/overflow summaries, and mean cleanliness only—not carbon, GeoJSON boundaries, or dataset files. |
| Open-source licensing | Repository root and README license note | No `LICENSE` file is present; README now describes licenses as intended but unconfirmed and does not claim that the repository is formally licensed open source. |
| Landing-page product and trust claims | `site/index.html`; field capture in `app/src/lib/queue.ts` and `api/src/owi_api/ingestion/service.py`; privacy gate in `api/src/owi_api/ingestion/privacy.py`; public API in `api/src/owi_api/routers/public.py`; model registration/review in `api/src/owi_api/routers/models.py` and `api/src/owi_api/routers/review.py`; audit implementation in `api/src/owi_api/audit.py` and `api/src/owi_api/models/audit.py` | Copy now distinguishes model-based material estimates from human fill taps; states originals may be quarantined and are purged within 72 hours; describes delayed, suppressed public aggregates without implying published photos/coordinates; does not promise that model registration enforces the training gate or that reviewer corrections automatically retrain models; limits the audit claim to recorded security-relevant actions; and says no project license has been declared. Privacy, public-data, audit, and classifier behavior have focused tests/reports; local field classifier accuracy remains unvalidated. |

Validation used for this review: API tests, Ruff, mypy, dashboard type/lint/build,
and the full API smoke workflow against a disposable PostGIS database. Those
checks passed; they do not substitute for the outstanding local classifier
evaluation or representative ward/operator validation.
