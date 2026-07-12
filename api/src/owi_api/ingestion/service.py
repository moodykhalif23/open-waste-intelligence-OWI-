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
from owi_api.models.registry import Bin
from owi_api.schemas.observation import ObservationIn
from owi_api.worker.queue import enqueue_inference


@dataclass(frozen=True)
class IngestResult:
    observation_id: uuid.UUID
    duplicate: bool
    privacy_status: PrivacyStatus


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def quarantine_key(org_id: uuid.UUID, digest: str) -> str:
    return f"quarantine/{org_id}/{digest}.jpg"


def resolve_bin(session: Session, org_id: uuid.UUID, meta: ObservationIn) -> Bin | None:
    if meta.bin_id is not None:
        bin_ = session.get(Bin, meta.bin_id)
    elif meta.bin_qr is not None:
        bin_ = session.scalar(select(Bin).where(Bin.qr_code == meta.bin_qr))
    else:
        return None
    # org check: a bin reference must never attach data across tenants.
    if bin_ is None or bin_.org_id != org_id or bin_.deleted_at is not None:
        raise ValueError("unknown bin")
    return bin_


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

    bin_ = resolve_bin(session, org_id, meta)
    has_gps = meta.lat is not None and meta.lng is not None
    if has_gps:
        location: object = f"SRID=4326;POINT({meta.lng} {meta.lat})"
        location_source = LocationSource.GPS
    else:
        assert bin_ is not None  # schema guarantees GPS or a bin reference
        location = bin_.location
        location_source = LocationSource.BIN_REGISTRY

    gate = apply_privacy_gate(image_bytes, detector)
    image_ref = f"images/{org_id}/{digest}.jpg"
    store.put(image_ref, gate.image_bytes, "image/jpeg")
    if gate.status is PrivacyStatus.BLURRED:
        # Original kept only for blur verification; the purge job deletes it within 72h.
        store.put(quarantine_key(org_id, digest), image_bytes, "image/jpeg")

    observation = Observation(
        org_id=org_id,
        captured_at=meta.captured_at,
        synced_at=datetime.now(UTC),
        location=location,
        location_source=location_source,
        bin_id=bin_.id if bin_ else None,
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
