from datetime import date

# A hotspot is recent AND frequent; recency decays with a two-week half-life.
HALF_LIFE_DAYS = 14.0


def hotspot_score(event_count: int, days_since_last: float) -> float:
    """Rank confirmed sites by frequency weighted by recency — recurring hotspots float up."""
    if event_count <= 0:
        return 0.0
    score: float = event_count * 0.5 ** (max(0.0, days_since_last) / HALF_LIFE_DAYS)
    return round(score, 3)


def is_recurring(cleanup_dates: list[date], event_dates: list[date]) -> bool:
    """A site recurs if a confirmed dumping event appears after its most recent cleanup."""
    if not cleanup_dates:
        return False
    last_cleanup = max(cleanup_dates)
    return any(event > last_cleanup for event in event_dates)
