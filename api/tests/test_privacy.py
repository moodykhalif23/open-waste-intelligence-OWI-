import cv2
import numpy as np
import pytest

from owi_api.ingestion.privacy import Box, GateResult, apply_privacy_gate
from owi_api.ingestion.quality import decode_image
from owi_api.models.enums import PrivacyStatus


class StubDetector:
    def __init__(self, boxes: list[Box]) -> None:
        self._boxes = boxes

    def detect(self, image: np.ndarray) -> list[Box]:
        return self._boxes


def encode(image: np.ndarray) -> bytes:
    ok, buffer = cv2.imencode(".jpg", image)
    assert ok
    return buffer.tobytes()


def noisy_image() -> np.ndarray:
    rng = np.random.default_rng(42)
    return rng.integers(0, 255, (200, 300, 3), dtype=np.uint8)


def test_clean_image_passes_through_unmodified() -> None:
    image = noisy_image()
    original = encode(image)
    result = apply_privacy_gate(image, original, StubDetector([]))
    assert result == GateResult(original, PrivacyStatus.CLEAN, 0)


def test_person_region_is_blurred() -> None:
    image = noisy_image()
    result = apply_privacy_gate(image, encode(image), StubDetector([(100, 50, 60, 100)]))
    assert result.status is PrivacyStatus.BLURRED
    assert result.person_count == 1

    blurred = cv2.imdecode(np.frombuffer(result.image_bytes, np.uint8), cv2.IMREAD_COLOR)
    region = blurred[60:140, 110:150].astype(np.float64)
    untouched = blurred[10:40, 10:40].astype(np.float64)
    assert region.std() < untouched.std() / 2


def test_undecodable_bytes_rejected() -> None:
    with pytest.raises(ValueError, match="decodable"):
        decode_image(b"not an image")
