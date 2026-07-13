import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from owi_api.db import get_session
from owi_api.models.enums import PredictionTask, UserRole
from owi_api.models.prediction import MLModel
from owi_api.routers.auth import require_roles
from owi_api.security import TokenClaims

router = APIRouter(prefix="/api/v1/models", tags=["models"])


class ModelIn(BaseModel):
    task: PredictionTask
    version: str = Field(min_length=1, max_length=50)
    git_commit: str | None = None
    dataset_hash: str | None = None
    metrics: dict[str, float] = Field(default_factory=dict)
    activate: bool = True


class ModelOut(BaseModel):
    id: uuid.UUID
    task: PredictionTask
    version: str
    metrics: dict[str, float]
    active: bool
    created_at: datetime


def _to_out(m: MLModel) -> ModelOut:
    return ModelOut(
        id=m.id,
        task=m.task,
        version=m.version,
        metrics={k: float(v) for k, v in m.metrics.items() if isinstance(v, int | float)},
        active=m.active,
        created_at=m.created_at,
    )


@router.post("", response_model=ModelOut, status_code=201)
def register_model(
    body: ModelIn,
    requester: Annotated[TokenClaims, require_roles(UserRole.ADMIN)],
    session: Annotated[Session, Depends(get_session)],
) -> ModelOut:
    model = session.scalar(
        select(MLModel).where(
            MLModel.org_id == requester.org_id,
            MLModel.task == body.task,
            MLModel.version == body.version,
        )
    )
    if model is None:
        model = MLModel(org_id=requester.org_id, task=body.task, version=body.version)
        session.add(model)
    model.git_commit = body.git_commit
    model.dataset_hash = body.dataset_hash
    model.metrics = dict(body.metrics)
    if body.activate:
        # Exactly one active model per task: the batch worker runs whatever is active.
        session.execute(
            update(MLModel)
            .where(MLModel.org_id == requester.org_id, MLModel.task == body.task)
            .values(active=False)
        )
        model.active = True
    session.commit()
    return _to_out(model)


@router.get("", response_model=list[ModelOut])
def list_models(
    requester: Annotated[TokenClaims, require_roles(UserRole.ADMIN, UserRole.COORDINATOR)],
    session: Annotated[Session, Depends(get_session)],
) -> list[ModelOut]:
    models = session.scalars(
        select(MLModel)
        .where(MLModel.org_id == requester.org_id, MLModel.deleted_at.is_(None))
        .order_by(MLModel.task, MLModel.created_at.desc())
    )
    return [_to_out(m) for m in models]
