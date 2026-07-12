# 02 — Master Product Requirements Document (PRD)

| | |
|---|---|
| **Product** | OpenWaste Intelligence (OWI) |
| **Version** | 0.1 (draft) |
| **Date** | 2026-07-12 |
| **Anchor partner** | Safi Cleaners and Recyclers (CBO) |
| **Status** | Pre-code. Approved scope for Phase 0–1 pending partner sign-off. |

---

## 1. Product vision

An open-source computer vision and analytics platform that turns photos taken during everyday waste operations into decisions: which bins to collect today, which materials to sell, which locations need intervention, and what impact to report. Built with and validated by a real CBO; deployable by any organization anywhere.

## 2. Goals

### Product goals
- **G1.** Convert phone photos into structured waste data (type, quantity, fill level, location, time) with accuracy good enough to drive operational decisions.
- **G2.** Reduce Safi's collection cost per tonne (fuel + hours) by ≥15% within 6 months of route optimization going live.
- **G3.** Reduce overflow incidents at monitored bins by ≥30% within 6 months of bin health monitoring going live.
- **G4.** Produce grant-ready, methodology-backed impact reports (recycling volumes, carbon, volunteer effort) with < 1 hour of manual work per report.
- **G5.** Publish an open, anonymized dataset and open data API usable by researchers, counties, and other CBOs.

### Non-goals (explicit)
- **NG1.** Identifying, tracking, or profiling people. No face detection, no person re-identification, no license plate reading. Ever. (See governance doc.)
- **NG2.** Consumer-facing litter reporting app in v1.
- **NG3.** Per-bin IoT hardware (load cells, ultrasonic sensors) in v1. Photos are the sensor.
- **NG4.** Payments, marketplace, or billing features in v1.
- **NG5.** Real-time video analytics in v1. Still images and short bursts only.

## 3. Users and personas

| Persona | Description | Primary jobs-to-be-done |
|---|---|---|
| **Amina — Operations coordinator (Safi)** | Plans daily collections for 2 trucks / 20 collectors / 150 bins. Uses a laptop and WhatsApp today. | "Tell me which bins need collection today and the best order to visit them." |
| **Kevin — Collector/driver** | On a truck all day, mid-range Android phone, patchy data. | "Make reporting a bin as easy as one photo. Show my route. Work offline." |
| **Wanjiru — CBO director** | Writes grant applications, negotiates with county and recyclers. | "Give me credible numbers: tonnes, composition, CO₂e, volunteer hours." |
| **Estate manager / school admin** | Pays for or hosts collection service. | "Show me my site's bin health and cleanliness score." |
| **County environment officer** | Oversees ward-level waste service. | "Give me aggregate data I can cite without a procurement process." |
| **External developer / researcher** | Wants the data or wants to deploy OWI elsewhere. | "Clean API, clear docs, permissive license, reproducible models." |

## 4. Scope — the 8 modules

Full requirements per module live in [docs/modules/](modules/). Summary and priority:

| Module | Priority | Phase | Depends on |
|---|---|---|---|
| M1 Waste Classification | P0 | 1 | Data collection app (Phase 0) |
| M2 Bin Health Monitoring | P0 | 1 | M1, bin registry |
| M4 Route Optimization | P1 | 2 | M2 |
| M3 Illegal Dumping Detection | P1 | 2 | M1 |
| M5 Recycling Intelligence | P1 | 2 | M1 |
| M6 Community Cleanliness Index | P2 | 3 | M1–M3 |
| M7 Carbon Impact Dashboard | P2 | 3 | M5 |
| M8 Volunteer Analytics | P2 | 3 | none (mostly non-CV) |

**Phase 0 (pre-ML) is itself a deliverable:** a field data-collection app + bin registry that Safi collectors use to photograph bins during normal work. This produces the labeled local dataset everything else depends on, and delivers immediate value (digital bin records) before any model exists.

## 5. Core user flows (v1)

### Flow A — Collector reports a bin (the atomic unit of the whole system)
1. Kevin opens the OWI app (works offline), taps the bin from a nearby-bins list or scans its QR code.
2. Takes 1 photo of the bin.
3. App auto-attaches GPS + timestamp; Kevin optionally taps a fill-level estimate (empty/low/half/high/overflowing) — this doubles as a training label.
4. Report syncs when connectivity returns.
- **Success criteria:** ≤ 20 seconds per report; works fully offline; zero typing required.

