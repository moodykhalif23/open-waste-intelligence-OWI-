# M1 — Waste Classification

**Priority:** P0 · **Phase:** 1 · **Depends on:** Phase 0 dataset, ingestion pipeline

## Purpose
Turn photos into structured composition data: which materials, in what proportions, where, and how it changes over time. M1 is the foundation every other analytics module builds on.

## Users & decisions it drives
- **Wanjiru:** "42% of Estate A's waste is plastic → pitch a PET buyer partnership."
- **Amina:** "Organic share spikes on market days → schedule extra organic runs Fridays."
- **County officer:** "Ward-level composition to justify a glass bank placement."

## Requirements
- **M1-F1.** Classify detected waste into the 8-class taxonomy (plastic, glass, metal, paper, organic, e-waste, textile, other/mixed) with per-item confidence.
- **M1-F2.** Aggregate composition by bin, site, area, org × day/week/month; render as the vision's headline view:
  ```
  Today's waste
  Plastic   42%   Organic  33%   Paper  12%
  Glass      8%   Metal     5%
  ```
- **M1-F3.** Comparison views: area vs. area, period vs. period, with trend arrows.
- **M1-F4.** Surface-bias correction: bin-photo composition is calibrated against sorting-site ground truth; aggregates display a stated uncertainty band.
- **M1-F5.** Review queue: low-confidence or disputed classifications correctable by ops staff; corrections feed retraining (active learning).
- **M1-F6.** Every aggregate drills down to its underlying observations.

## Non-goals
Item-level brand identification (v1); per-photo weight estimates presented as precise.

## Acceptance criteria
- Macro-F1 ≥ 0.80 on the frozen local golden test set (top-7 classes).
- Weekly predicted composition within ±10 percentage points of sorting-site actuals for the top 3 materials, for 4 consecutive weeks.
- Composition dashboard used in ≥1 real Safi decision (documented) during pilot.

## Metrics
Per-class precision/recall; calibration error vs. sorting ground truth; % predictions human-corrected (should fall month over month).
