from dataclasses import dataclass

from owi_api.models.enums import ReviewStatus


@dataclass(frozen=True)
class ReviewOutcome:
    status: ReviewStatus
    corrected_payload: dict[str, object] | None


def apply_review(
    current: ReviewStatus,
    action: str,
    correction: dict[str, object] | None,
) -> ReviewOutcome:
    """Resolve a review action into the stored state; corrections feed the training set."""
    if current is not ReviewStatus.UNREVIEWED:
        raise ValueError(f"prediction already reviewed ({current})")
    if action == "confirm":
        return ReviewOutcome(ReviewStatus.CONFIRMED, None)
    if action == "correct":
        if not correction:
            raise ValueError("correction requires a corrected payload")
        return ReviewOutcome(ReviewStatus.CORRECTED, correction)
    raise ValueError(f"unknown review action: {action}")


def ground_truth(
    status: ReviewStatus,
    payload: dict[str, object],
    corrected_payload: dict[str, object] | None,
) -> dict[str, object] | None:
    """The label to train on: correction if corrected, prediction if confirmed, else none."""
    if status is ReviewStatus.CORRECTED:
        return corrected_payload
    if status is ReviewStatus.CONFIRMED:
        return payload
    return None