### Flow B — Amina plans the day
1. Amina opens the dashboard each morning.
2. Sees ranked bin list: fill level, overflow risk, days since collection, recommendation.
3. Selects bins (or accepts the suggested set), gets an ordered route per truck.
4. Sends route to drivers' phones.
- **Success criteria:** morning planning takes < 10 minutes; recommendations beat the fixed schedule on fuel/tonne within 3 months.

### Flow C — Wanjiru generates an impact report
1. Selects a date range and audience (grant, county, recycler).
2. System renders: tonnage by material, recycling value estimates, carbon impact with methodology notes, cleanliness index trends, volunteer stats.
3. Exports PDF/CSV.
- **Success criteria:** < 1 hour of manual work; every number traceable to underlying records.

### Flow D — External consumer uses the Open Data API
1. Registers for an API key (free tier).
2. Queries aggregated, anonymized endpoints (composition by ward/week, cleanliness index, collection stats).
- **Success criteria:** no raw images or precise dump-site coordinates exposed; documented; versioned.

## 6. Functional requirements (system-level)

- **FR1.** Ingest geotagged, timestamped photos from Android phones, including batches captured offline.
- **FR2.** Detect and classify waste into at least 7 material classes (plastic, glass, metal, paper, organic, e-waste, textile) with per-class confidence.
- **FR3.** Estimate bin fill level in 5 bands from a single photo of a registered bin.
- **FR4.** Maintain a registry of bins, sites, routes, trucks, collectors (role-based access).
- **FR5.** Compute per-bin health score and daily collection recommendations.
- **FR6.** Compute optimized multi-stop routes given trucks, capacities, and selected bins.
- **FR7.** Flag out-of-place waste accumulations (illegal dumping candidates) for human review — human confirms before anything is recorded as a dumping event.
- **FR8.** Aggregate analytics by site, neighborhood/ward, and time window; compute cleanliness index and carbon estimates with published formulas.
- **FR9.** Record volunteer events, hours, and outputs.
- **FR10.** Expose read-only open data API (aggregates only) and internal API (full, authenticated).
- **FR11.** Every ML prediction is correctable by a human, and corrections feed the training set (active learning loop).

## 7. Non-functional requirements

| Area | Requirement |
|---|---|
| **Offline-first** | Field app fully functional without connectivity; sync is eventual. |
| **Low-end devices** | Field app runs on Android 10+, 2 GB RAM; images compressed client-side. |
| **Cost ceiling** | Total cloud spend for the Safi deployment ≤ USD 50/month at pilot scale. Self-hostable on a single VPS or on-prem mini-PC. |
| **Inference** | Batch inference acceptable (minutes, not milliseconds). On-device inference optional optimization, not a requirement. |
| **Privacy** | Faces/plates blurred at ingestion before storage; raw uploads with detected persons are quarantined. See governance doc. |
| **Open source** | All code Apache-2.0; no hard dependency on paid services; any component replaceable. |
| **i18n** | English + Swahili UI strings from day one (string files, not hardcoded). |
| **Auditability** | Every aggregate number in a report is reproducible from stored records. |

## 8. Success metrics

| Metric | Baseline (to measure in Phase 0) | Target |
|---|---|---|
| Collection cost (fuel + hours) per tonne | TBD Phase 0 | −15% by month 6 of Phase 2 |
| Overflow incidents per monitored bin per month | TBD Phase 0 | −30% by month 6 of Phase 2 |
| Classification macro-F1 on local test set | — | ≥ 0.80 (top-7 classes) |
| Fill-level band accuracy (±1 band) | — | ≥ 90% |
| Collector report time | — | ≤ 20 s median |
| Reports used in ≥1 successful grant/contract | 0 | ≥ 1 by month 12 |
| External deployments of OWI | 0 | ≥ 1 by month 18 |

## 9. Assumptions

- Safi collectors will take photos as part of normal work if it costs < 30 s and management asks them to (validate in Phase 0 week 1–2).
- Safi can provide bin locations, truck specs, fuel logs, and historical schedules.
- ~5,000–10,000 locally captured labeled images are attainable in 8–12 weeks of Phase 0 (150 bins × daily-ish photos).
- A county or estates will accept "photo-derived" data if methodology is transparent.

## 10. Open questions (resolve during Phase 0)

1. Bin identification in the field: QR stickers vs. GPS-nearest-bin vs. visual re-identification? (Start with QR + GPS fallback.)
2. Who owns the images — Safi, OWI project, or the site host? (Draft answer in governance doc; needs partner sign-off.)
3. Weighbridge or scale access for ground-truth tonnage, or estimate from volume × density tables?
4. KES valuation source for recyclables: static price table maintained by Safi vs. buyer-quoted feeds?
5. County data-sharing appetite: is there an existing open-data policy to align with?
