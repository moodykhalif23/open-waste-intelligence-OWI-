# Contributing to OpenWaste Intelligence

Thanks for your interest! OWI is an open-source computer vision and analytics platform for community waste operations, developed hand-in-hand with Safi Cleaners and Recyclers (Kenya).

## Current status

Code is underway — see [docs/STATUS.md](docs/STATUS.md) for what's built and what's next. Valuable contributions right now:

- **Review the docs** in [docs/](docs/) — especially the [ML strategy](docs/04-ml-strategy.md), [architecture](docs/03-architecture.md), and [data governance](docs/08-data-governance-ethics.md). Open an issue for anything unclear, wrong, or missing.
- **Domain expertise:** waste management operations, recycling economics in East Africa, vehicle routing, waste-vision ML (TACO and friends), Kenya Data Protection Act compliance.
- **Dataset knowledge:** licenses and quality of public waste datasets; experience publishing image datasets responsibly.

## Ground rules

1. **The governance doc is law.** [docs/08-data-governance-ethics.md](docs/08-data-governance-ethics.md) defines hard lines (no person identification, no worker surveillance, aggregates-only public data). PRs that violate it will be declined regardless of technical merit.
2. **Operations-first.** Features must trace to a decision a real operator makes. "Cool" is not a requirement.
3. **Cheap-first.** The reference deployment is one modest server and mid-range Android phones. Dependencies that assume GPUs, paid APIs, or heavy cloud services need strong justification.
4. **Be kind and practical.** Many stakeholders here are not software people; write for them.

## How to contribute

1. Open an issue describing the problem/gap before a large PR.
2. For doc edits: PR with a clear summary of what changed and why.
3. Decisions of consequence get an ADR-style note in [docs/10-system-spec.md](docs/10-system-spec.md).

## Code conventions

- Monorepo: `/app` (field PWA), `/api` (FastAPI backend), `/ml` (training/eval), `/dash` (dashboard), `/docs`.
- Python: ruff + mypy strict + full type hints; TypeScript: strict mode + eslint.
- Comments: at most 3 lines, only for a *why* the code can't show, fully self-contained (no doc/requirement references).
- Tests required for analytics formulas (bin health, index, carbon) and ingestion invariants — these produce published numbers.
- Model changes must report golden-test-set metrics in the PR.
- Secrets only in gitignored `.env` (see `.env.example`) — never in code or compose files.
- Licenses: Apache-2.0 (code), CC-BY-4.0 (published data) — pending final confirmation.

## Community

Primary language: English; Swahili translations welcome everywhere user-facing. Be respectful of the operational partner — Safi's field staff time is the scarcest resource in this project.
