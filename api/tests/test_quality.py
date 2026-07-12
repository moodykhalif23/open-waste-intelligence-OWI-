import cv2
import numpy as np

from owi_api.ingestion.quality import assess_quality


def noisy_image(height: int = 480, width: int = 640) -> np.ndarray:
    rng = np.random.default_rng(7)
    return rng.integers(0, 255, (height, width, 3), dtype=np.uint8)


def test_sharp_bright_image_passes() -> None:
    result = assess_quality(noisy_image())
    assert result.ok
    assert result.sharpness > 0 and 0 < result.brightness < 255


def test_dark_image_flagged() -> None:
    dark = (noisy_image() * 0.05).astype(np.uint8)
    assert "dark" in assess_quality(dark).flags


def test_overexposed_image_flagged() -> None:
    bright = np.clip(noisy_image().astype(np.int32) + 200, 0, 255).astype(np.uint8)
    assert "overexposed" in assess_quality(bright).flags


def test_blurry_image_flagged() -> None:
    blurred = cv2.GaussianBlur(noisy_image(), (51, 51), 0)
    assert "blurry" in assess_quality(blurred).flags


def test_tiny_image_flagged() -> None:
    assert "too_small" in assess_quality(noisy_image(200, 200)).flags
