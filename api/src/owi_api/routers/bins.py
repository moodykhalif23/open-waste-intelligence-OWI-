import io
import secrets
import uuid
from typing import Annotated

import segno
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from owi_api.db import get_session
from owi_api.models.enums import UserRole
from owi_api.models.registry import Bin, Site
from owi_api.routers.auth import get_current_user, require_roles
from owi_api.schemas.registry import BinCreate, BinOut
from owi_api.security import TokenClaims

router = APIRouter(prefix="/api/v1/bins", tags=["registry"])


def _to_out(bin_: Bin, lat: float, lng: float) -> BinOut:
    return BinOut(
        id=bin_.id,
        site_id=bin_.site_id,
        qr_code=bin_.qr_code,
        lat=lat,
        lng=lng,
        volume_liters=bin_.volume_liters,
        bin_type=bin_.bin_type,
    )


def _select_with_coords() -> Select[tuple[Bin, float, float]]:
    return select(Bin, func.ST_Y(Bin.location), func.ST_X(Bin.location)).where(
        Bin.deleted_at.is_(None)
    )


@router.post("", response_model=BinOut, status_code=201)
def create_bin(
    body: BinCreate,
    session: Annotated[Session, Depends(get_session)],
    requester: Annotated[TokenClaims, require_roles(UserRole.ADMIN, UserRole.COORDINATOR)],
) -> BinOut:
    site = session.get(Site, body.site_id)
    if site is None or site.org_id != requester.org_id or site.deleted_at is not None:
        raise HTTPException(status_code=404, detail="site not found")

    bin_ = Bin(
        org_id=requester.org_id,
        site_id=body.site_id,
        # Random slug: QR codes are printed in public, so they must not be enumerable.
        qr_code=secrets.token_urlsafe(8),
        location=f"SRID=4326;POINT({body.lng} {body.lat})",
        volume_liters=body.volume_liters,
        bin_type=body.bin_type,
    )
    session.add(bin_)
    session.commit()
    return _to_out(bin_, body.lat, body.lng)


@router.get("", response_model=list[BinOut])
def list_bins(
    session: Annotated[Session, Depends(get_session)],
    requester: Annotated[TokenClaims, Depends(get_current_user)],
) -> list[BinOut]:
    rows = session.execute(_select_with_coords().where(Bin.org_id == requester.org_id))
    return [_to_out(bin_, lat, lng) for bin_, lat, lng in rows]


@router.get("/by-qr/{code}", response_model=BinOut)
def get_bin_by_qr(
    code: str,
    session: Annotated[Session, Depends(get_session)],
    requester: Annotated[TokenClaims, Depends(get_current_user)],
) -> BinOut:
    row = session.execute(
        _select_with_coords().where(Bin.qr_code == code, Bin.org_id == requester.org_id)
    ).first()
    if row is None:
        raise HTTPException(status_code=404, detail="bin not found")
    bin_, lat, lng = row
    return _to_out(bin_, lat, lng)


@router.get("/{bin_id}/qr.svg")
def get_bin_qr_svg(
    bin_id: uuid.UUID,
    session: Annotated[Session, Depends(get_session)],
    requester: Annotated[TokenClaims, require_roles(UserRole.ADMIN, UserRole.COORDINATOR)],
) -> Response:
    bin_ = session.get(Bin, bin_id)
    if bin_ is None or bin_.org_id != requester.org_id or bin_.deleted_at is not None:
        raise HTTPException(status_code=404, detail="bin not found")

    buffer = io.BytesIO()
    segno.make(bin_.qr_code, error="m").save(buffer, kind="svg", scale=8)
    return Response(content=buffer.getvalue(), media_type="image/svg+xml")
