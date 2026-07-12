import hashlib
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from owi_api.ingestion.privacy import PersonDetector, apply_privacy_gate
from owi_api.ingestion.storage import ObjectStore
from owi_api.models.enums import FillBand, LocationSource, PrivacyStatus
from owi_api.models.observation import Observation
from owi_api.schemas.observation import ObservationIn
from owi_api.worker.queue import enqueue_inference


@dataclass(frozen=True)
class IngestResult:
    observation_id: uuid.UUID
    duplicate: bool
    privacy_status: PrivacyStatus


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def ingest_observation(
    session: Session,
    store: ObjectStore,
    detector: PersonDetector,
    org_id: uuid.UUID,
    meta: ObservationIn,
    image_bytes: bytes,
) -> IngestResult:
    digest = sha256_hex(image_bytes)
    existing = session.scalar(
        select(Observation).where(Observation.org_id == org_id, Observation.image_sha256 == digest)
    )
    if existing:
        return IngestResult(existing.id, True, existing.privacy_status)

    gate = apply_privacy_gate(image_bytes, detector)
    image_ref = f"images/{org_id}/{digest}.jpg"
    store.put(image_ref, gate.image_bytes, "image/jpeg")
    if gate.status is PrivacyStatus.BLURRED:
        # Original kept only for blur verification; must be deleted within 72h.
        store.put(f"quarantine/{org_id}/{digest}.jpg", image_bytes, "image/jpeg")

    observation = Observation(
        org_id=org_id,
        captured_at=meta.captured_at,
        synced_at=datetime.now(UTC),
        location=f"SRID=4326;POINT({meta.lng} {meta.lat})",
        location_source=LocationSource.BIN_REGISTRY if meta.bin_id else LocationSource.GPS,
        bin_id=meta.bin_id,
        collector_id=meta.collector_id,
        image_ref=image_ref,
        image_sha256=digest,
        human_fill_tap=FillBand(meta.fill_tap) if meta.fill_tap else None,
        privacy_status=gate.status,
    )
    session.add(observation)
    session.commit()

    enqueue_inference(observation.id)
    return IngestResult(observation.id, False, gate.status)
