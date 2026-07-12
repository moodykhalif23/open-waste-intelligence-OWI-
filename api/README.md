# OWI Backend (`/api`)

FastAPI backend: ingestion (with privacy gate), registry, analytics, workers.

## Run locally

```sh
docker compose -f ../infra/docker-compose.yml up -d   # Postgres+PostGIS, Redis, MinIO
uv sync
uv run alembic upgrade head
uv run uvicorn owi_api.main:app --reload
```

Worker: `uv run rq worker inference --url redis://localhost:6379/0`

## Checks

```sh
uv run ruff check . && uv run ruff format --check . && uv run mypy && uv run pytest
```

Standards: [docs/10-system-spec.md](../docs/10-system-spec.md). Governance is law: [docs/08](../docs/08-data-governance-ethics.md).
