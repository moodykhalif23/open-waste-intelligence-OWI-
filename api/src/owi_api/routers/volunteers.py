import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from owi_api.analytics.carbon import carbon_report, load_factors
from owi_api.analytics.volunteer import EventFacts, MonthPoint, VolunteerSummary, summarize
from owi_api.db import get_session
from owi_api.models.enums import EventType, UserRole
from owi_api.models.registry import Organization
from owi_api.models.volunteer import VolunteerEvent
from owi_api.reports.grant import render_grant_report
from owi_api.routers.auth import get_current_user, require_roles
from owi_api.routers.carbon import kg_by_material
from owi_api.security import TokenClaims

router = APIRouter(prefix="/api/v1/volunteers", tags=["volunteers"])

EDITORS = (UserRole.ADMIN, UserRole.COORDINATOR)


class EventIn(BaseModel):
    occurred_on: date
    event_type: EventType
    area: str = Field(min_length=1, max_length=200)
    organizer: str = Field(min_length=1, max_length=200)
    participant_count: int = Field(ge=0)
    hours_total: float = Field(ge=0)
    materials_kg: dict[str, float] = Field(default_factory=dict)
    notes: str | None = Field(default=None, max_length=1000)


class EventOut(EventIn):
    id: uuid.UUID


class SummaryOut(BaseModel):
    events: int
    participants: int
    hours: float
    kg_total: float
    kg_by_material: dict[str, float]
    monthly: list[MonthPoint]


def _facts(rows: list[VolunteerEvent]) -> list[EventFacts]:
    return [
        EventFacts(r.occurred_on, r.participant_count, r.hours_total, r.materials_kg) for r in rows
    ]


def _load(session: Session, org_id: uuid.UUID, start: date, end: date) -> list[VolunteerEvent]:
    return list(
        session.scalars(
            select(VolunteerEvent).where(
                VolunteerEvent.org_id == org_id,
                VolunteerEvent.deleted_at.is_(None),
                VolunteerEvent.occurred_on >= start,
                VolunteerEvent.occurred_on <= end,
            )
        )
    )


@router.post("", response_model=EventOut, status_code=201)
def create_event(
    body: EventIn,
    requester: Annotated[TokenClaims, require_roles(*EDITORS)],
    session: Annotated[Session, Depends(get_session)],
) -> EventOut:
    event = VolunteerEvent(org_id=requester.org_id, **body.model_dump())
    session.add(event)
    session.commit()
    return EventOut(id=event.id, **body.model_dump())


@router.get("", response_model=list[EventOut])
def list_events(
    requester: Annotated[TokenClaims, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_session)],
) -> list[EventOut]:
    rows = session.scalars(
        select(VolunteerEvent)
        .where(VolunteerEvent.org_id == requester.org_id, VolunteerEvent.deleted_at.is_(None))
        .order_by(VolunteerEvent.occurred_on.desc())
    )
    return [
        EventOut(
            id=r.id,
            occurred_on=r.occurred_on,
            event_type=r.event_type,
            area=r.area,
            organizer=r.organizer,
            participant_count=r.participant_count,
            hours_total=r.hours_total,
            materials_kg=r.materials_kg,
            notes=r.notes,
        )
        for r in rows
    ]


@router.get("/summary", response_model=SummaryOut)
def summary(
    requester: Annotated[TokenClaims, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_session)],
    start: date = date(2000, 1, 1),
    end: date = date(2100, 1, 1),
) -> SummaryOut:
    s: VolunteerSummary = summarize(_facts(_load(session, requester.org_id, start, end)))
    return SummaryOut(**s.__dict__)


@router.get("/report")
def grant_report(
    requester: Annotated[TokenClaims, require_roles(*EDITORS)],
    session: Annotated[Session, Depends(get_session)],
    start: Annotated[date, Query()],
    end: Annotated[date, Query()],
) -> Response:
    org = session.get(Organization, requester.org_id)
    if org is None:
        raise HTTPException(status_code=404, detail="organization not found")
    s = summarize(_facts(_load(session, requester.org_id, start, end)))

    days = max(1, (end - start).days)
    report = carbon_report(kg_by_material(session, requester.org_id, days), load_factors())
    carbon_line = (
        f"~{report.co2e_low_kg:g}-{report.co2e_high_kg:g} kg CO2e avoided "
        f"(~{report.trees_equivalent:g} tree-years), {report.landfill_m3_saved:g} m3 landfill saved"
        if report.co2e_avoided_kg > 0
        else None
    )
    html = render_grant_report(org.name, start, end, s, carbon_line)
    return Response(content=html, media_type="text/html")
