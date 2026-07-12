from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from owi_api.ingestion.service import quarantine_key
from owi_api.ingestion.storage import ObjectStore
from owi_api.models.enums import PrivacyStatus
from owi_api.models.observation import Observation


def purge_expired_quarantine(session: Session, store: ObjectStore, retention_hours: int) -> int:
    """Delete pre-blur originals past retention; the stamp is the audit trail."""
    cutoff = datetime.now(UTC) - timedelta(hours=retention_hours)
    expired = session.scalars(
        select(Observation).where(
            Observation.privacy_status == PrivacyStatus.BLURRED,
            Observation.quarantine_deleted_at.is_(None),
            Observation.created_at <= cutoff,
        )
    ).all()
    for observation in expired:
        store.delete(quarantine_key(observation.org_id, observation.image_sha256))
        observation.quarantine_deleted_at = datetime.now(UTC)
    session.commit()
    return len(expired)
