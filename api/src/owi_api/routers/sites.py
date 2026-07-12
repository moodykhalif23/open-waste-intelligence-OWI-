from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from owi_api.db import get_session
from owi_api.models.enums import UserRole
from owi_api.models.registry import Site
from owi_api.routers.auth import get_current_user, require_roles
from owi_api.schemas.registry import SiteCreate, SiteOut
from owi_api.security import TokenClaims

router = APIRouter(prefix="/api/v1/sites", tags=["registry"])


@router.post("", response_model=SiteOut, status_code=201)
def create_site(
    body: SiteCreate,
    session: Annotated[Session, Depends(get_session)],
    requester: Annotated[TokenClaims, require_roles(UserRole.ADMIN, UserRole.COORDINATOR)],
) -> SiteOut:
    site = Site(org_id=requester.org_id, name=body.name, site_type=body.site_type, ward=body.ward)
    session.add(site)
    session.commit()
    return SiteOut(id=site.id, name=site.name, site_type=site.site_type, ward=site.ward)


@router.get("", response_model=list[SiteOut])
def list_sites(
    session: Annotated[Session, Depends(get_session)],
    requester: Annotated[TokenClaims, Depends(get_current_user)],
) -> list[SiteOut]:
    sites = session.scalars(
        select(Site).where(Site.org_id == requester.org_id, Site.deleted_at.is_(None))
    )
    return [SiteOut(id=s.id, name=s.name, site_type=s.site_type, ward=s.ward) for s in sites]
