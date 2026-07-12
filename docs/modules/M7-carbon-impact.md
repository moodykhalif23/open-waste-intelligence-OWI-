# M7 — Carbon Impact Dashboard

**Priority:** P2 · **Phase:** 3 · **Depends on:** M5 (calibrated material weights)

## Purpose
Convert recycling and diversion activity into environmental impact numbers that organizations can use for sustainability reporting and grant applications — **with methodology transparent enough to survive scrutiny.**

## Outputs (per scope × period)
- CO₂e avoided (kg) — from recycled material weights × per-material avoided-emission factors
- Landfill space saved (m³) — weights × compacted density factors
- Plastic diverted from environment (kg)
- Equivalents for communication (trees, car-km) — always secondary, always with "≈" and a methodology link

## Requirements
- **M7-F1.** Factor table committed to repo (`carbon-factors-v1.csv`) with per-material CO₂e factors and citations (candidate sources: US EPA WARM model, IPCC waste guidelines; select and document in Phase 3 — prefer factors defensible for the Kenyan context, noting grid-intensity caveats).
- **M7-F2.** Calculation engine: inputs are M5's *calibrated* weights (never raw photo estimates); every result stores method version + input snapshot for reproducibility.
- **M7-F3.** Dashboard: totals, per-material breakdown, trend; org-wide and per-site (site-level enables "your school diverted X kg CO₂e" reports for hosts).
- **M7-F4.** Report block: drop-in section for M8/grant reports with auto-generated methodology appendix.
- **M7-F5.** Uncertainty display: ranges, not false precision ("2.1–2.9 t CO₂e", not "2.4718 t").

## Hard lines
- **Not carbon credits.** Outputs are informational reporting, never tradable offsets; the UI says so. Entering carbon markets would require verification standards (Verra/Gold Standard) far beyond scope.
- No factor without a citation. No number without a version.

## Acceptance criteria
- An external reviewer (e.g., a sustainability consultant or academic contact) reviews methodology v1 and their feedback is addressed.
- Carbon block included in ≥ 1 real grant/CSR report during pilot.
