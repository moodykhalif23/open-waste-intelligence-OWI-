import hashlib
from dataclasses import dataclass

from owi_ml.data.coco import CocoDataset, LabeledImage

GOLDEN_FRACTION = 0.15


@dataclass(frozen=True)
class DataSplit:
    train: list[LabeledImage]
    val: list[LabeledImage]
    golden: list[LabeledImage]


def _bucket(file_name: str) -> float:
    # Hash the file name to a stable 0-1 position: the same image always lands in the
    # same split across runs, so the golden set never leaks into training.
    digest = hashlib.sha256(file_name.encode()).hexdigest()
    return int(digest[:8], 16) / 0xFFFFFFFF


def split_dataset(
    dataset: CocoDataset, golden_fraction: float = GOLDEN_FRACTION, val_fraction: float = 0.15
) -> DataSplit:
    train, val, golden = [], [], []
    for image in dataset.images:
        b = _bucket(image.file_name)
        if b < golden_fraction:
            golden.append(image)
        elif b < golden_fraction + val_fraction:
            val.append(image)
        else:
            train.append(image)
    return DataSplit(train=train, val=val, golden=golden)
