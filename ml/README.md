# OWI ML (`/ml`)

Training, evaluation, and dataset tooling. The current phase is dataset collection: field photos land in MinIO, get labeled in Label Studio, and export as COCO snapshots.

Detector baseline: RT-DETR family (Apache-2.0 licensed — AGPL detectors are excluded), TACO → Safi fine-tune, ONNX export, CPU inference.

## Can we train on public data?

Partly — and the tooling is built for it. Generic material appearance transfers (a bottle is a bottle worldwide), so public sets (TACO, TrashNet, ZeroWaste, Roboflow) **pretrain** T1/T2. What does *not* transfer — Kenyan packaging, waste composition, black-bag bagging, and especially T3 fill-level (tied to Safi's registered bins) — is learned by **fine-tuning on the local Label Studio export**. The frozen local **golden set** is the only accuracy gate.

`data/taxonomy_map.py` folds any source dataset's categories into the OWI 8 classes; `data/coco.py` loads and merges them (local wins on conflicts); `data/split.py` freezes a deterministic golden set by image-name hash so it never leaks into training; `eval/metrics.py` computes the macro-F1 gate (≥ 0.80).

## Train pipeline

```sh
uv sync
uv run python -m owi_ml.train.classify --public datasets/taco.json --local datasets/snapshots/latest.json
```

Data prep, splits, and the golden gate run today. The model fit needs a framework (optional `train` dependency group) plus real images; once a model is trained and evaluated, publish it with `owi_ml.registry.register_model` — activating it makes the batch worker start scoring observations into the review queue.

Checks: `uv run ruff check . && uv run mypy && uv run pytest`

## Labeling pipeline

```sh
docker compose up -d labelstudio    # from the repo root; UI at http://localhost:8080
uv sync
uv run python -m owi_ml.labeling.setup_project   # idempotent: project + taxonomy + MinIO storage + sync
uv run python -m owi_ml.labeling.export_coco     # COCO snapshot → datasets/snapshots/
```

Sign in with the LABEL_STUDIO_* credentials from the repo-root `.env`. Re-run `setup_project` any time to pull newly ingested images into the labeling queue.

Checks: `uv run ruff check . && uv run mypy && uv run pytest`
