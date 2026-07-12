# M4 — Collection Route Optimization

**Priority:** P1 · **Phase:** 2 · **Depends on:** M2 (bin health), registry (trucks)

## Purpose
"Google Maps for garbage collection." Given today's bin health scores, Safi's trucks, and road distances, produce the cheapest set of routes that collects what needs collecting.

## Problem shape
Capacitated Vehicle Routing Problem (CVRP) with:
- 2 trucks (capacity, fuel consumption, start/end depot), 20 collectors, 150 bins
- Bin demand = estimated volume/weight from M2 fill levels
- Hard: truck capacity, working hours. Soft: overflow-risk bins first, area contiguity.
- Solver: **Google OR-Tools**; road distance/time matrix from **self-hosted OSRM/Valhalla** on OpenStreetMap Kenya extracts (never per-request paid APIs).

## Requirements
- **M4-F1.** "Plan today" action: takes M2's collect-today set (Amina can add/remove bins), outputs ordered stops per truck with ETAs, total km, and estimated fuel.
- **M4-F2.** Driver view (field app): today's stops in order, offline map tiles, mark-as-collected per stop (which triggers the post-collection photo flow).
- **M4-F3.** Mid-day replan: bin added/truck breakdown → recompute remaining stops.
- **M4-F4.** Plan vs. actual: log planned km/time vs. actual (from app GPS breadcrumbs during active route only — see governance: location tracking runs only while a route is active, visible to the driver, never outside work).
- **M4-F5.** Savings report: km, hours, fuel, and KES saved vs. the Phase 0 fixed-schedule baseline — headline number for grants.
- **M4-F6.** What-if mode: "if we added a 3rd truck / moved the depot / added 10 bins in Estate C, what happens to cost?" (simple scenario runner, Phase 3 polish).

## Non-goals
Live traffic; multi-day planning horizon (v1 plans one day); driver performance scoring (explicitly rejected — this is a route tool, not a worker surveillance tool).

## Acceptance criteria
- Route computation < 60 s for 150 bins / 2 trucks.
- Drivers follow ≥ 80% of planned stop order (else the plans aren't practical — investigate why, don't blame drivers).
- After 3 months: km per tonne collected down ≥ 15% vs. baseline.

## Metrics
km/tonne; fuel/tonne; bins served per truck-day; overflow bins missed by plan; replan frequency.
