# OWI ML (`/ml`)

Training, evaluation, and dataset tooling. The current phase is dataset collection: field photos land in MinIO, get labeled in Label Studio, and export as COCO snapshots.

Detector baseline: RT-DETR family (Apache-2.0 licensed — AGPL detectors are excluded), TACO → Safi fine-tune, ONNX export, CPU inference.

## Can we train on public data?

Partly — and the tooling is built for it. Generic material appearance transfers (a bottle is a bottle worldwide), so public sets (TACO, TrashNet, ZeroWaste, Roboflow) **pretrain** T1/T2. What does *not* transfer — Kenyan packaging, waste composition, black-bag bagging, and especially T3 fill-level (tied to Safi's registered bins) — is learned by **fine-tuning on the local Label Studio export**. The frozen local **golden set** is the only accuracy gate.

`data/taxonomy_map.py` folds any source dataset's categories into the OWI 8 classes; `data/coco.py` loads and merges them (local wins on conflicts); `data/split.py` freezes a deterministic golden set by image-name hash so it never leaks into training; `eval/metrics.py` computes the macro-F1 gate (≥ 0.80).

## Train pipeline (real, runnable)

From the repo root:

```sh
make ml-setup     # install the training stack (PyTorch, torchvision, …)
make ml-data      # download public waste images (TrashNet) into ml/datasets/trashnet
make ml-train     # fine-tune MobileNetV3 → golden-set macro-F1 → ONNX in ml/artifacts/
make ml-register API_URL=http://localhost:8000 TOKEN=<admin-jwt> VERSION=v1   # publish + activate
```

Training fine-tunes a small ImageNet backbone on the material classes, evaluates on the
deterministic **golden split** (frozen by filename hash — never trained on) with the same
macro-F1 gate used for release, and exports `classifier.onnx` + `labels.json` + `metrics.json`.
Re-run with the local Safi export folded in to fine-tune on Kenyan waste; activating a model
makes the batch worker score observations into the review queue.

Base checks (no training stack needed): `uv run ruff check . && uv run mypy && uv run pytest`

## Labeling pipeline

```sh
docker compose up -d labelstudio    # from the repo root; UI at http://localhost:8080
uv sync
uv run python -m owi_ml.labeling.setup_project   # idempotent: project + taxonomy + MinIO storage + sync
uv run python -m owi_ml.labeling.export_coco     # COCO snapshot → datasets/snapshots/
```

Sign in with the LABEL_STUDIO_* credentials from the repo-root `.env`. Re-run `setup_project` any time to pull newly ingested images into the labeling queue.

Checks: `uv run ruff check . && uv run mypy && uv run pytest`
