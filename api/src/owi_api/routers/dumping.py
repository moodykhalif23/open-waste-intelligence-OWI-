import uuid
from collections import Counter
from datetime import UTC, date, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException
from geoalchemy2 import Geography
from pydantic import BaseModel
from sqlalchemy import cast, func, select
from sqlalchemy.orm import Session

from owi_api.analytics.dumping import hotspot_score, is_recurring
from owi_api.db import get_session
from owi_api.models.dumping import (
    DumpingCandidate,
    DumpingEvent,
    DumpingIntervention,
    DumpingSite,
)
from owi_api.models.enums import DumpingReview, DumpingStatus, InterventionKind, UserRole
from owi_api.models.observation import Observation
from owi_api.routers.auth import require_roles
from owi_api.security import TokenClaims

router = APIRouter(prefix="/api/v1/dumping", tags=["dumping"])

STAFF = (UserRole.ADMIN, UserRole.COORDINATOR, UserRole.VIEWER)
REVIEWERS = (UserRole.ADMIN, UserRole.COORDINATOR)
# Confirmed events within this radius fold into the same recurring site.
SITE_RADIUS_M = 100


class CandidateOut(BaseModel):
    observation_id: uuid.UUID
    captured_at: datetime
    lat: float
    lng: float


class ReviewIn(BaseModel):
    review: Literal["confirmed", "rejected", "duplicate"]


class SiteOut(BaseModel):
    id: uuid.UUID
    lat: float
    lng: float
    area: str | None
    first_seen: datetime
    last_seen: datetime
    event_count: int
    status: DumpingStatus
    hotspot_score: float


@router.get("/candidates", response_model=list[CandidateOut])
def list_candidates(
    claims: Annotated[TokenClaims, require_roles(*REVIEWERS)],
    session: Annotated[Session, Depends(get_session)],
    limit: int = 100,
) -> list[CandidateOut]:
    # Candidates = non-bin (street/area) observations no one has reviewed for dumping yet.
    reviewed = select(DumpingCandidate.observation_id).where(
        DumpingCandidate.org_id == claims.org_id
    )
    rows = session.execute(
        select(Observation, func.ST_Y(Observation.location), func.ST_X(Observation.location))
        .where(
            Observation.org_id == claims.org_id,
            Observation.deleted_at.is_(None),
            Observation.bin_id.is_(None),
            Observation.id.not_in(reviewed),
        )
        .order_by(Observation.captured_at.desc())
        .limit(limit)
    )
    return [
        CandidateOut(observation_id=obs.id, captured_at=obs.captured_at, lat=lat, lng=lng)
        for obs, lat, lng in rows
    ]


def _nearby_site(session: Session, org_id: uuid.UUID, point: str) -> DumpingSite | None:
    return session.scalars(
        select(DumpingSite)
        .where(
            DumpingSite.org_id == org_id,
            DumpingSite.deleted_at.is_(None),
            func.ST_DWithin(
                cast(DumpingSite.location, Geography), cast(point, Geography), SITE_RADIUS_M
            ),
        )
        .limit(1)
    ).first()


def _refresh_status(session: Session, site: DumpingSite) -> None:
    cleanups = list(
        session.scalars(
            select(DumpingIntervention.performed_on).where(
                DumpingIntervention.dumping_site_id == site.id,
                DumpingIntervention.kind == InterventionKind.CLEANUP,
            )
        )
    )
    events = list(
        session.scalars(
            select(DumpingEvent.occurred_at).where(DumpingEvent.dumping_site_id == site.id)
        )
    )
    site.status = (
        DumpingStatus.RECURRING
        if is_recurring(cleanups, [e.date() for e in events])
        else DumpingStatus.ACTIVE
    )


@router.post("/candidates/{observation_id}/review", response_model=SiteOut | None)
def review_candidate(
    observation_id: uuid.UUID,
    body: ReviewIn,
    claims: Annotated[TokenClaims, require_roles(*REVIEWERS)],
    session: Annotated[Session, Depends(get_session)],
) -> SiteOut | None:
    obs = session.get(Observation, observation_id)
    if obs is None or obs.org_id != claims.org_id or obs.bin_id is not None:
        raise HTTPException(status_code=404, detail="dumping candidate not found")
    if session.scalar(
        select(DumpingCandidate).where(DumpingCandidate.observation_id == observation_id)
    ):
        raise HTTPException(status_code=409, detail="already reviewed")

    review = DumpingReview(body.review)
    candidate = DumpingCandidate(
        org_id=claims.org_id,
        observation_id=observation_id,
        review=review,
        reviewed_by=claims.user_id,
    )
    if review is not DumpingReview.CONFIRMED:
        session.add(candidate)
        session.commit()
        return None

    lat, lng = session.execute(
        select(func.ST_Y(Observation.location), func.ST_X(Observation.location)).where(
            Observation.id == observation_id
        )
    ).one()
    point = f"SRID=4326;POINT({lng} {lat})"
    site = _nearby_site(session, claims.org_id, point)
    if site is None:
        site = DumpingSite(
            org_id=claims.org_id,
            location=point,
            first_seen=obs.captured_at,
            last_seen=obs.captured_at,
            event_count=0,
            status=DumpingStatus.ACTIVE,
        )
        session.add(site)
        session.flush()
    site.last_seen = max(site.last_seen, obs.captured_at)
    site.event_count += 1
    session.add(
        DumpingEvent(
            org_id=claims.org_id,
            dumping_site_id=site.id,
            observation_id=observation_id,
            occurred_at=obs.captured_at,
        )
    )
    session.flush()
    _refresh_status(session, site)
    candidate.dumping_site_id = site.id
    session.add(candidate)
    session.commit()

    days_since = (datetime.now(UTC) - site.last_seen).total_seconds() / 86400
    return SiteOut(
        id=site.id,
        lat=lat,
        lng=lng,
        area=site.area,
        first_seen=site.first_seen,
        last_seen=site.last_seen,
        event_count=site.event_count,
        status=site.status,
        hotspot_score=hotspot_score(site.event_count, days_since),
    )


