import cv2
import numpy as np

# ImageNet normalization — must match the training transform in owi_ml.train.classify.
_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)
SIDE = 224


def preprocess(image_bytes: bytes) -> np.ndarray:
    """Decode → 224² RGB → normalized NCHW float32, ready for the classifier."""
    image = cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("not a decodable image")
    image = cv2.cvtColor(cv2.resize(image, (SIDE, SIDE)), cv2.COLOR_BGR2RGB)
    normalized = (image.astype(np.float32) / 255.0 - _MEAN) / _STD
    # ascontiguousarray gives a typed return (plain numpy arithmetic infers as Any) and the
    return np.ascontiguousarray(normalized.transpose(2, 0, 1)[np.newaxis, :], dtype=np.float32)


def softmax(logits: np.ndarray) -> np.ndarray:
    exp = np.exp(logits - np.max(logits))
    return np.ascontiguousarray(exp / np.sum(exp), dtype=np.float64)


def top_prediction(logits: np.ndarray, labels: list[str]) -> tuple[str, float, dict[str, float]]:
    """Map raw logits to (label, confidence, per-class scores) using the model's label order."""
    probs = softmax(np.asarray(logits, dtype=np.float64).ravel())
    scores = {label: round(float(probs[i]), 4) for i, label in enumerate(labels)}
    best = int(np.argmax(probs))
    return labels[best], round(float(probs[best]), 4), scores
