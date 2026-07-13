# 04 — ML Strategy

## The core insight

**Our moat is not the model — it's the labeled, local, longitudinal dataset that Safi's operations generate.** Public waste datasets are photographed in the West, on clean backgrounds, or as street litter — none reflect Kenyan bins, waste streams, packaging brands, or lighting. Phase 0 exists to build the dataset; models come second.

## Tasks

| Task | Type | Input | Output |
|---|---|---|---|
| T1 Waste object detection | Object detection | photo | bounding boxes: waste items |
| T2 Material classification | Classification (per box or per region) | photo + boxes | plastic / glass / metal / paper / organic / e-waste / textile / other |
| T3 Bin fill-level estimation | Ordinal classification | photo of **any** bin | empty / low / half / high / overflowing + confidence |
| T4 Dumping candidate flagging | Scene classification + change detection | photo of non-bin location, or repeat photos of same spot | "waste accumulation present" score |
| T5 Person/face detection (privacy gate) | Detection | every ingested photo | blur regions (applied then discarded) |
| T6 Quantity estimation | Regression (later phase) | photo + boxes | item counts; volume estimate via bin-relative calibration |

## Datasets

### Public (bootstrap / pretraining)
| Dataset | Contents | Use |
|---|---|---|
| **TACO** (Trash Annotated in Context) | ~1.5k images, 60 litter categories, COCO format, in-the-wild | Pretrain T1/T2; category taxonomy reference |
| **TrashNet** | ~2.5k single-object images, 6 classes, clean background | Classification pretraining only (domain gap is large) |
| **ZeroWaste** | Conveyor-belt sorting imagery | T2 material features |
| **Roboflow Universe waste sets** | Various community sets | Augmentation; verify licenses per set |
| COCO / Open Images | General objects | Backbone pretraining (comes free with model zoo weights) |

*License check for each dataset is a Phase 0 task — record in `DATASETS.md` in the repo when created.*

### Local (the real asset) — the **Safi Waste Dataset**
Collected in Phase 0 via the field app during normal operations:

- **Bin photos:** every bin visit → 1 photo + collector's fill-level tap. Target: 5,000–10,000 images in 8–12 weeks, spanning weather, lighting, seasons.
- **Load photos:** truck load before tipping → composition ground truth at the aggregate level.
- **Sorting photos:** at Safi's sorting site, photos of separated material piles → clean per-material images from the *local* waste stream (the highest-value labels we can get, nearly free).
- **Street segments:** collectors photograph assigned street stretches weekly → litter density + dumping baseline.

Published (after privacy scrub + review) as an open dataset — likely the first open Kenyan community waste-stream image dataset, which is itself a headline contribution.

## Labeling plan

- **Tool:** Label Studio (self-hosted, free) or CVAT. Start with Label Studio for its simpler UX.
- **Who:** 2–3 Safi members trained as labelers (paid work — budget it); community volunteers for overflow; developer spot-checks.
- **What:** fill-level comes free from collector taps. Detection boxes on a stratified sample (not every image). Material labels on sorting-site photos are nearly automatic (whole photo = one material).
- **Quality:** 10% double-labeled → inter-annotator agreement tracked; disagreements adjudicated weekly; a **golden test set** (~500 images, never trained on, locally captured) frozen before first model training.
- **Active learning loop:** every prediction the ops team corrects in the dashboard review queue is auto-added to the labeling pool. Retraining monthly during pilot.

## Taxonomy (v1)

Top-level classes (what the analytics report on):

```
plastic      (sub: PET bottle, HDPE, film/bag, other)
glass        (sub: bottle, other)
metal        (sub: aluminum can, steel/tin, other)
paper        (sub: cardboard, paper, carton/tetrapak)
organic      (sub: food, garden)
e-waste
textile
other/mixed
```

Rules: report at top level; sub-classes are best-effort and drive M5 (recycling value) only where confidence is high. Taxonomy maps to TACO categories for pretraining compatibility (mapping table to live in repo).

## Models

| Task | Baseline (Phase 1) | Notes |
|---|---|---|
| T1+T2 | Single-stage detector with material classes (YOLO-family, small/medium variant), fine-tuned TACO → Safi dataset | **Licensing:** Ultralytics YOLOv8/11 is AGPL-3.0 — acceptable since OWI is open-source anyway, but evaluate Apache-2.0 alternatives (RT-DETR via PaddleDetection/HF, YOLO-NAS, RF-DETR) so downstream users aren't constrained. Decision = ADR in repo. |
| T3 | CNN ordinal classifier (MobileNetV3/EfficientNet-lite head) on the whole bin photo — **bin-type-agnostic**, works on any bin, no per-bin reference required | A registered bin's reference photo is an *optional* enhancement (crop/align) where available, never a requirement. Trains on fill-labeled bin photos from any source; generalizes across bin types so the model — and the whole platform — deploys for any operator, not just Safi. |
| T4 | Two signals ORed: (a) T1 detection density at a non-bin location, (b) image-diff vs. reference photo of known hotspots | Always human-confirmed. Precision matters more than recall at first. |
| T5 | Off-the-shelf person/face detector (e.g., YOLO person class + a face model) tuned for high recall | High recall > precision: over-blurring is acceptable, under-blurring is not. |

**Runtime:** export to ONNX, run on CPU via onnxruntime in batch workers. Target ≥ 2 images/sec/core for the detector's small variant. No GPU required for pilot volumes (~300 photos/day).

## Evaluation

- **Golden test set** (local, frozen) is the only accuracy number that matters for go/no-go decisions. Public-dataset scores are for sanity only.
- Targets (from PRD): detection+classification macro-F1 ≥ 0.80 on top-7 classes; fill-level ±1-band accuracy ≥ 90%; privacy gate person-recall ≥ 0.99 on a dedicated person-containing test set.
- **Operational eval (the real test):** weekly, compare model fill predictions vs. collector taps; compare predicted composition vs. sorting-site actuals. Publish these drift dashboards internally.
- Every model artifact is versioned (task, git commit, dataset snapshot hash, metrics) — MLflow or a simple models registry table; predictions store model version.

## Known hard problems (be honest early)

| Problem | Mitigation |
|---|---|
| Occlusion & compaction: a photo sees the top of a bin, not its contents | Fill level is genuinely visible; *composition* from bin photos is biased toward surface. Correct with sorting-site ground truth as calibration; report composition at aggregate level with stated uncertainty. |
| Black plastic bags hide everything | Classify as "mixed/bagged"; composition inferred statistically from sorting data, not per-photo. |
| Night/rain/lens-dirt image quality | OpenCV quality gate at ingestion: reject/flag blurry, dark, obstructed images with instant "retake" feedback in-app. |
| Volume/weight from 2D images | Phase 1: fill-band × bin volume × material density table = tonnage estimate; calibrate against any weighbridge/scale data Safi can get. Never present as precise. |
| Domain drift (new packaging, seasons) | Monthly retrain cadence; drift monitoring vs. collector taps. |
| Class imbalance (organic dominates) | Stratified sampling for labeling; focal loss / class weights; report per-class metrics not just aggregate. |
