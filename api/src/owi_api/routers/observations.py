import json
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Form, HTTPException, Query, Response, UploadFile
from pydantic import TypeAdapter, ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from owi_api.config import settings
from owi_api.db import get_session
from owi_api.ingestion.privacy import HogPersonDetector, PersonDetector
from owi_api.ingestion.service import ingest_observation
from owi_api.ingestion.storage import ObjectStore, get_store
from owi_api.models.enums import UserRole
from owi_api.models.observation import Observation
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


def get_detector() -> PersonDetector:
    return HogPersonDetector()


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


@router.get("", response_model=list[ObservationOut])
def list_observations(
    claims: Annotated[TokenClaims, require_roles(*STAFF)],
    session: Annotated[Session, Depends(get_session)],
    limit: Annotated[int, Query(gt=0, le=1000)] = 500,
) -> list[ObservationOut]:
    rows = session.execute(
        select(Observation, func.ST_Y(Observation.location), func.ST_X(Observation.location))
        .where(Observation.org_id == claims.org_id, Observation.deleted_at.is_(None))
        .order_by(Observation.captured_at.desc())
        .limit(limit)
    )
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
    return Response(content=store.get(observation.image_ref), media_type="image/jpeg")
