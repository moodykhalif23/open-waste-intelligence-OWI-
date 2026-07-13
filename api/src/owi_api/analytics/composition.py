from collections import Counter
from dataclasses import dataclass

from owi_api.models.enums import ReviewStatus

# Below this many classified observations, shares are too noisy to report as composition.
MIN_OBSERVATIONS = 20


def effective_material(
    payload: dict[str, object], corrected: dict[str, object] | None, status: ReviewStatus
) -> str | None:
    """The material to trust: a human correction wins, else the model's prediction."""
    source = corrected if status is ReviewStatus.CORRECTED and corrected else payload
    value = source.get("material")
    return str(value) if value is not None else None


@dataclass(frozen=True)
class MaterialShare:
    material: str
    count: int
    share_pct: float
    delta_pct: float | None  # percentage-point change vs the previous window


def _shares(materials: list[str]) -> dict[str, float]:
    total = len(materials)
    if total == 0:
        return {}
    return {m: 100 * c / total for m, c in Counter(materials).items()}


def composition(
    current: list[str], previous: list[str] | None = None
) -> tuple[list[MaterialShare], bool]:
    """Material shares for a window, with change vs the prior window and a sufficiency flag."""
    prev_shares = _shares(previous or [])
    counts = Counter(current)
    total = len(current)
    rows = []
    for material, count in counts.most_common():
        share = 100 * count / total
        prev = prev_shares.get(material)
        delta = round(share - prev, 1) if prev is not None else None
        rows.append(MaterialShare(material, count, round(share, 1), delta))
    return rows, total >= MIN_OBSERVATIONS