@router.get("/sites", response_model=list[SiteOut])
def list_sites(
    claims: Annotated[TokenClaims, require_roles(*STAFF)],
    session: Annotated[Session, Depends(get_session)],
) -> list[SiteOut]:
    now = datetime.now(UTC)
    rows = session.execute(
        select(DumpingSite, func.ST_Y(DumpingSite.location), func.ST_X(DumpingSite.location)).where(
            DumpingSite.org_id == claims.org_id, DumpingSite.deleted_at.is_(None)
        )
    ).all()
    sites = [
        SiteOut(
            id=s.id,
            lat=lat,
            lng=lng,
            area=s.area,
            first_seen=s.first_seen,
            last_seen=s.last_seen,
            event_count=s.event_count,
            status=s.status,
            hotspot_score=hotspot_score(s.event_count, (now - s.last_seen).total_seconds() / 86400),
        )
        for s, lat, lng in rows
    ]
    sites.sort(key=lambda s: s.hotspot_score, reverse=True)
    return sites


class EventOut(BaseModel):
    occurred_at: datetime
    observation_id: uuid.UUID


class InterventionIn(BaseModel):
    kind: InterventionKind
    performed_on: date
    notes: str | None = None


class InterventionOut(InterventionIn):
    id: uuid.UUID


class SiteDetailOut(SiteOut):
    events: list[EventOut]
    interventions: list[InterventionOut]


@router.get("/sites/{site_id}", response_model=SiteDetailOut)
def site_detail(
    site_id: uuid.UUID,
    claims: Annotated[TokenClaims, require_roles(*STAFF)],
    session: Annotated[Session, Depends(get_session)],
) -> SiteDetailOut:
    row = session.execute(
        select(DumpingSite, func.ST_Y(DumpingSite.location), func.ST_X(DumpingSite.location)).where(
            DumpingSite.id == site_id, DumpingSite.org_id == claims.org_id
        )
    ).first()
    if row is None:
        raise HTTPException(status_code=404, detail="site not found")
    site, lat, lng = row
    events = session.scalars(
        select(DumpingEvent)
        .where(DumpingEvent.dumping_site_id == site_id)
        .order_by(DumpingEvent.occurred_at.desc())
    ).all()
    interventions = session.scalars(
        select(DumpingIntervention)
        .where(DumpingIntervention.dumping_site_id == site_id)
        .order_by(DumpingIntervention.performed_on.desc())
    ).all()
    now = datetime.now(UTC)
    return SiteDetailOut(
        id=site.id,
        lat=lat,
        lng=lng,
        area=site.area,
        first_seen=site.first_seen,
        last_seen=site.last_seen,
        event_count=site.event_count,
        status=site.status,
        hotspot_score=hotspot_score(
            site.event_count, (now - site.last_seen).total_seconds() / 86400
        ),
        events=[
            EventOut(occurred_at=e.occurred_at, observation_id=e.observation_id) for e in events
        ],
        interventions=[
            InterventionOut(id=i.id, kind=i.kind, performed_on=i.performed_on, notes=i.notes)
            for i in interventions
        ],
    )


@router.post("/sites/{site_id}/interventions", response_model=InterventionOut, status_code=201)
def add_intervention(
    site_id: uuid.UUID,
    body: InterventionIn,
    claims: Annotated[TokenClaims, require_roles(*REVIEWERS)],
    session: Annotated[Session, Depends(get_session)],
) -> InterventionOut:
    site = session.get(DumpingSite, site_id)
    if site is None or site.org_id != claims.org_id:
        raise HTTPException(status_code=404, detail="site not found")
    intervention = DumpingIntervention(
        org_id=claims.org_id, dumping_site_id=site_id, **body.model_dump()
    )
    session.add(intervention)
    # A cleanup resets the site to 'cleaned'; a later confirmed event flips it to 'recurring'.
    if body.kind is InterventionKind.CLEANUP:
        site.status = DumpingStatus.CLEANED
    session.commit()
    return InterventionOut(
        id=intervention.id, kind=body.kind, performed_on=body.performed_on, notes=body.notes
    )


class AnalyticsOut(BaseModel):
    total_events: int
    active_sites: int
    recurring_sites: int
    by_weekday: dict[str, int]
    by_area: dict[str, int]


@router.get("/analytics", response_model=AnalyticsOut)
def dumping_analytics(
    claims: Annotated[TokenClaims, require_roles(*STAFF)],
    session: Annotated[Session, Depends(get_session)],
) -> AnalyticsOut:
    weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    events = session.scalars(
        select(DumpingEvent.occurred_at).where(DumpingEvent.org_id == claims.org_id)
    ).all()
    by_weekday = Counter(weekdays[e.weekday()] for e in events)
    sites = session.scalars(
        select(DumpingSite).where(
            DumpingSite.org_id == claims.org_id, DumpingSite.deleted_at.is_(None)
        )
    ).all()
    by_area = Counter(s.area or "unknown" for s in sites)
    return AnalyticsOut(
        total_events=len(events),
        active_sites=sum(1 for s in sites if s.status is DumpingStatus.ACTIVE),
        recurring_sites=sum(1 for s in sites if s.status is DumpingStatus.RECURRING),
        by_weekday={d: by_weekday.get(d, 0) for d in weekdays},
        by_area=dict(by_area),
    )
