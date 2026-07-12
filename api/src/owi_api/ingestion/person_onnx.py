from pathlib import Path

import cv2
import numpy as np
import onnxruntime

from owi_api.ingestion.privacy import Box

# Recall over precision: a false blur costs a patch of pixels,
# a missed person is a governance incident.
PERSON_CLASS = 0
SCORE_THRESHOLD = 0.2
NMS_THRESHOLD = 0.45
STRIDES = (8, 16, 32)


def letterbox(image: np.ndarray, size: int) -> tuple[np.ndarray, float]:
    """YOLOX preprocessing: scale into a 114-padded square, no normalization."""
    ratio = min(size / image.shape[0], size / image.shape[1])
    resized = cv2.resize(
        image,
        (round(image.shape[1] * ratio), round(image.shape[0] * ratio)),
        interpolation=cv2.INTER_LINEAR,
    )
    padded = np.full((size, size, 3), 114, dtype=np.uint8)
    padded[: resized.shape[0], : resized.shape[1]] = resized
    return np.ascontiguousarray(padded.transpose(2, 0, 1), dtype=np.float32), ratio


def decode_predictions(raw: np.ndarray, size: int) -> np.ndarray:
    """Map YOLOX raw grid outputs to [N, 85] with cx,cy,w,h in input pixels."""
    grids, strides = [], []
    for stride in STRIDES:
        cells = size // stride
        ys, xs = np.meshgrid(np.arange(cells), np.arange(cells), indexing="ij")
        grids.append(np.stack((xs, ys), axis=2).reshape(-1, 2))
        strides.append(np.full((cells * cells, 1), stride))
    grid = np.concatenate(grids).astype(np.float64)
    stride_col = np.concatenate(strides).astype(np.float64)

    decoded: np.ndarray = raw[0].astype(np.float64)
    decoded[:, :2] = (decoded[:, :2] + grid) * stride_col
    decoded[:, 2:4] = np.exp(decoded[:, 2:4]) * stride_col
    return decoded


class OnnxPersonDetector:
    def __init__(self, model_path: Path) -> None:
        if not model_path.exists():
            raise FileNotFoundError(
                f"person model missing at {model_path} — run: python scripts/fetch_models.py"
            )
        self._session = onnxruntime.InferenceSession(
            str(model_path), providers=["CPUExecutionProvider"]
        )
        self._input_name = self._session.get_inputs()[0].name
        self._size = int(self._session.get_inputs()[0].shape[2])

    def detect(self, image: np.ndarray) -> list[Box]:
        tensor, ratio = letterbox(image, self._size)
        raw = self._session.run(None, {self._input_name: tensor[None]})[0]
        decoded = decode_predictions(raw, self._size)

        scores = decoded[:, 4] * decoded[:, 5 + PERSON_CLASS]
        candidates = decoded[scores >= SCORE_THRESHOLD]
        kept_scores = scores[scores >= SCORE_THRESHOLD]
        if candidates.shape[0] == 0:
            return []

        height, width = image.shape[:2]
        boxes: list[Box] = []
        for cx, cy, w, h in candidates[:, :4] / ratio:
            x0 = max(0, int(cx - w / 2))
            y0 = max(0, int(cy - h / 2))
            boxes.append((x0, y0, min(int(w), width - x0), min(int(h), height - y0)))

        keep = cv2.dnn.NMSBoxes(
            boxes, kept_scores.astype(np.float32), SCORE_THRESHOLD, NMS_THRESHOLD
        )
        return [boxes[int(i)] for i in np.asarray(keep).flatten()]
