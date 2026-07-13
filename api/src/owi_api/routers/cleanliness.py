import uuid
from datetime import UTC, date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from owi_api.analytics.cleanliness import METHOD_VERSION, WEIGHTS, cleanliness_index
from owi_api.analytics.cleanliness_refresh import compute_site_values
from owi_api.db import get_session
from owi_api.models.cleanliness import CleanlinessDaily
from owi_api.models.enums import UserRole
from owi_api.models.registry import Site
from owi_api.routers.auth import require_roles
from owi_api.security import TokenClaims

router = APIRouter(prefix="/api/v1/cleanliness", tags=["cleanliness"])

STAFF = (UserRole.ADMIN, UserRole.COORDINATOR, UserRole.VIEWER)


class ComponentOut(BaseModel):
    name: str
    value: float
    weight: float


class AreaScoreOut(BaseModel):
    site_id: uuid.UUID
    site_name: str
    score: float | None
    sufficient: bool
    method_version: str
    components: list[ComponentOut]


class TrendPoint(BaseModel):
    date: date
    score: float | None


@router.get("", response_model=list[AreaScoreOut])
def cleanliness_scores(
    claims: Annotated[TokenClaims, require_roles(*STAFF)],
    session: Annotated[Session, Depends(get_session)],
) -> list[AreaScoreOut]:
    now = datetime.now(UTC)
    out: list[AreaScoreOut] = []
    for site in session.scalars(
        select(Site).where(Site.org_id == claims.org_id, Site.deleted_at.is_(None))
    ):
        values, obs = compute_site_values(session, site.id, now)
        result = cleanliness_index(values, obs)
        out.append(
            AreaScoreOut(
                site_id=site.id,
                site_name=site.name,
                score=result.score,
                sufficient=result.sufficient,
                method_version=result.method_version,
                components=[
                    ComponentOut(name=c.name, value=c.value, weight=c.weight)
                    for c in result.components
                ],
            )
        )
    # Rank worst-first so attention (and framing as "needs support") lands where it helps.
    out.sort(key=lambda a: (a.score is None, a.score if a.score is not None else 0))
    return out


class MethodologyOut(BaseModel):
    version: str
    weights: dict[str, float]
    note: str


@router.get("/methodology", response_model=MethodologyOut)
def methodology(_: Annotated[TokenClaims, require_roles(*STAFF)]) -> MethodologyOut:
    return MethodologyOut(
        version=METHOD_VERSION,
        weights=WEIGHTS,
        note=(
            "0-100 per area: higher is cleaner. Litter density (0.35) awaits the detection "
            "model; v1 scores the present components and renormalizes their weights. Published "
            "as trends, not shame rankings; never used to evaluate staff."
        ),
    )


@router.get("/trend", response_model=list[TrendPoint])
def trend(
    site_id: uuid.UUID,
    claims: Annotated[TokenClaims, require_roles(*STAFF)],
    session: Annotated[Session, Depends(get_session)],
) -> list[TrendPoint]:
    site = session.get(Site, site_id)
    if site is None or site.org_id != claims.org_id:
        raise HTTPException(status_code=404, detail="area not found")
    rows = session.scalars(
        select(CleanlinessDaily)
        .where(CleanlinessDaily.site_id == site_id)
        .order_by(CleanlinessDaily.date)
    )
    return [TrendPoint(date=r.date, score=r.score) for r in rows]
