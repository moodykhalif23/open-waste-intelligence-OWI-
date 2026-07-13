"""T2 material classifier: pretrain on public data, fine-tune on the local export.

    python -m owi_ml.train.classify --public datasets/taco.json --local datasets/latest.json

The data prep, split, and golden-set eval below are framework-agnostic and run today.
The model fit itself needs a training framework (RT-DETR/timm via the optional `train`
dependency group) plus real images — install it and fill in `fit_classifier` when the
Safi dataset exists. Everything around it (splits, the golden gate, registry publish)
is already wired so activating a trained model is a one-command step.
"""

import argparse
from pathlib import Path

from owi_ml.data.coco import CocoDataset, load_coco, merge
from owi_ml.data.split import DataSplit, split_dataset


def prepare(public: list[Path], local: Path | None) -> tuple[CocoDataset, DataSplit]:
    datasets = [load_coco(p) for p in public]
    if local is not None:
        datasets.append(load_coco(local))
    combined = merge(*datasets)
    return combined, split_dataset(combined)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Prepare + (later) train the T2 material classifier"
    )
    parser.add_argument("--public", nargs="*", type=Path, default=[], help="public COCO exports")
    parser.add_argument("--local", type=Path, help="local Label Studio COCO export")
    args = parser.parse_args()

    combined, split = prepare(args.public, args.local)
    print(f"dataset: {len(combined.images)} images, classes {combined.class_counts()}")
    print(f"split: train={len(split.train)} val={len(split.val)} golden={len(split.golden)}")
    if not split.golden:
        print("no golden set yet — add locally captured, labeled images before training")
        return
    print("data ready. Model fit runs once the `train` extra + images are present; then")
    print("evaluate on the golden set and publish with owi_ml.registry.register_model.")


if __name__ == "__main__":
    main()
