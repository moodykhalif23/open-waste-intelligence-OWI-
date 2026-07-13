from datetime import date

from owi_api.analytics.volunteer import EventFacts, summarize


def event(day: str, people: int, hours: float, materials: dict[str, float]) -> EventFacts:
    return EventFacts(date.fromisoformat(day), people, hours, materials)


def test_empty_summary_is_zeroed() -> None:
    s = summarize([])
    assert s.events == 0 and s.participants == 0 and s.hours == 0 and s.kg_total == 0
    assert s.kg_by_material == {} and s.monthly == []


def test_totals_sum_across_events() -> None:
    s = summarize(
        [
            event("2026-06-05", 10, 30.0, {"plastic": 12.0, "glass": 4.0}),
            event("2026-06-20", 8, 24.0, {"plastic": 8.0}),
        ]
    )
    assert s.events == 2
    assert s.participants == 18
    assert s.hours == 54.0
    assert s.kg_by_material == {"plastic": 20.0, "glass": 4.0}
    assert s.kg_total == 24.0


def test_monthly_trend_groups_and_sorts() -> None:
    s = summarize(
        [
            event("2026-07-01", 5, 10.0, {"plastic": 3.0}),
            event("2026-05-01", 5, 5.0, {"plastic": 1.0}),
            event("2026-05-15", 5, 7.0, {"glass": 2.0}),
        ]
    )
    assert [m.month for m in s.monthly] == ["2026-05", "2026-07"]
    may = s.monthly[0]
    assert may.events == 2 and may.hours == 12.0 and may.kg == 3.0


def test_kg_rounding_is_stable() -> None:
    s = summarize([event("2026-06-01", 1, 1.0, {"plastic": 0.1}) for _ in range(3)])
    assert s.kg_by_material["plastic"] == 0.3
