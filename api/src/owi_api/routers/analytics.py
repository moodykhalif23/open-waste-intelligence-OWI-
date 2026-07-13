import uuid
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from owi_api.analytics.composition import composition, effective_material
from owi_api.db import get_session
from owi_api.models.enums import PredictionTask, UserRole
from owi_api.models.observation import Observation
from owi_api.models.prediction import Prediction
from owi_api.models.registry import Bin
from owi_api.routers.auth import require_roles
from owi_api.security import TokenClaims

router = APIRouter(prefix="/api/v1/analytics", tags=["analytics"])

STAFF = (UserRole.ADMIN, UserRole.COORDINATOR, UserRole.VIEWER)


def _materials(
    session: Session,
    org_id: uuid.UUID,
    start: datetime,
    end: datetime,
    site_id: uuid.UUID | None,
) -> list[str]:
    query = (
        select(Prediction, Observation.bin_id)
        .join(Observation, Observation.id == Prediction.observation_id)
        .where(
            Prediction.org_id == org_id,
            Prediction.task == PredictionTask.CLASSIFY,
            Prediction.deleted_at.is_(None),
            Observation.captured_at >= start,
            Observation.captured_at < end,
        )
        .order_by(Prediction.observation_id, Prediction.created_at.desc())
    )
    if site_id is not None:
        bins = select(Bin.id).where(Bin.site_id == site_id)
        query = query.where(Observation.bin_id.in_(bins))

    seen: set[uuid.UUID] = set()
    materials: list[str] = []
    for pred, _ in session.execute(query):
        if pred.observation_id in seen:
            continue  # ordered newest-first, so the first row per observation is the latest
        seen.add(pred.observation_id)
        material = effective_material(pred.payload, pred.corrected_payload, pred.review_status)
        if material is not None:
            materials.append(material)
    return materials


class MaterialShareOut(BaseModel):
    material: str
    count: int
    share_pct: float
    delta_pct: float | None


class CompositionOut(BaseModel):
    window_days: int
    total: int
    sufficient: bool
    materials: list[MaterialShareOut]


@router.get("/composition", response_model=CompositionOut)
def get_composition(
    claims: Annotated[TokenClaims, require_roles(*STAFF)],
    session: Annotated[Session, Depends(get_session)],
    days: Annotated[int, Query(gt=0, le=365)] = 7,
    site_id: uuid.UUID | None = None,
) -> CompositionOut:
    now = datetime.now(UTC)
    window = timedelta(days=days)
    current = _materials(session, claims.org_id, now - window, now, site_id)
    previous = _materials(session, claims.org_id, now - 2 * window, now - window, site_id)
    rows, sufficient = composition(current, previous)
    return CompositionOut(
        window_days=days,
        total=len(current),
        sufficient=sufficient,
        materials=[
            MaterialShareOut(
                material=r.material, count=r.count, share_pct=r.share_pct, delta_pct=r.delta_pct
            )
            for r in rows
        ],
    )
