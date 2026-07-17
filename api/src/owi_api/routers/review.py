import uuid
from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import Float, func, select
from sqlalchemy.orm import Session

from owi_api.analytics.composition import effective_material
from owi_api.analytics.review import apply_review
from owi_api.audit import client_ip, record_audit
from owi_api.db import get_session
from owi_api.models.enums import PredictionTask, ReviewStatus, UserRole
from owi_api.models.observation import Observation
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
    # Uncertainty sampling: surface the model's least-confident predictions first,
    # so reviewer effort lands where a correction teaches the most.
    confidence = Prediction.payload["confidence"].astext.cast(Float)
    rows = session.scalars(
        base.where(Prediction.review_status == status)
        .order_by(confidence.asc().nulls_last(), Prediction.created_at)
        .limit(limit)
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


class TrainingLabelOut(BaseModel):
    observation_id: uuid.UUID
    label: str
    source: str  # confirmed | corrected | fill_tap


@router.get("/export", response_model=list[TrainingLabelOut])
def export_training_labels(
    request: Request,
    claims: Annotated[TokenClaims, require_roles(UserRole.ADMIN)],
    session: Annotated[Session, Depends(get_session)],
    task: PredictionTask = PredictionTask.CLASSIFY,
) -> list[TrainingLabelOut]:
    """Reviewed ground truth for retraining — the output side of the active-learning
    loop. One label per observation; the newest reviewed prediction wins."""
    rows: list[TrainingLabelOut] = []
    seen: set[uuid.UUID] = set()

    if task is PredictionTask.FILL:
        # A collector's tap at the bin is direct ground truth, ahead of any review.
        for obs_id, tap in session.execute(
            select(Observation.id, Observation.human_fill_tap).where(
                Observation.org_id == claims.org_id,
                Observation.deleted_at.is_(None),
                Observation.image_deleted_at.is_(None),
                Observation.human_fill_tap.is_not(None),
            )
        ):
            seen.add(obs_id)
            rows.append(TrainingLabelOut(observation_id=obs_id, label=tap.value, source="fill_tap"))

    reviewed = session.execute(
        select(Prediction)
        .join(Observation, Observation.id == Prediction.observation_id)
        .where(
            Prediction.org_id == claims.org_id,
            Prediction.task == task,
            Prediction.deleted_at.is_(None),
            Prediction.review_status != ReviewStatus.UNREVIEWED,
            Observation.deleted_at.is_(None),
            Observation.image_deleted_at.is_(None),
        )
        .order_by(Prediction.observation_id, Prediction.created_at.desc())
    ).scalars()
    key = "material" if task is PredictionTask.CLASSIFY else "fill_band"
    for pred in reviewed:
        if pred.observation_id in seen:
            continue
        seen.add(pred.observation_id)
        if task is PredictionTask.CLASSIFY:
            label = effective_material(pred.payload, pred.corrected_payload, pred.review_status)
        else:
            payload = (
                pred.corrected_payload
                if pred.review_status is ReviewStatus.CORRECTED and pred.corrected_payload
                else pred.payload
            )
            raw = payload.get(key)
            label = raw if isinstance(raw, str) else None
        if label:
            rows.append(
                TrainingLabelOut(
                    observation_id=pred.observation_id,
                    label=label,
                    source=pred.review_status.value,
                )
            )

    record_audit(
        session,
        org_id=claims.org_id,
        actor_user_id=claims.user_id,
        action="training_labels.export",
        entity="prediction",
        ip=client_ip(request),
        detail={"task": task.value, "labels": len(rows)},
    )
    session.commit()
    return rows


@router.post("/{prediction_id}/review", response_model=PredictionOut)
def review_prediction(
    prediction_id: uuid.UUID,
    body: ReviewIn,
    request: Request,
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
    record_audit(
        session,
        org_id=claims.org_id,
        actor_user_id=claims.user_id,
        action="prediction.review",
        entity="prediction",
        entity_id=prediction.id,
        ip=client_ip(request),
        detail={"action": body.action},
    )
    session.commit()
    return PredictionOut(
        id=prediction.id,
        observation_id=prediction.observation_id,
        task=prediction.task,
        payload=prediction.payload,
        review_status=prediction.review_status,
        created_at=prediction.created_at,
    )
