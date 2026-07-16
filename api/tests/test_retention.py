from datetime import UTC, datetime

from owi_api.maintenance import retention_cutoff


def test_cutoff_is_months_back() -> None:
    now = datetime(2026, 7, 16, tzinfo=UTC)
    assert retention_cutoff(now, 1) == datetime(2026, 6, 16, tzinfo=UTC)


def test_cutoff_never_shorter_than_calendar_months() -> None:
    # 30-day months → 24 months is 720 days, ≤ any real 24-calendar-month span.
    now = datetime(2026, 7, 16, tzinfo=UTC)
    assert (now - retention_cutoff(now, 24)).days == 720
