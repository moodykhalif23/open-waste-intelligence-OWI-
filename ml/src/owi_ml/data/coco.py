from dataclasses import dataclass


@dataclass(frozen=True)
class LabeledImage:
    file_name: str
    owi_labels: list[str]


@dataclass(frozen=True)
class CocoDataset:
    images: list[LabeledImage]
