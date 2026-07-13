import json
from collections import Counter
from dataclasses import dataclass
from pathlib import Path

from owi_ml.data.taxonomy_map import map_category


@dataclass(frozen=True)
class LabeledImage:
    file_name: str
    owi_labels: list[str]  # OWI classes present in this image (deduped)


@dataclass(frozen=True)
class CocoDataset:
    images: list[LabeledImage]

    def class_counts(self) -> dict[str, int]:
        counts: Counter[str] = Counter()
        for image in self.images:
            counts.update(set(image.owi_labels))
        return dict(counts)


def load_coco(path: Path) -> CocoDataset:
    """Read a COCO result.json (Label Studio export or public set), mapped to OWI classes."""
    data = json.loads(path.read_text(encoding="utf-8"))
    category_to_owi = {c["id"]: map_category(c["name"]) for c in data["categories"]}
    by_image: dict[int, set[str]] = {img["id"]: set() for img in data["images"]}
    for ann in data["annotations"]:
        owi = category_to_owi.get(ann["category_id"])
        if owi is not None:
            by_image[ann["image_id"]].add(owi)
    names = {img["id"]: img["file_name"] for img in data["images"]}
    images = [
        LabeledImage(file_name=names[img_id], owi_labels=sorted(labels))
        for img_id, labels in by_image.items()
    ]
    return CocoDataset(images)


def merge(*datasets: CocoDataset) -> CocoDataset:
    """Combine public pretrain sets with the local export; dedupe by file name (local wins)."""
    seen: dict[str, LabeledImage] = {}
    for dataset in datasets:
        for image in dataset.images:
            seen[image.file_name] = image
    return CocoDataset(list(seen.values()))
