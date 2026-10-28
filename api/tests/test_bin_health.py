from datetime import UTC, datetime, timedelta

import pytest

from owi_api.analytics.bin_health import BAND_PCT, compute_health
from owi_api.analytics.coverage import recommend_ward_assessment
from owi_api.models.enums import FillBand, OverflowRisk

NOW = datetime(2026, 7, 13, 8, 0, tzinfo=UTC)


def days_ago(n: float) -> datetime:
    return NOW - timedelta(days=n)


def test_no_observations_yields_no_score() -> None:
    assert compute_health([], None, NOW) is None


def test_collection_resets_health_until_next_fill_observation() -> None:
    health = compute_health([], days_ago(0.5), NOW)
    assert health is not None
    assert health.fill_pct == 0
    assert health.days_since_collection == pytest.approx(0.5)
    assert health.risk is OverflowRisk.LOW
    assert health.recommendation == "no_action"


def test_band_midpoints_cover_all_bands() -> None:
    assert set(BAND_PCT) == set(FillBand)


def test_high_fill_is_high_risk_collect_today() -> None:
    health = compute_health([(days_ago(0.5), 100.0)], None, NOW)
    assert health is not None
    assert health.risk is OverflowRisk.HIGH
    assert health.recommendation == "collect_today"


def test_fast_filling_bin_flags_high_before_full() -> None:
    # 25 → 75 in two days: 25 pct/day, one day from full at 75%.
    series = [(days_ago(2), 25.0), (days_ago(1), 50.0), (days_ago(0), 75.0)]
    health = compute_health(series, None, NOW)
    assert health is not None
    assert health.velocity_pct_per_day == pytest.approx(25.0)
    assert health.days_to_full == pytest.approx(1.0)
    assert health.risk is OverflowRisk.HIGH


def test_slow_half_full_bin_is_low_risk() -> None:
    series = [(days_ago(10), 45.0), (days_ago(0), 50.0)]
    health = compute_health(series, None, NOW)
    assert health is not None
    assert health.risk is OverflowRisk.LOW
    assert health.recommendation == "no_action"


def test_medium_band_by_fill_level() -> None:
    health = compute_health([(days_ago(1), 75.0)], None, NOW)
    assert health is not None
    assert health.risk is OverflowRisk.MEDIUM
    assert health.recommendation == "schedule_soon"


def test_single_observation_has_no_velocity() -> None:
    health = compute_health([(days_ago(1), 50.0)], None, NOW)
    assert health is not None
    assert health.velocity_pct_per_day is None
    assert health.days_to_full is None


def test_emptying_bin_never_predicts_negative_days() -> None:
    series = [(days_ago(2), 75.0), (days_ago(0), 25.0)]
    health = compute_health(series, None, NOW)
    assert health is not None
    assert health.days_to_full is None  # negative velocity → no forecast


def test_days_since_collection() -> None:
    health = compute_health([(days_ago(1), 50.0)], days_ago(4), NOW)
    assert health is not None
    assert health.days_since_collection == pytest.approx(4.0)


def test_ward_with_sites_without_bins_is_flagged_for_assessment() -> None:
    coverage = recommend_ward_assessment(
        ward="Central",
        site_count=4,
        bin_count=3,
        assessed_bin_count=3,
        high_risk_bin_count=0,
        medium_risk_bin_count=0,
        sites_without_bins=1,
        health_data_date=None,
    )

    assert coverage.priority == "assess"
    assert coverage.reason == "registered_sites_without_bins"


def test_ward_with_repeated_fill_pressure_is_flagged_for_assessment() -> None:
    coverage = recommend_ward_assessment(
        ward="Central",
        site_count=3,
        bin_count=6,
        assessed_bin_count=4,
        high_risk_bin_count=1,
        medium_risk_bin_count=1,
        sites_without_bins=0,
        health_data_date=None,
    )

    assert coverage.priority == "assess"
    assert coverage.reason == "repeated_capacity_pressure"


def test_ward_with_few_assessed_bins_is_not_overstated() -> None:
    coverage = recommend_ward_assessment(
        ward="Central",
        site_count=3,
        bin_count=2,
        assessed_bin_count=2,
        high_risk_bin_count=2,
        medium_risk_bin_count=0,
        sites_without_bins=0,
        health_data_date=None,
    )

    assert coverage.priority == "insufficient_data"
    assert coverage.reason == "too_few_assessed_bins"


def test_ward_without_pressure_is_monitored() -> None:
    coverage = recommend_ward_assessment(
        ward="Central",
        site_count=3,
        bin_count=5,
        assessed_bin_count=4,
        high_risk_bin_count=0,
        medium_risk_bin_count=1,
        sites_without_bins=0,
        health_data_date=None,
    )

    assert coverage.priority == "monitor"
    assert coverage.reason == "no_priority_signal"
