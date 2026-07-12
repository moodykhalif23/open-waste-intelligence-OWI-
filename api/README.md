# OWI Backend (`/api`)

FastAPI backend: ingestion (with privacy gate), registry, analytics, workers.

## Run locally

```sh
docker compose up -d   # from the repo root: Postgres+PostGIS, Redis, MinIO
uv sync
uv run alembic upgrade head
uv run uvicorn owi_api.main:app --reload
```

Worker: `uv run rq worker inference --url redis://localhost:6379/0`
Maintenance scheduler (hourly quarantine purge): `uv run python -m owi_api.scheduler`

## First-time setup

```sh
uv run python -m owi_api.bootstrap --org "Safi" --name "Admin" --phone "+2547..." --password "..."
```

Then `POST /api/v1/auth/login` with phone + password for an access token, and
`POST /api/v1/auth/device-tokens` (as admin/coordinator) to issue long-lived collector tokens
for field phones. Revoke a user's tokens by bumping their `token_version`.

## Checks

```sh
uv run ruff check . && uv run ruff format --check . && uv run mypy && uv run pytest
```
