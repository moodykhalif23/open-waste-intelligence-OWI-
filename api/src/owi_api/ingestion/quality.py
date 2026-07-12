from dataclasses import dataclass

import cv2
import numpy as np

# Lenient on purpose: rejecting a usable field photo costs more than storing a mediocre one.
MIN_SIDE_PX = 320
MIN_BRIGHTNESS = 35.0
MAX_BRIGHTNESS = 235.0
MIN_SHARPNESS = 40.0


def decode_image(image_bytes: bytes) -> np.ndarray:
    image = cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("not a decodable image")
    return image


@dataclass(frozen=True)
class QualityResult:
    flags: tuple[str, ...]
    brightness: float
    sharpness: float

    @property
    def ok(self) -> bool:
        return not self.flags


def assess_quality(image: np.ndarray) -> QualityResult:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    brightness = float(gray.mean())
    sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())

    flags: list[str] = []
    if min(image.shape[0], image.shape[1]) < MIN_SIDE_PX:
        flags.append("too_small")
    if brightness < MIN_BRIGHTNESS:
        flags.append("dark")
    elif brightness > MAX_BRIGHTNESS:
        flags.append("overexposed")
    if sharpness < MIN_SHARPNESS:
        flags.append("blurry")
    return QualityResult(tuple(flags), brightness, sharpness)
