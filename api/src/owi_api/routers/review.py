import uuid
from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from owi_api.analytics.review import apply_review
from owi_api.db import get_session
from owi_api.models.enums import PredictionTask, ReviewStatus, UserRole
from owi_api.models.prediction import Prediction
from owi_api.routers.auth import require_roles
from owi_api.security import TokenClaims

router = APIRouter(prefix="/api/v1/predictions", tags=["review"])

REVIEWERS = (UserRole.ADMIN, UserRole.COORDINATOR)


class PredictionOut(BaseModel):
    id: uuid.UUID
    observation_id: uuid.UUID
    task: PredictionTask
    payload: dict[str, object]
    review_status: ReviewStatus
    created_at: datetime


class ReviewIn(BaseModel):
    action: Literal["confirm", "correct"]
    corrected_payload: dict[str, object] | None = None


class ReviewQueueOut(BaseModel):
    unreviewed: int
    items: list[PredictionOut]


@router.get("", response_model=ReviewQueueOut)
def review_queue(
    claims: Annotated[TokenClaims, require_roles(*REVIEWERS)],
    session: Annotated[Session, Depends(get_session)],
    status: ReviewStatus = ReviewStatus.UNREVIEWED,
    limit: int = 100,
) -> ReviewQueueOut:
    base = select(Prediction).where(
        Prediction.org_id == claims.org_id, Prediction.deleted_at.is_(None)
    )
    unreviewed = session.scalar(
        select(func.count())
        .select_from(Prediction)
        .where(
            Prediction.org_id == claims.org_id,
            Prediction.deleted_at.is_(None),
            Prediction.review_status == ReviewStatus.UNREVIEWED,
        )
    )
    rows = session.scalars(
        base.where(Prediction.review_status == status).order_by(Prediction.created_at).limit(limit)
    ).all()
    return ReviewQueueOut(
        unreviewed=unreviewed or 0,
        items=[
            PredictionOut(
                id=p.id,
                observation_id=p.observation_id,
                task=p.task,
                payload=p.payload,
                review_status=p.review_status,
                created_at=p.created_at,
            )
            for p in rows
        ],
    )


@router.post("/{prediction_id}/review", response_model=PredictionOut)
def review_prediction(
    prediction_id: uuid.UUID,
    body: ReviewIn,
    claims: Annotated[TokenClaims, require_roles(*REVIEWERS)],
    session: Annotated[Session, Depends(get_session)],
) -> PredictionOut:
    prediction = session.get(Prediction, prediction_id)
    if prediction is None or prediction.org_id != claims.org_id:
        raise HTTPException(status_code=404, detail="prediction not found")

    try:
        outcome = apply_review(prediction.review_status, body.action, body.corrected_payload)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    prediction.review_status = outcome.status
    prediction.corrected_payload = outcome.corrected_payload
    prediction.reviewed_by = claims.user_id
    session.commit()
    return PredictionOut(
        id=prediction.id,
        observation_id=prediction.observation_id,
        task=prediction.task,
        payload=prediction.payload,
        review_status=prediction.review_status,
        created_at=prediction.created_at,
    )
