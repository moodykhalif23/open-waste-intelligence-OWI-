# M6 — Community Cleanliness Index

**Priority:** P2 · **Phase:** 3 · **Depends on:** M1, M2, M3 signals

## Purpose
A single comparable 0–100 score per neighborhood/estate that communities can rally around and measure progress against.

```
Estate A    91
Estate B    84
Estate C    53
```

## Composition (v1 — weights tuned with Safi, methodology versioned)
| Component | Signal source | Weight |
|---|---|---|
| Litter density | M1 detections on street-segment photos, normalized per segment | 35% |
| Bin overflow rate | M2: % observations in overflow band | 30% |
| Illegal dumping | M3: active confirmed sites/km², recency-decayed | 20% |
| Collection reliability | M4/M2: on-time collection rate | 15% |

## Requirements
- **M6-F1.** Defined area boundaries (estates/wards as GeoJSON polygons, agreed with Safi and hosts).
- **M6-F2.** Daily score computation with component breakdown — a score you can't decompose is a score nobody trusts.
- **M6-F3.** Trends and event annotations: cleanup events, new bins, interventions marked on the timeline so cause-and-effect is visible.
- **M6-F4.** Data sufficiency guard: areas below a minimum observation count show "insufficient data," never a misleading score.
- **M6-F5.** Public presentation (open API + optional public page): framed as *progress tracking*, with trend emphasized over rank.
- **M6-F6.** Methodology page: formula, weights, version history — public.

## Design cautions
- **Shaming risk:** a league table can stigmatize poorer areas that receive worse service — the score partly measures *service*, not residents' behavior. Mitigations: publish trend > rank; pair every low score with "what would raise it"; let host communities opt in to public display.
- **Goodhart's law:** if collectors are ever evaluated on the index, photos will bias. Index is never a staff performance metric.

## Acceptance criteria
- Scores move sensibly on known events (post-cleanup bump, dumping-site discovery dip) in ≥ 3 documented cases.
- ≥ 2 communities actively using their score/trend in cleanup organizing by end of Phase 3.
