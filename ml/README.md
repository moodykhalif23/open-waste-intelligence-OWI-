# OWI ML (`/ml`)

Training, evaluation, and dataset tooling. The current phase is dataset collection: field photos land in MinIO, get labeled in Label Studio, and export as COCO snapshots.

Detector baseline: RT-DETR family (Apache-2.0 licensed — AGPL detectors are excluded), TACO → Safi fine-tune, ONNX export, CPU inference.

## Labeling pipeline

```sh
docker compose up -d labelstudio    # from the repo root; UI at http://localhost:8080
uv sync
uv run python -m owi_ml.labeling.setup_project   # idempotent: project + taxonomy + MinIO storage + sync
uv run python -m owi_ml.labeling.export_coco     # COCO snapshot → datasets/snapshots/
```

Sign in with the LABEL_STUDIO_* credentials from the repo-root `.env`. Re-run `setup_project` any time to pull newly ingested images into the labeling queue.

Checks: `uv run ruff check . && uv run mypy && uv run pytest`
