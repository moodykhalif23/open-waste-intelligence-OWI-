# Product readiness and implementation progress

Updated: 2026-10-28

This repository-tracked page records which product gaps are complete, active, or
waiting on evidence. It complements the capability descriptions in the
[README](../README.md); completion means the documented validation was run, not
just that code was written.

| Work item | Status | Progress and validation |
|---|---|---|
| Measure collection outcomes | Complete | Migration `0019` and the API smoke workflow passed on disposable PostGIS databases. The field-app route flow was exercised against an isolated API, and API tests, Ruff, mypy, and app/dashboard checks passed. The shared operational database was not migrated. |
| Align product claims with working features | In progress | The README distinguishes working capabilities from limits and roadmap items. Claim-by-claim verification against implementation and tests remains. |
| Recommend neighborhood bin coverage | In progress | Implemented a ward-level assessment API and dashboard view using registered sites without bins and the share of assessed bins with medium/high fill risk. The API tests, dashboard type/lint/build checks, and full API smoke suite on a disposable PostGIS database passed. It does not prescribe bin counts or placement because population, land-area, and service-target denominators are not available. Representative operational ward data and operator review remain. |
| Validate the classifier on local field data | Waiting | Requires a representative, locally labeled evaluation set and recorded model/version provenance. Public-dataset metrics alone do not close this gap. |

## Status definitions

- **Complete** — implementation and the stated validation are finished.
- **In progress** — work has started, but required evidence or validation remains.
- **Waiting** — blocked on data or an external prerequisite that is not available.

Product-specific reports and follow-up validation notes will be linked here as
they become available.
