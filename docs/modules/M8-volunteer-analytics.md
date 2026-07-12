# M8 — Volunteer Analytics

**Priority:** P2 · **Phase:** 3 · **Depends on:** none (mostly non-CV; can even ship early if capacity allows)

## Purpose
Make Safi's community work legible to funders. CBOs win grants with numbers: volunteer hours, events held, waste collected, areas covered, participation trends. Today this lives in notebooks and WhatsApp; OWI makes it structured and report-ready.

## Requirements
- **M8-F1.** Event records: date, location/area, type (cleanup, education, sorting), organizer, participant count, total hours, materials collected (per-material kg — optionally photo-verified via M1 on collected-pile photos).
- **M8-F2.** Fast entry: an event is recordable in < 3 minutes on a phone, including offline; bulk import from a spreadsheet for historical records.
- **M8-F3.** Participant tracking is **aggregate-first**: counts and hours. Named volunteer profiles are optional, consent-based, and exist only to let regular volunteers get their own contribution certificates.
- **M8-F4.** Dashboards: hours, events, kg collected, areas covered (map), participation trend; per-event detail pages with photos.
- **M8-F5.** Grant report generator: date-range report combining M8 stats with M1 composition, M6 index changes around events, and M7 carbon — exported as branded PDF. This is Wanjiru's headline feature (PRD Flow C).
- **M8-F6.** Volunteer certificates: auto-generated per person (opt-in) or per group.

## Acceptance criteria
- All Safi events from pilot period recorded (target: 100% capture, verified monthly).
- Full grant report generated in < 1 hour of human effort, used in ≥ 1 application.
- Historical event backlog (if Safi has records) imported.

## Metrics
Events recorded/month; median entry time; reports generated; grant outcomes referencing OWI data.
