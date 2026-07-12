# M5 — Recycling Intelligence

**Priority:** P1 · **Phase:** 2 · **Depends on:** M1 (classification), material price table

## Purpose
Turn composition data into money: what recyclable material is flowing through Safi's operation, what is it worth, and who would buy it.

## The core view (from product vision)
```
This week
Plastic bottles              18,432
Estimated value          KES 37,500
Potential recycling partners      3
```

## Requirements
- **M5-F1.** Material volume tracking: item counts (from detections) and kg estimates (via density/weight-per-item tables, calibrated against sorting-site weighings) per material per week/month, by source area.
- **M5-F2.** Price table: Safi-maintained KES/kg per material (with effective dates, so history revalues correctly). Editable in dashboard; source noted (buyer quote, market survey).
- **M5-F3.** Value dashboard: estimated recoverable value per material per period; trend; top source areas per material ("Estate A produces 40% of our PET").
- **M5-F4.** Partner registry: recyclers/buyers with materials accepted, min quantities, indicative prices, contact. Matching = "you have 800 kg PET/month; these 3 buyers take PET at ≥ 500 kg." Manual data entry v1 — no scraping, no marketplace.
- **M5-F5.** Sorting-site reconciliation: weekly actual sorted weights vs. predicted → calibration factor per material (also feeds M1 accuracy eval and M7 carbon inputs).
- **M5-F6.** Exportable "supply profile" one-pager per material for buyer negotiations.

## Non-goals
Marketplace/transactions; price forecasting; brand-level EPR reporting (interesting Phase 4 — e.g., "n% of PET is brand X" for Extended Producer Responsibility conversations — but out of v1).

## Acceptance criteria
- Weekly kg estimates within ±20% of sorting-site actuals for top 3 materials after calibration period.
- Value estimates adopted by Wanjiru in ≥ 1 real buyer negotiation during pilot.

## Metrics
Estimated vs. actual kg per material; KES value recovered per month; # buyer conversations initiated with OWI data.
