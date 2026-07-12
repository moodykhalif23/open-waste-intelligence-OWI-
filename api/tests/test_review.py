import pytest

from owi_api.analytics.review import apply_review, ground_truth
from owi_api.models.enums import ReviewStatus


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


def test_ground_truth_selection() -> None:
    pred = {"fill_band": "half"}
    corrected = {"fill_band": "high"}
    assert ground_truth(ReviewStatus.CONFIRMED, pred, None) == pred
    assert ground_truth(ReviewStatus.CORRECTED, pred, corrected) == corrected
    assert ground_truth(ReviewStatus.UNREVIEWED, pred, None) is None
