from datetime import UTC, date, datetime

from owi_api.analytics.public_data import (
    MIN_BINS,
    MIN_OBSERVATIONS,
    delay_cutoff,
    is_suppressed,
    iso_week,
)


def test_delay_cutoff_withholds_recent() -> None:
    now = datetime(2026, 7, 13, 12, 0, tzinfo=UTC)
    cutoff = delay_cutoff(now, 7)
    assert cutoff == datetime(2026, 7, 6, 12, 0, tzinfo=UTC)
    assert cutoff < now


def test_iso_week_label() -> None:
    assert iso_week(date(2026, 1, 1)) == "2026-W01"
    assert iso_week(date(2026, 7, 13)) == "2026-W29"


def test_suppression_needs_both_floors() -> None:
    # Enough of both -> published.
    assert is_suppressed(MIN_BINS, MIN_OBSERVATIONS) is False
    # Too few bins, plenty of observations -> suppressed.
    assert is_suppressed(MIN_BINS - 1, 100) is True
    # Plenty of bins, too few observations -> suppressed.
    assert is_suppressed(10, MIN_OBSERVATIONS - 1) is True
    # Both short -> suppressed.
    assert is_suppressed(0, 0) is True
