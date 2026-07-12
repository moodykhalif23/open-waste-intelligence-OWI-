# 06 — Safi Pilot Plan

The pilot is the product. OWI's entire thesis is that a real operator validates (or kills) each analytic. This plan turns Safi's operation into that testbed — while making sure Safi gets value at every step, not just at the end.

## Pilot resources (assumed — confirm in kickoff)
- 2 trucks, 20 collectors, ~150 bins across estates/schools/markets
- A sorting site (ground-truth goldmine)
- Access to estate managers, schools, businesses, and county contacts
- Community volunteers for events

## Phase 0 — Baseline & Dataset (Weeks 1–12) · *no ML*

**Goal:** the field app in daily use, the bin registry complete, the Safi Waste Dataset growing, and a measured baseline to compare everything against.

| Week | Activity |
|---|---|
| 1–2 | Kickoff with Safi leadership: sign data agreement (governance doc), confirm resources, select pilot zones (suggest: 1 estate + 1 school + 1 market for diversity). **Validate assumption #1: will collectors take photos?** Paper-prototype the flow on 3 collectors' actual phones. |
| 2–4 | Bin registry: GPS + QR-sticker + reference photo for all ~150 bins. Build/deploy field app v0 (capture, tap, offline sync). Train collectors (1-hour session + laminated cheat sheet, Swahili). |
| 4–12 | Daily photo capture during normal rounds. Weekly sorting-site photo sessions. Baseline measurement: fuel logs, route km, overflow complaints, collection timestamps — this becomes the comparison baseline for G2/G3. Labeling starts (2–3 paid Safi labelers). |
| 12 | **Gate G0:** ≥ 5,000 usable images? ≥ 70% of bin visits photographed? Baseline metrics captured? Collectors still cooperating (median report ≤ 20s)? If no → fix the field process before building any ML. |

**Value delivered to Safi in Phase 0 alone:** digital bin inventory, digitized collection records, baseline cost analysis. Even if the project stopped here, Safi is better off.

## Phase 1 — Classification + Bin Health (Months 4–6)

- Train T1/T2/T3 models on Phase 0 data; deploy batch inference; ship review queue.
- Dashboard v1: composition views (M1), bin health + collect-today list (M2).
- Amina starts using recommendations **alongside** the fixed schedule (shadow mode month 4, decision mode months 5–6).
- **Gate G1:** model targets hit on golden set (F1 ≥ .80, fill ±1 band ≥ 90%)? Amina trusts the collect-today list (uses it ≥ 4 days/week)? Overflow trend improving?

## Phase 2 — Routes, Dumping, Recycling (Months 7–10)

- M4 route optimization live for both trucks; M3 dumping review queue + hotspot map; M5 value dashboards + price table.
- Interventions: execute ≥ 2 dumping-site interventions and measure recurrence.
- **Gate G2:** km/tonne down ≥ 15%? Overflow incidents down ≥ 30%? Value estimates within ±20% of sorting actuals?

## Phase 3 — Index, Carbon, Volunteers, Open Data (Months 11–14)

- M6 cleanliness index (methodology workshop with communities before publishing anything), M7 carbon (external methodology review), M8 volunteer analytics + grant report generator.
- Open Data API launch + first public dataset snapshot.
- **Gate G3:** ≥ 1 grant/contract application submitted with OWI reports; ≥ 2 communities using the index; open dataset published.

## Validation discipline (applies to every module)

1. **Shadow before decide:** every recommendation runs alongside the old way first; we log agreement and outcomes before anyone acts on it.
2. **Weekly ground-truth ritual:** 30 minutes with Amina + one collector reviewing the week's disagreements (model vs. reality). This meeting is the project's heartbeat.
3. **Kill criteria are real:** a module that fails its gate twice is cut or redesigned, not lingered on. The scarce resource is Safi's attention.
4. **Value ledger:** a running document of every decision Safi made differently because of OWI. This is the ultimate metric — and the content of the eventual case study.

## Pilot budget lines to plan for (not priced here)
Labeler stipends · QR stickers/laminates · 2–3 backup Android phones · 1 VPS or mini-PC · mobile data bundles for sync · printing (cheat sheets, reports) · methodology review honorarium.
