# 09 — Risk Register

Scored: Likelihood (L) × Impact (I), 1–5 each. Reviewed at every phase gate.

## Adoption & human risks (the ones that actually kill projects like this)

| # | Risk | L | I | Mitigation |
|---|---|---|---|---|
| R1 | **Collectors don't take photos** (friction, no perceived benefit, phone limits) | 4 | 5 | Phase 0 week-1 validation on real phones; ≤20 s flow, zero typing; management mandate + small airtime incentive; capture rate on the weekly dashboard; treat as the project's #1 metric. |
| R2 | **Coordinator ignores recommendations** (trust, habit) | 3 | 5 | Shadow mode first; weekly ground-truth ritual; recommendations explain themselves ("92% full, 4 days since collection"); never auto-act. |
| R3 | **Safi leadership priorities shift** (grants, staff turnover) | 3 | 4 | Phase 0 delivers standalone value (digital registry, baseline analysis); named ops champion; short phases with visible wins; signed data agreement includes exit-with-export so trust is easy. |
| R4 | **Community backlash** (surveillance perception, index shaming) | 2 | 5 | Governance hard lines; blur-at-ingestion; opt-in public display; community advisory check-ins; trend-not-rank framing. |
| R5 | Labeling stalls (tedium, cost) | 3 | 3 | Paid labelers; labels-from-workflow design (fill taps, sorting photos); monthly volume targets tracked at gates. |

## Technical risks

| # | Risk | L | I | Mitigation |
|---|---|---|---|---|
| R6 | **Model accuracy insufficient on local data** (domain gap from public datasets) | 3 | 4 | Phase 0 is dataset-first by design; golden local test set decides go/no-go; fill-level has human-tap fallback so M2 works even with a weak model; composition reported with uncertainty. |
| R7 | Composition estimates misleading (surface bias, black bags) | 4 | 3 | Sorting-site calibration; "mixed/bagged" class; uncertainty bands; never present kg as precise. |
| R8 | Offline sync data loss / duplicate chaos | 3 | 3 | Content-hash dedupe; resumable uploads; client-side queue with explicit sync status; sync tested on 2G-class connections before rollout. |
| R9 | Privacy gate misses a person → published | 2 | 5 | High-recall tuning; quarantine flow; second scan + human sample review before any dataset publication; incident process (24 h pull). |
| R10 | Cheap infra falls over / data lost | 2 | 4 | Nightly DB dumps + object-store sync to a second location; restore drill once per phase; Docker Compose = trivially rebuildable. |
| R11 | Route plans impractical (road reality ≠ OSM) | 3 | 3 | Driver feedback loop (M4-F4 plan-vs-actual); manual stop reordering allowed; OSM fixes contributed back where roads are wrong. |

## External risks

| # | Risk | L | I | Mitigation |
|---|---|---|---|---|
| R12 | Kenya DPA / ODPC compliance gap | 2 | 4 | Phase 0 action: registration check + legal consult budgeted; governance doc designed to exceed requirements. |
| R13 | County relations sour (data seen as criticism of service) | 2 | 3 | Frame open data as *supporting* county planning; offer county a dashboard early; no public "county failure" narratives. |
| R14 | Recyclable price volatility makes M5 estimates look wrong | 3 | 2 | Dated price table, history revalued transparently; ranges not points. |
| R15 | Funding gap before Phase 3 (the grant-winning features) | 3 | 4 | M8 grant reports can be pulled earlier if needed; Phase 1 savings numbers (fuel/overflow) are themselves fundable evidence; publish the open dataset early for research-grant angles. |
| R16 | Phone theft/damage in the field | 3 | 2 | Collectors' own phones + 2–3 project backups; app holds no sensitive data beyond queue; remote token revocation. |

## Top 3 to watch weekly during Phase 0
**R1 (capture rate)**, **R5 (label volume)**, **R3 (partner engagement)** — all human, none technical. The tech risks have fallbacks; the human ones don't.
