import json
import uuid
from datetime import UTC, datetime
from functools import lru_cache
from typing import Annotated

from fastapi import APIRouter, Depends, Form, HTTPException, Query, Request, Response, UploadFile
from pydantic import TypeAdapter, ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from owi_api.analytics.composition import effective_material
from owi_api.audit import client_ip, record_audit
from owi_api.config import settings
from owi_api.db import get_session
from owi_api.ingestion.person_onnx import OnnxPersonDetector
from owi_api.ingestion.privacy import PersonDetector
from owi_api.ingestion.service import ingest_observation, quarantine_key
from owi_api.ingestion.storage import ObjectStore, get_store
from owi_api.models.enums import PredictionTask, UserRole
from owi_api.models.observation import Observation
from owi_api.models.prediction import Prediction
from owi_api.routers.auth import require_roles
from owi_api.schemas.observation import (
    BatchResponse,
    ObservationIn,
    ObservationOut,
    ObservationResult,
)
from owi_api.security import TokenClaims

# Internal staff — the public api_consumer role never reaches raw observations.
STAFF = (UserRole.ADMIN, UserRole.COORDINATOR, UserRole.COLLECTOR, UserRole.VIEWER)

router = APIRouter(prefix="/api/v1/observations", tags=["observations"])

_meta_list = TypeAdapter(list[ObservationIn])


def get_object_store() -> ObjectStore:
    return get_store(settings)


# Session loading costs ~100ms and the model is immutable — share one instance.
@lru_cache(maxsize=1)
def _detector() -> OnnxPersonDetector:
    return OnnxPersonDetector(settings.person_model_path)


def get_detector() -> PersonDetector:
    return _detector()


@router.post("/batch", response_model=BatchResponse)
async def ingest_batch(
    files: list[UploadFile],
    meta: Annotated[str, Form()],
    claims: Annotated[
        TokenClaims,
        require_roles(UserRole.COLLECTOR, UserRole.COORDINATOR, UserRole.ADMIN),
    ],
    session: Annotated[Session, Depends(get_session)],
    store: Annotated[ObjectStore, Depends(get_object_store)],
    detector: Annotated[PersonDetector, Depends(get_detector)],
) -> BatchResponse:
    try:
        metas = _meta_list.validate_python(json.loads(meta))
    except (json.JSONDecodeError, ValidationError) as exc:
        raise HTTPException(status_code=422, detail=f"invalid meta: {exc}") from exc
    if len(metas) != len(files):
        raise HTTPException(status_code=422, detail="meta/files count mismatch")

    results: list[ObservationResult] = []
    for item, file in zip(metas, files, strict=True):
        if item.collector_id is None and claims.role is UserRole.COLLECTOR:
            item.collector_id = claims.user_id
        image_bytes = await file.read()
        if len(image_bytes) > settings.max_upload_bytes:
            results.append(
                ObservationResult(
                    observation_id=uuid.UUID(int=0), status="rejected", detail="image too large"
                )
            )
            continue
        try:
            ingested = ingest_observation(
                session, store, detector, claims.org_id, item, image_bytes
            )
        except ValueError as exc:
            results.append(
                ObservationResult(
                    observation_id=uuid.UUID(int=0), status="rejected", detail=str(exc)
                )
            )
            continue
        results.append(
            ObservationResult(
                observation_id=ingested.observation_id,
                status="duplicate" if ingested.duplicate else "created",
                privacy_status=ingested.privacy_status,
            )
        )
    return BatchResponse(results=results)


def _observation_ids_for_material(
    session: Session, org_id: uuid.UUID, material: str
) -> list[uuid.UUID]:
    preds = session.scalars(
        select(Prediction)
        .where(
            Prediction.org_id == org_id,
            Prediction.task == PredictionTask.CLASSIFY,
            Prediction.deleted_at.is_(None),
        )
        .order_by(Prediction.observation_id, Prediction.created_at.desc())
    )
    seen: set[uuid.UUID] = set()
    matching: list[uuid.UUID] = []
    for pred in preds:
        if pred.observation_id in seen:
            continue
        seen.add(pred.observation_id)
        if effective_material(pred.payload, pred.corrected_payload, pred.review_status) == material:
            matching.append(pred.observation_id)
    return matching


@router.get("", response_model=list[ObservationOut])
def list_observations(
    claims: Annotated[TokenClaims, require_roles(*STAFF)],
    session: Annotated[Session, Depends(get_session)],
    limit: Annotated[int, Query(gt=0, le=1000)] = 500,
    material: str | None = None,
) -> list[ObservationOut]:
    query = (
        select(Observation, func.ST_Y(Observation.location), func.ST_X(Observation.location))
        .where(Observation.org_id == claims.org_id, Observation.deleted_at.is_(None))
        .order_by(Observation.captured_at.desc())
        .limit(limit)
    )
    if material is not None:
        # Composition drill-down: observations whose latest classify prediction reads `material`.
        query = query.where(
            Observation.id.in_(_observation_ids_for_material(session, claims.org_id, material))
        )
    rows = session.execute(query)
    return [
        ObservationOut(
            id=obs.id,
            captured_at=obs.captured_at,
            synced_at=obs.synced_at,
            lat=lat,
            lng=lng,
            location_source=obs.location_source.value,
            bin_id=obs.bin_id,
            collector_id=obs.collector_id,
            fill_tap=obs.human_fill_tap,
            privacy_status=obs.privacy_status,
        )
        for obs, lat, lng in rows
    ]


@router.get("/{observation_id}/image")
def get_observation_image(
    observation_id: uuid.UUID,
    claims: Annotated[TokenClaims, require_roles(*STAFF)],
    session: Annotated[Session, Depends(get_session)],
    store: Annotated[ObjectStore, Depends(get_object_store)],
) -> Response:
    observation = session.get(Observation, observation_id)
    if observation is None or observation.org_id != claims.org_id:
        raise HTTPException(status_code=404, detail="observation not found")
    if observation.image_deleted_at is not None:
        raise HTTPException(status_code=410, detail="image purged by retention policy")
    return Response(content=store.get(observation.image_ref), media_type="image/jpeg")


@router.delete("/{observation_id}", status_code=204)
def erase_observation(
    observation_id: uuid.UUID,
    request: Request,
    claims: Annotated[
        TokenClaims,
        require_roles(UserRole.COLLECTOR, UserRole.COORDINATOR, UserRole.ADMIN),
    ],
    session: Annotated[Session, Depends(get_session)],
    store: Annotated[ObjectStore, Depends(get_object_store)],
) -> None:
    """Do-not-use: the photo is hard-deleted, no questions; the row is retired."""
    observation = session.get(Observation, observation_id)
    if observation is None or observation.org_id != claims.org_id:
        raise HTTPException(status_code=404, detail="observation not found")
    # Collectors may only erase their own reports; staff can erase any.
    if claims.role is UserRole.COLLECTOR and observation.collector_id != claims.user_id:
        raise HTTPException(status_code=403, detail="not your report")

    now = datetime.now(UTC)
    store.delete(observation.image_ref)
    if observation.quarantine_deleted_at is None:
        store.delete(quarantine_key(observation.org_id, observation.image_sha256))
        observation.quarantine_deleted_at = now
    observation.image_deleted_at = now
    observation.deleted_at = now
    record_audit(
        session,
        org_id=claims.org_id,
        actor_user_id=claims.user_id,
        action="observation.erase",
        entity="observation",
        entity_id=observation.id,
        ip=client_ip(request),
    )
    session.commit()
