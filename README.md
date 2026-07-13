# OpenWaste Intelligence (OWI)

**An open-source computer vision and analytics platform for understanding waste generation, collection efficiency, and environmental health.**

Anchored by a real operating partner — **Safi Cleaners and Recyclers**, a Community-Based Organization (CBO) with active waste collection operations, community members, and access to municipalities, schools, estates, and businesses.

> Not another waste management app. Instead of saying *"there is garbage here,"* OWI answers:
> How much? What type? How fast is it accumulating? How long before overflow? How efficient are collections? Which neighborhoods need more bins? Which routes waste fuel? Which recyclables are most common? Which locations are repeatedly littered?


## The pipeline

```
Camera / Phone
      │
   OpenCV
      │
Object Detection
      │
Waste Classification
      │
   Tracking
      │
Analytics Engine
      │
  Dashboard
      │
Open Data API
```

## Modules

| # | Module | One-line purpose |
|---|--------|------------------|
| 1 | Waste Classification | What kinds of waste, in what proportions, where, over time |
| 2 | Bin Health Monitoring | Fill level, overflow risk, and collect-now recommendations per bin |
| 3 | Illegal Dumping Detection | Find *locations* (never people) that need intervention |
| 4 | Collection Route Optimization | "Google Maps for garbage collection" — which bins today, in what order |
| 5 | Recycling Intelligence | Material counts, estimated value (KES), and partner matching |
| 6 | Community Cleanliness Index | A comparable score per neighborhood to organize and measure clean-ups |
| 7 | Carbon Impact Dashboard | CO₂ avoided, landfill space saved — with transparent methodology |
| 8 | Volunteer Analytics | Hours, events, waste collected — grant-ready CBO reporting |

## Run it

```sh
# create the repo-root .env with secrets — see docs/11-deployment.md for the template
make web               # builds + starts the whole platform
```

Dashboard at `https://localhost:8443`, field app at `https://localhost:8444` (accept the self-signed cert once per device), Label Studio at `http://localhost:8080`. `make help` lists all targets. First run: `make bootstrap ORG="Safi" NAME="Admin" PHONE="+2547..." PASSWORD="..."`.

## Documentation map

Read in this order if you're new:

1. [docs/01-problem-statement.md](docs/01-problem-statement.md) — the problem, who has it, why now
2. [docs/02-prd.md](docs/02-prd.md) — **master PRD**: goals, users, scope, success metrics
3. [docs/03-architecture.md](docs/03-architecture.md) — system design, stack, deployment model
4. [docs/04-ml-strategy.md](docs/04-ml-strategy.md) — datasets, models, labeling, evaluation
5. [docs/05-data-model.md](docs/05-data-model.md) — core entities and open data API shape
6. [docs/modules/](docs/modules/) — per-module requirements (M1–M8)
7. [docs/06-pilot-plan.md](docs/06-pilot-plan.md) — the Safi pilot: phases, sites, validation
8. [docs/07-roadmap.md](docs/07-roadmap.md) — phased delivery plan and MVP definition
9. [docs/08-data-governance-ethics.md](docs/08-data-governance-ethics.md) — privacy, consent, what we will never build
10. [docs/09-risks.md](docs/09-risks.md) — risk register with mitigations
11. [docs/10-system-spec.md](docs/10-system-spec.md) — pinned stack, resolved ADRs, engineering standards
12. [docs/11-deployment.md](docs/11-deployment.md) — one-compose production deploy (VPS or mini-PC)
13. [docs/STATUS.md](docs/STATUS.md) — **build status: the single source of truth for what's done and what's next**
14. [docs/glossary.md](docs/glossary.md) — shared vocabulary

Contributors: see [CONTRIBUTING.md](CONTRIBUTING.md).

## Status

**Phase 0 — Foundation, code underway** (started 2026-07-12). Backend spine (ingestion + privacy gate + auth + bin registry), field PWA spike, and dashboard skeleton are built and verified end-to-end. Progress is tracked in exactly one place: [docs/STATUS.md](docs/STATUS.md).

## License

Intended license: Apache-2.0 (code) + CC-BY-4.0 (open data). To be confirmed before first release.
