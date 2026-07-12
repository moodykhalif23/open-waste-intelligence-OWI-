# M2 — Bin Health Monitoring

**Priority:** P0 · **Phase:** 1 · **Depends on:** M1 pipeline, bin registry

## Purpose
Replace fixed collection schedules with need-driven collection. Every bin gets a health score; the system tells Amina which bins to collect **today**.

## The core view (from product vision)
```
Bin #43
Fill level              92%
Overflow risk           High
Days since collection   4
Recommendation          Collect today
```

## Requirements
- **M2-F1.** Bin registry: every bin has a QR sticker, GPS point, volume, type, host site, and a reference photo (used to crop/align new photos for fill estimation).
- **M2-F2.** Fill-level estimate per observation: 5 bands (empty/low/half/half+/overflowing), from model prediction, overridden by collector tap when present.
- **M2-F3.** Fill-velocity model per bin: regression over recent observations → predicted days-to-full.
- **M2-F4.** Daily health score + recommendation per bin (formula in [05-data-model.md](../05-data-model.md)); ranked "collect today" list on the dashboard.
- **M2-F5.** Overflow alerting: bins predicted to overflow before their next scheduled visit are flagged; optional WhatsApp/SMS digest to Amina.
- **M2-F6.** Collection events close the loop: post-collection photo resets the bin; predicted vs. actual state at collection time is logged for model eval.
- **M2-F7.** Bin history page: fill curve, collections, photos timeline.

## Non-goals
Hardware fill sensors; real-time (sub-hour) fill tracking; public exposure of individual bin data.

## Acceptance criteria
- Fill-band accuracy (±1 band) ≥ 90% vs. collector taps on the golden set.
- Days-to-full prediction within ±1 day for ≥ 70% of bins with ≥ 2 weeks history.
- After 3 months live: overflow incidents on monitored bins down ≥ 30% vs. Phase 0 baseline **and** wasted trips (bins found < half full when collected on schedule) down ≥ 25%.

## Metrics
Overflow incidents/bin/month; % collections triggered by recommendation vs. schedule; wasted-trip rate; prediction-vs-actual at collection time.
