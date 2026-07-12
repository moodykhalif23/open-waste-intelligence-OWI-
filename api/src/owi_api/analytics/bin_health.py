from dataclasses import dataclass
from datetime import datetime

from owi_api.models.enums import FillBand, OverflowRisk

# Band midpoints: a band is a range, so its midpoint is the honest point estimate.
BAND_PCT: dict[FillBand, float] = {
    FillBand.EMPTY: 5.0,
    FillBand.LOW: 25.0,
    FillBand.HALF: 50.0,
    FillBand.HIGH: 75.0,
    FillBand.OVERFLOWING: 100.0,
}

MIN_POINTS_FOR_VELOCITY = 2
EPSILON = 0.5  # pct/day below which "days to full" is meaningless


@dataclass(frozen=True)
class BinHealth:
    fill_pct: float
    velocity_pct_per_day: float | None
    days_to_full: float | None
    days_since_collection: float | None
    risk: OverflowRisk
    recommendation: str


def compute_health(
    fill_series: list[tuple[datetime, float]],
    last_collection: datetime | None,
    now: datetime,
) -> BinHealth | None:
    """The v1 bin-health formula — a published number, so keep it reproducible and tested."""
    if not fill_series:
        return None
    series = sorted(fill_series)
    fill_pct = series[-1][1]

    velocity = _velocity(series)
    days_to_full = None
    if velocity is not None and velocity > EPSILON:
        days_to_full = max(0.0, (100.0 - fill_pct) / velocity)

    days_since = None
    if last_collection is not None:
        days_since = max(0.0, (now - last_collection).total_seconds() / 86400)

    if fill_pct >= 85 or (days_to_full is not None and days_to_full <= 1):
        risk = OverflowRisk.HIGH
        recommendation = "collect_today"
    elif fill_pct >= 60 or (days_to_full is not None and days_to_full <= 3):
        risk = OverflowRisk.MEDIUM
        recommendation = "schedule_soon"
    else:
        risk = OverflowRisk.LOW
        recommendation = "no_action"

    return BinHealth(fill_pct, velocity, days_to_full, days_since, risk, recommendation)


def _velocity(series: list[tuple[datetime, float]]) -> float | None:
    if len(series) < MIN_POINTS_FOR_VELOCITY:
        return None
    origin = series[0][0]
    xs = [(t - origin).total_seconds() / 86400 for t, _ in series]
    ys = [pct for _, pct in series]
    n = len(xs)
    mean_x, mean_y = sum(xs) / n, sum(ys) / n
    denominator = sum((x - mean_x) ** 2 for x in xs)
    if denominator == 0:
        return None
    return sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys, strict=True)) / denominator
