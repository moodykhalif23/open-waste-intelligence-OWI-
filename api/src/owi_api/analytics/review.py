from dataclasses import dataclass

from owi_api.models.enums import FillBand, PredictionTask, ReviewStatus


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


def check_correction(
    task: PredictionTask, payload: dict[str, object], correction: dict[str, object] | None
) -> None:
    if not correction:
        return
    if task is PredictionTask.CLASSIFY:
        material = correction.get("material")
        scores = payload.get("scores")
        known = set(scores) if isinstance(scores, dict) else None
        if not isinstance(material, str) or not material or (known and material not in known):
            raise ValueError("correction must name one of the model's materials")
    elif task is PredictionTask.FILL:
        band = correction.get("fill_band")
        if not isinstance(band, str) or band not in {b.value for b in FillBand}:
            raise ValueError("correction must name a fill band")
