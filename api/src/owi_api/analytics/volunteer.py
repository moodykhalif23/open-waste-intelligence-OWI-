from dataclasses import dataclass, field
from datetime import date


@dataclass(frozen=True)
class EventFacts:
    occurred_on: date
    participant_count: int
    hours_total: float
    materials_kg: dict[str, float]


@dataclass(frozen=True)
class MonthPoint:
    month: str  # YYYY-MM
    events: int
    hours: float
    kg: float


@dataclass(frozen=True)
class VolunteerSummary:
    events: int
    participants: int
    hours: float
    kg_total: float
    kg_by_material: dict[str, float]
    monthly: list[MonthPoint] = field(default_factory=list)


def summarize(events: list[EventFacts]) -> VolunteerSummary:
    """Roll events into grant-report totals — every figure traces to stored event rows."""
    kg_by_material: dict[str, float] = {}
    months: dict[str, dict[str, float]] = {}

    for event in events:
        month = event.occurred_on.strftime("%Y-%m")
        bucket = months.setdefault(month, {"events": 0.0, "hours": 0.0, "kg": 0.0})
        bucket["events"] += 1
        bucket["hours"] += event.hours_total
        for material, kg in event.materials_kg.items():
            kg_by_material[material] = round(kg_by_material.get(material, 0.0) + kg, 3)
            bucket["kg"] += kg

    monthly = [
        MonthPoint(m, int(b["events"]), round(b["hours"], 2), round(b["kg"], 3))
        for m, b in sorted(months.items())
    ]
    return VolunteerSummary(
        events=len(events),
        participants=sum(e.participant_count for e in events),
        hours=round(sum(e.hours_total for e in events), 2),
        kg_total=round(sum(kg_by_material.values()), 3),
        kg_by_material=kg_by_material,
        monthly=monthly,
    )
