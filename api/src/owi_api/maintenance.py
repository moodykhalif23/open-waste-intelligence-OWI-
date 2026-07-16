import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from owi_api.ingestion.service import quarantine_key
from owi_api.ingestion.storage import ObjectStore
from owi_api.models.enums import PrivacyStatus
from owi_api.models.observation import Observation
from owi_api.models.org_settings import RETENTION_DEFAULT_MONTHS, OrgSettings
from owi_api.models.registry import Organization


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


def retention_cutoff(now: datetime, months: int) -> datetime:
    # Calendar months vary; 30-day months err on retaining slightly longer, never shorter.
    return now - timedelta(days=30 * months)


def org_retention_months(session: Session, org_id: uuid.UUID) -> int:
    row = session.scalar(select(OrgSettings).where(OrgSettings.org_id == org_id))
    return row.image_retention_months if row else RETENTION_DEFAULT_MONTHS


def purge_expired_images(session: Session, store: ObjectStore) -> int:
    """Aggregate-then-delete: analytics rows stay, expired image pixels go.
    Each org's retention window comes from its settings (default 24 months)."""
    now = datetime.now(UTC)
    purged = 0
    for org_id in session.scalars(select(Organization.id)):
        cutoff = retention_cutoff(now, org_retention_months(session, org_id))
        expired = session.scalars(
            select(Observation).where(
                Observation.org_id == org_id,
                Observation.image_deleted_at.is_(None),
                Observation.captured_at <= cutoff,
            )
        ).all()
        for observation in expired:
            store.delete(observation.image_ref)
            observation.image_deleted_at = now
            purged += 1
    session.commit()
    return purged
