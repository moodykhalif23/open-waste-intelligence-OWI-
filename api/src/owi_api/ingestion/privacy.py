from dataclasses import dataclass
from typing import Protocol

import cv2
import numpy as np

from owi_api.models.enums import PrivacyStatus

Box = tuple[int, int, int, int]  # x, y, w, h

# Governance hard line: over-blurring is acceptable, under-blurring is not.
BOX_MARGIN = 0.15


class PersonDetector(Protocol):
    def detect(self, image: np.ndarray) -> list[Box]: ...


class HogPersonDetector:
    """Bootstrap detector — replaced by a high-recall ONNX person model before pilot (T5)."""

    def __init__(self) -> None:
        self._hog = cv2.HOGDescriptor()
        self._hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())  # type: ignore[attr-defined]

    def detect(self, image: np.ndarray) -> list[Box]:
        boxes, _ = self._hog.detectMultiScale(image, winStride=(8, 8))
        return [tuple(int(v) for v in box) for box in boxes]  # type: ignore[misc]


@dataclass(frozen=True)
class GateResult:
    image_bytes: bytes
    status: PrivacyStatus
    person_count: int


def _expand(box: Box, shape: tuple[int, ...]) -> Box:
    x, y, w, h = box
    dx, dy = int(w * BOX_MARGIN), int(h * BOX_MARGIN)
    x0, y0 = max(0, x - dx), max(0, y - dy)
    x1, y1 = min(shape[1], x + w + dx), min(shape[0], y + h + dy)
    return x0, y0, x1 - x0, y1 - y0


def _blur_region(image: np.ndarray, box: Box) -> None:
    x, y, w, h = box
    kernel = max(31, (max(w, h) // 4) | 1)
    image[y : y + h, x : x + w] = cv2.GaussianBlur(image[y : y + h, x : x + w], (kernel, kernel), 0)


def apply_privacy_gate(image_bytes: bytes, detector: PersonDetector) -> GateResult:
    """Blur people before anything is persisted (docs/08, image lifecycle)."""
    image = cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("not a decodable image")

    boxes = detector.detect(image)
    if not boxes:
        return GateResult(image_bytes, PrivacyStatus.CLEAN, 0)

    for box in boxes:
        _blur_region(image, _expand(box, image.shape))
    ok, encoded = cv2.imencode(".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, 85])
    if not ok:
        raise ValueError("failed to re-encode blurred image")
    return GateResult(encoded.tobytes(), PrivacyStatus.BLURRED, len(boxes))
