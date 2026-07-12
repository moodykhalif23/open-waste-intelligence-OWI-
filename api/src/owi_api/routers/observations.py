import json
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile
from pydantic import TypeAdapter, ValidationError
from sqlalchemy.orm import Session

from owi_api.config import settings
from owi_api.db import get_session
from owi_api.ingestion.privacy import HogPersonDetector, PersonDetector
from owi_api.ingestion.service import ingest_observation
from owi_api.ingestion.storage import ObjectStore, get_store
from owi_api.routers.auth import require_device_token
from owi_api.schemas.observation import BatchResponse, ObservationIn, ObservationResult

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
    org_id: Annotated[uuid.UUID, Depends(require_device_token)],
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
        image_bytes = await file.read()
        if len(image_bytes) > settings.max_upload_bytes:
            results.append(
                ObservationResult(
                    observation_id=uuid.UUID(int=0), status="rejected", detail="image too large"
                )
            )
            continue
        try:
            ingested = ingest_observation(session, store, detector, org_id, item, image_bytes)
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
