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

| # | Module                        | One-line purpose                                                        |
| - | ----------------------------- | ----------------------------------------------------------------------- |
| 1 | Waste Classification          | What kinds of waste, in what proportions, where, over time              |
| 2 | Bin Health Monitoring         | Fill level, overflow risk, and collect-now recommendations per bin      |
| 3 | Illegal Dumping Detection     | Find*locations* (never people) that need intervention                 |
| 4 | Collection Route Optimization | "Google Maps for garbage collection" — which bins today, in what order |
| 5 | Recycling Intelligence        | Material counts, estimated value (KES), and partner matching            |
| 6 | Community Cleanliness Index   | A comparable score per neighborhood to organize and measure clean-ups   |
| 7 | Carbon Impact Dashboard       | CO₂ avoided, landfill space saved — with transparent methodology      |
| 8 | Volunteer Analytics           | Hours, events, waste collected — grant-ready CBO reporting             |

## Run it

```sh
# create the repo-root .env with secrets — see docs/11-deployment.md for the template
make web               # builds + starts the whole platform
```

Dashboard at `https://localhost:8443`, field app at `https://localhost:8444` (accept the self-signed cert once per device), Label Studio at `http://localhost:8080`. `make help` lists all targets. First run: `make bootstrap ORG="Safi" NAME="Admin" PHONE="+2547..." PASSWORD="..."`.

Contributors: see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Intended license: Apache-2.0 (code) + CC-BY-4.0 (open data). To be confirmed before first release.
