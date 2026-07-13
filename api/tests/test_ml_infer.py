import cv2
import numpy as np
import pytest

from owi_api.ml_infer import preprocess, softmax, top_prediction


def encode(image: np.ndarray) -> bytes:
    ok, buf = cv2.imencode(".jpg", image)
    assert ok
    return buf.tobytes()


def test_preprocess_shape_and_range() -> None:
    rng = np.random.default_rng(0)
    tensor = preprocess(encode(rng.integers(0, 255, (300, 400, 3), dtype=np.uint8)))
    assert tensor.shape == (1, 3, 224, 224)
    assert tensor.dtype == np.float32


def test_preprocess_rejects_garbage() -> None:
    with pytest.raises(ValueError, match="decodable"):
        preprocess(b"not an image")


def test_softmax_sums_to_one() -> None:
    probs = softmax(np.array([2.0, 1.0, 0.1]))
    assert probs.sum() == pytest.approx(1.0)
    assert probs[0] > probs[1] > probs[2]


def test_top_prediction_picks_argmax_with_labels() -> None:
    labels = ["plastic", "glass", "metal"]
    label, conf, scores = top_prediction(np.array([[0.1, 3.0, 0.2]]), labels)
    assert label == "glass"
    assert 0 < conf <= 1
    assert set(scores) == set(labels)
    assert scores["glass"] == max(scores.values())
