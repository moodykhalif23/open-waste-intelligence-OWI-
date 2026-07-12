from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from owi_api.analytics.refresh import refresh_bin_health
from owi_api.config import settings
from owi_api.db import get_session
from owi_api.ingestion.storage import ObjectStore, get_store
from owi_api.maintenance import purge_expired_quarantine
from owi_api.models.enums import UserRole
from owi_api.routers.auth import require_roles
from owi_api.security import TokenClaims

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


def get_object_store() -> ObjectStore:
    return get_store(settings)


@router.post("/analytics/refresh")
def run_analytics_refresh(
    requester: Annotated[TokenClaims, require_roles(UserRole.ADMIN, UserRole.COORDINATOR)],
    session: Annotated[Session, Depends(get_session)],
) -> dict[str, int]:
    return {"bins": refresh_bin_health(session)}


@router.post("/quarantine/purge")
def purge_quarantine(
    requester: Annotated[TokenClaims, require_roles(UserRole.ADMIN)],
    session: Annotated[Session, Depends(get_session)],
    store: Annotated[ObjectStore, Depends(get_object_store)],
) -> dict[str, int]:
    purged = purge_expired_quarantine(session, store, settings.quarantine_retention_hours)
    return {"purged": purged}
