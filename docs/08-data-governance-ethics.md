# 08 — Data Governance & Ethics

A camera-based system operating in communities carries real risks. This document sets the hard lines. It is a **product requirement**, not an appendix — features that violate it don't ship, regardless of usefulness.

## Legal context
Kenya's **Data Protection Act (2019)** applies: images that can identify a person are personal data; processing requires a lawful basis, purpose limitation, and data-subject rights. The Office of the Data Protection Commissioner (ODPC) registration requirements for data controllers/processors must be checked for Safi during Phase 0 (action item). Nothing below substitutes for legal review — budget a consultation.

## Hard lines (never, in any phase)

1. **No identification of people.** No face recognition, person re-identification, gait analysis, or license-plate reading. The only person-related model we run is the privacy gate, whose sole output is blur regions — applied at ingestion, then discarded.
2. **No "who dumped it" features.** M3 finds *locations needing intervention*, never culprits. No resident-reporting of neighbors, no correlation of dumping times with individuals.
3. **No worker surveillance.** GPS breadcrumbs exist only during an active route, visibly to the driver, for plan-vs-actual route metrics. No collector performance scoring from photos, speed, or hours. The cleanliness index is never a staff evaluation tool.
4. **No raw images or precise dump-site/bin coordinates in public outputs.** Open API = aggregates, ward-level, small-cell suppression (< 3 bins or < 20 observations), 7-day delay.
5. **No sale of data.** Open data is free under CC-BY-4.0; internal data belongs to the operating org (Safi), full stop.

## Image lifecycle

```
Capture (collector, during work) 
  → Ingestion: person/face detection → blur → quarantine originals containing people
  → Storage: blurred image + metadata (bin, GPS, time)
  → Use: inference, labeling, review
  → Publication (dataset): second human review pass + hash-dedupe + metadata scrub
  → Retention: operational images 24 months, then aggregate-and-delete (configurable per org)
```

- Quarantined originals (pre-blur) are deleted after the blurred derivative is verified — target ≤ 72 hours.
- Collectors can flag any photo "do not use" (e.g., accidentally captured a private scene) — deleted, no questions.

## Consent & agreements

| Relationship | Instrument |
|---|---|
| Safi ↔ OWI project | Data agreement: Safi owns its operational data; OWI project gets license to publish agreed aggregates + scrubbed dataset; either party can exit with data export. Signed before Phase 0. |
| Safi ↔ site hosts (estates, schools, businesses) | Site agreement: photos taken at their bins/premises, what's published (their site's aggregates), opt-out for public display. Schools: extra care — no images including children published, ever; prefer bin close-ups only on school grounds. |
| Safi ↔ collectors | Work-tool consent: what the app records (photos, route GPS during shifts), what it's never used for (per hard line 3). In plain language + Swahili. |
| Volunteers (named profiles) | Opt-in only; aggregate participation needs no PII. |
| General public | Signage where photos are routinely taken (bin sites) where practical; the strongest protection is technical: blur-at-ingestion. |

## Community data sovereignty
- Each community sees its own data first: index scores and area stats are shared with the host community *before* any public display, and public display is opt-in per area.
- Publication framing: trends and progress, not shame rankings (see M6 cautions).
- An advisory check-in with community reps each phase — 1 hour, structured, minuted.

## Open dataset publication checklist (per snapshot)
- [ ] Automated person re-scan (fresh model) over the entire snapshot
- [ ] Human review of a 10% sample + all flagged images
- [ ] GPS truncated to ~100 m for street images; bin images tagged to site, not coordinates
- [ ] No images from schools with people present; no interiors of private property
- [ ] Datasheet-for-datasets style README (collection method, biases, licensing)
- [ ] Safi sign-off recorded

## Governance operations
- **Data protection lead:** named person (Safi side) + named person (dev side). Contact published.
- **Incident process:** suspected leak/unblurred person published → pull artifact within 24 h, notify Safi + affected host, post-mortem in repo.
- **This doc is versioned;** substantive changes require Safi sign-off.

## Why so strict?
Because the alternative kills the project. One incident — a resident recognizable in a public dataset, a collector disciplined via GPS logs, an estate shamed by a score — destroys the community trust that is OWI's entire advantage over lab-built systems. Strictness is a competitive moat, not a compliance cost.
