# M3 — Illegal Dumping Detection

**Priority:** P1 · **Phase:** 2 · **Depends on:** M1

## Purpose
Identify **locations** that repeatedly accumulate waste outside designated bins, so interventions (a new bin, signage, a cleanup, community engagement) land where they matter. Explicitly *not* about identifying people — see the hard constraints below.

## How it works
1. Collectors photograph assigned street segments and known trouble spots during normal rounds (Phase 0 habit).
2. System flags "waste accumulation" candidates: (a) waste detections at non-bin locations above a density threshold, or (b) image-diff against a reference photo of a monitored spot.
3. **A human reviews every candidate** before it becomes a dumping event. No automatic records.
4. Confirmed events cluster into DumpingSites with time, frequency, volume trend, and status (active / cleaned / recurring).

## Requirements
- **M3-F1.** Candidate flagging pipeline with review queue (approve / reject / duplicate).
- **M3-F2.** Hotspot map (internal only): sites colored by recency × frequency; recurring sites highlighted.
- **M3-F3.** Per-site timeline: first seen, events, cleanups, recurrence after cleanup.
- **M3-F4.** Intervention tracking: record what was tried (bin added, signage, cleanup) → did recurrence drop? This is the module's real product: *evidence about which interventions work*.
- **M3-F5.** Analytics: events by time-of-day/day-of-week (from photo timestamps of *accumulation appearance*, coarse), by area, trend lines.

## Hard constraints (non-negotiable, from governance doc)
- No person detection output is ever stored or displayed; privacy gate blurs people before storage.
- No attempt to infer *who* dumped: no vehicle plates, no time-correlation with individuals, no resident-facing "report your neighbor" features.
- Precise dump-site coordinates are internal-only; open API exposes ward-level counts.
- Photos of private property require the host's consent (site agreement).

## Acceptance criteria
- Candidate precision ≥ 70% (reviewer approval rate) after month 2 — recall grows over time; wasted review time is the cost to control.
- ≥ 5 recurring hotspots identified and ≥ 2 interventions executed and measured during pilot.

## Metrics
Confirmed sites; recurrence rate post-cleanup; reviewer approval rate; intervention effectiveness (events/month before vs. after).
