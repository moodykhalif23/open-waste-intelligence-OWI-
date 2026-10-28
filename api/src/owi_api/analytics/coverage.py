from dataclasses import dataclass
from datetime import date
from typing import Literal

MIN_ASSESSED_BINS = 3
PRESSURE_SHARE_THRESHOLD = 0.5

CoveragePriority = Literal["assess", "monitor", "insufficient_data"]
CoverageReason = Literal[
    "registered_sites_without_bins",
    "repeated_capacity_pressure",
    "too_few_assessed_bins",
    "no_priority_signal",
]


@dataclass(frozen=True)
class WardCoverage:
    ward: str
    site_count: int
    bin_count: int
    assessed_bin_count: int
    high_risk_bin_count: int
    medium_risk_bin_count: int
    sites_without_bins: int
    priority: CoveragePriority
    reason: CoverageReason
    health_data_date: date | None


def recommend_ward_assessment(
    *,
    ward: str,
    site_count: int,
    bin_count: int,
    assessed_bin_count: int,
    high_risk_bin_count: int,
    medium_risk_bin_count: int,
    sites_without_bins: int,
    health_data_date: date | None = None,
) -> WardCoverage:
    """Flag wards for a human coverage assessment, not an automated placement decision."""
    pressure_count = high_risk_bin_count + medium_risk_bin_count
    priority: CoveragePriority
    reason: CoverageReason
    if sites_without_bins:
        priority, reason = "assess", "registered_sites_without_bins"
    elif assessed_bin_count < MIN_ASSESSED_BINS:
        priority, reason = "insufficient_data", "too_few_assessed_bins"
    elif pressure_count / assessed_bin_count >= PRESSURE_SHARE_THRESHOLD:
        priority, reason = "assess", "repeated_capacity_pressure"
    else:
        priority, reason = "monitor", "no_priority_signal"

    return WardCoverage(
        ward=ward,
        site_count=site_count,
        bin_count=bin_count,
        assessed_bin_count=assessed_bin_count,
        high_risk_bin_count=high_risk_bin_count,
        medium_risk_bin_count=medium_risk_bin_count,
        sites_without_bins=sites_without_bins,
        priority=priority,
        reason=reason,
        health_data_date=health_data_date,
    )
