from datetime import date

from owi_api.analytics.dumping import HALF_LIFE_DAYS, hotspot_score, is_recurring


def test_no_events_scores_zero() -> None:
    assert hotspot_score(0, 0) == 0.0


def test_recent_frequent_outranks_old_frequent() -> None:
    assert hotspot_score(5, 0) > hotspot_score(5, 30)


def test_half_life_halves_score() -> None:
    assert hotspot_score(4, HALF_LIFE_DAYS) == 2.0  # 4 x 0.5^1


def test_recurrence_after_cleanup() -> None:
    cleanups = [date(2026, 6, 1)]
    assert is_recurring(cleanups, [date(2026, 6, 10)]) is True
    assert is_recurring(cleanups, [date(2026, 5, 20)]) is False
    assert is_recurring([], [date(2026, 6, 10)]) is False
