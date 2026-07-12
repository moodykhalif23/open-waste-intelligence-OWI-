import math
from pathlib import Path

import numpy as np
import pytest

from owi_api.ingestion.person_onnx import OnnxPersonDetector, decode_predictions, letterbox

MODEL_PATH = Path("var/models/yolox_tiny.onnx")

# 416² input over strides 8/16/32 → 52² + 26² + 13² anchor cells.
N_CELLS = 52 * 52 + 26 * 26 + 13 * 13


def test_letterbox_scales_and_pads() -> None:
    image = np.zeros((300, 600, 3), dtype=np.uint8)
    tensor, ratio = letterbox(image, 416)
    assert tensor.shape == (3, 416, 416)
    assert ratio == pytest.approx(416 / 600)
    assert tensor[0, 415, 415] == 114  # padding fill


def test_decode_maps_grid_cell_to_pixels() -> None:
    raw = np.zeros((1, N_CELLS, 85), dtype=np.float32)
    cell = 10 * 52 + 10  # stride-8 grid, cell (x=10, y=10)
    raw[0, cell, :4] = [0.0, 0.0, math.log(4.0), math.log(4.0)]

    decoded = decode_predictions(raw, 416)
    assert decoded.shape == (N_CELLS, 85)
    assert decoded[cell, :4] == pytest.approx([80.0, 80.0, 32.0, 32.0])


@pytest.mark.skipif(not MODEL_PATH.exists(), reason="model weights not fetched")
def test_detector_runs_on_real_model() -> None:
    detector = OnnxPersonDetector(MODEL_PATH)
    rng = np.random.default_rng(11)
    boxes = detector.detect(rng.integers(0, 255, (480, 640, 3), dtype=np.uint8))
    assert isinstance(boxes, list)


def test_missing_model_fails_loudly() -> None:
    with pytest.raises(FileNotFoundError, match="fetch_models"):
        OnnxPersonDetector(Path("var/models/nope.onnx"))
