# 01 — Problem Statement

## The problem

Waste management in East African cities and peri-urban communities runs almost entirely blind:

- **Collection is schedule-driven, not need-driven.** Trucks visit bins on fixed rotations. Some bins overflow for days; others are emptied half-full. Fuel, labor, and goodwill are wasted on both ends.
- **Nobody knows the composition of the waste stream.** Recyclers, municipalities, and CBOs cannot answer "what fraction of our waste is plastic?" for a specific estate on a specific week. Without composition data, recycling economics are guesswork.
- **Illegal dumping is invisible until it's a crisis.** Dumping hotspots form silently. By the time a site is noticed, it has become normalized and expensive to remediate.
- **Community organizations can't prove impact.** CBOs like Safi do real, measurable environmental work but lack the data to demonstrate it to grant-makers, county governments, and corporate sustainability programs. Grants go to whoever has numbers.
- **Existing tools are closed, expensive, or hardware-heavy.** Commercial "smart bin" solutions require per-bin sensors ($50–300 each), cloud subscriptions, and vendor lock-in — non-starters for a CBO with 150 bins and two trucks.

## Who has this problem

| Stakeholder | Their pain today | What OWI gives them |
|---|---|---|
| **Safi Cleaners and Recyclers (anchor partner)** | Fixed routes waste fuel; overflows damage community trust; no data for grant applications | Need-driven collection, route optimization, grant-ready impact reports |
| **Waste collectors / drivers** | Wasted trips to empty bins; no visibility into which areas need attention | A daily prioritized list and route |
| **Recycling cooperatives & buyers** | Can't estimate material supply from an area | Weekly material volumes and estimated value by location |
| **Estate managers, schools, businesses** | Overflow complaints; no way to compare service quality | Bin health scores and cleanliness index for their site |
| **County/municipal officers** | No independent data on waste generation or service coverage | Open data API with per-ward aggregates |
| **Residents / community volunteers** | Cleanups feel unmeasured and Sisyphean | Cleanliness index trends; visible progress after events |
| **Researchers & other CBOs** | No open datasets on African urban waste streams | Open, anonymized dataset + open-source platform they can deploy |

## Why computer vision

A photo is the cheapest sensor that exists. Every collector already carries a phone. A single photo of a bin, a truck load, or a street segment — taken during work that is already happening — can yield fill level, material composition, and litter density. No per-bin hardware, no subscriptions, no new workflows beyond "take a photo."

## Why now, and why us

- **Ground truth is the scarce resource in waste ML, and we have it.** Safi operates real collections daily. Every prediction the system makes can be checked against what collectors actually find. Academic waste datasets (TACO, TrashNet) exist, but no one has closed the loop with a real operator at community scale.
- **Detection models are commoditized.** YOLO-family models run on a mid-range phone. The hard part is no longer "can we detect trash" — it's the analytics, operations integration, and data governance layer. That's where OWI focuses.
- **The funding environment rewards measurement.** Carbon reporting, ESG programs, and climate-adjacent grants all demand quantified impact. A CBO that can say "18,432 plastic bottles diverted, X tonnes CO₂e avoided, methodology attached" is fundable in a way its peers are not.

## What "success" means (plain language)

1. Safi's trucks drive fewer kilometers per tonne collected than before OWI.
2. Overflow incidents at monitored bins drop measurably.
3. Safi wins at least one grant or recycling contract using OWI-generated reports.
4. At least one other organization deploys OWI independently from the open-source repo.

## What this is NOT

- Not a consumer littering-report app (there are many; they die from one-sided marketplaces).
- Not a surveillance system. We detect **waste and locations**, never people. See [08-data-governance-ethics.md](08-data-governance-ethics.md).
- Not a hardware company. Phones first; fixed cameras only where a site owner requests and hosts one.
- Not a smart-city moonshot. Everything must work for an organization with 2 trucks, 20 collectors, 150 bins, and intermittent connectivity.
