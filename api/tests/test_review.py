import pytest

from owi_api.analytics.review import apply_review, check_correction
from owi_api.models.enums import PredictionTask, ReviewStatus


def test_confirm_keeps_payload_as_truth() -> None:
    outcome = apply_review(ReviewStatus.UNREVIEWED, "confirm", None)
    assert outcome.status is ReviewStatus.CONFIRMED
    assert outcome.corrected_payload is None


def test_correct_stores_correction() -> None:
    outcome = apply_review(ReviewStatus.UNREVIEWED, "correct", {"fill_band": "high"})
    assert outcome.status is ReviewStatus.CORRECTED
    assert outcome.corrected_payload == {"fill_band": "high"}


def test_correct_without_payload_rejected() -> None:
    with pytest.raises(ValueError, match="corrected payload"):
        apply_review(ReviewStatus.UNREVIEWED, "correct", None)


def test_double_review_rejected() -> None:
    with pytest.raises(ValueError, match="already reviewed"):
        apply_review(ReviewStatus.CONFIRMED, "confirm", None)


def test_unknown_action_rejected() -> None:
    with pytest.raises(ValueError, match="unknown review action"):
        apply_review(ReviewStatus.UNREVIEWED, "delete", None)


CLASSIFY_PAYLOAD: dict[str, object] = {
    "material": "plastic",
    "confidence": 0.41,
    "scores": {"plastic": 0.41, "paper": 0.33, "glass": 0.26},
}


def test_material_correction_must_be_a_model_class() -> None:
    check_correction(PredictionTask.CLASSIFY, CLASSIFY_PAYLOAD, {"material": "paper"})
    with pytest.raises(ValueError, match="materials"):
        check_correction(PredictionTask.CLASSIFY, CLASSIFY_PAYLOAD, {"material": "metal"})
    with pytest.raises(ValueError, match="materials"):
        check_correction(PredictionTask.CLASSIFY, CLASSIFY_PAYLOAD, {"fill_band": "high"})


def test_fill_correction_must_be_a_band() -> None:
    check_correction(PredictionTask.FILL, {"fill_band": "low"}, {"fill_band": "overflowing"})
    with pytest.raises(ValueError, match="fill band"):
        check_correction(PredictionTask.FILL, {"fill_band": "low"}, {"fill_band": "brimming"})
