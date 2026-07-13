"""Pure rules for the Open Data API: aggregates only, small cells suppressed, delayed.

Governance hard line: public outputs are ward-level, lag reality by a delay window, and
suppress any cell backed by fewer than MIN_BINS bins or MIN_OBSERVATIONS observations.
"""

from datetime import date, datetime, timedelta

# k-anonymity-style floor: a public cell must rest on enough bins AND enough observations.
MIN_BINS = 3
MIN_OBSERVATIONS = 20

LICENSE = "CC-BY-4.0"
DATASET_VERSION = "public-v1"


def delay_cutoff(now: datetime, delay_days: int) -> datetime:
    """Newest captured_at a public response may include — everything after is withheld."""
    return now - timedelta(days=delay_days)


def iso_week(day: date) -> str:
    """ISO year-week label, e.g. 2026-W28 — the public time bucket."""
    year, week, _ = day.isocalendar()
    return f"{year}-W{week:02d}"


def is_suppressed(bins: int, observations: int) -> bool:
    """True when a cell is too small to publish without re-identification risk."""
    return bins < MIN_BINS or observations < MIN_OBSERVATIONS
