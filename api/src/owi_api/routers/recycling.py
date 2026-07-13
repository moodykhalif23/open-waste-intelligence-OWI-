import uuid
from collections import Counter
from datetime import UTC, date, datetime, timedelta
from html import escape
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from owi_api.analytics.recycling import match_partners, value_report
from owi_api.db import get_session
from owi_api.models.enums import UserRole
from owi_api.models.operations import CollectionEvent
from owi_api.models.recycling import MaterialPrice, RecyclingPartner
from owi_api.routers.analytics import _materials
from owi_api.routers.auth import get_current_user, require_roles
from owi_api.security import TokenClaims

router = APIRouter(prefix="/api/v1/recycling", tags=["recycling"])

STAFF = (UserRole.ADMIN, UserRole.COORDINATOR, UserRole.VIEWER)
EDITORS = (UserRole.ADMIN, UserRole.COORDINATOR)


class PriceIn(BaseModel):
    material: str = Field(min_length=1, max_length=30)
    kes_per_kg: float = Field(ge=0)
    effective_date: date
    source: str | None = None


class PriceOut(PriceIn):
    id: uuid.UUID


class PartnerIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    materials_accepted: list[str]
    min_kg_per_month: float = Field(default=0.0, ge=0)
    indicative_price_kes_per_kg: float | None = None
    contact: str | None = None


class PartnerOut(PartnerIn):
    id: uuid.UUID


class MaterialValueOut(BaseModel):
    material: str
    kg: float
    kes_per_kg: float | None
    value_kes: float
    partners: int


class ValueOut(BaseModel):
    window_days: int
    total_kg: float
    total_value_kes: float
    materials: list[MaterialValueOut]


def _current_prices(session: Session, org_id: uuid.UUID) -> dict[str, float]:
    # Latest price per material whose effective date has arrived.
    today = datetime.now(UTC).date()
    rows = session.scalars(
        select(MaterialPrice)
        .where(
            MaterialPrice.org_id == org_id,
            MaterialPrice.deleted_at.is_(None),
            MaterialPrice.effective_date <= today,
        )
        .order_by(MaterialPrice.material, MaterialPrice.effective_date.desc())
    )
    prices: dict[str, float] = {}
    for price in rows:
        prices.setdefault(price.material, price.kes_per_kg)
    return prices


@router.post("/prices", response_model=PriceOut, status_code=201)
def set_price(
    body: PriceIn,
    requester: Annotated[TokenClaims, require_roles(*EDITORS)],
    session: Annotated[Session, Depends(get_session)],
) -> PriceOut:
    price = MaterialPrice(org_id=requester.org_id, **body.model_dump())
    session.add(price)
    session.commit()
    return PriceOut(id=price.id, **body.model_dump())


@router.get("/prices", response_model=list[PriceOut])
def list_prices(
    requester: Annotated[TokenClaims, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_session)],
) -> list[PriceOut]:
    rows = session.scalars(
        select(MaterialPrice)
        .where(MaterialPrice.org_id == requester.org_id, MaterialPrice.deleted_at.is_(None))
        .order_by(MaterialPrice.material, MaterialPrice.effective_date.desc())
    )
    return [
        PriceOut(
            id=p.id,
            material=p.material,
            kes_per_kg=p.kes_per_kg,
            effective_date=p.effective_date,
            source=p.source,
        )
        for p in rows
    ]


@router.post("/partners", response_model=PartnerOut, status_code=201)
def add_partner(
    body: PartnerIn,
    requester: Annotated[TokenClaims, require_roles(*EDITORS)],
    session: Annotated[Session, Depends(get_session)],
) -> PartnerOut:
    partner = RecyclingPartner(org_id=requester.org_id, **body.model_dump())
    session.add(partner)
    session.commit()
    return PartnerOut(id=partner.id, **body.model_dump())


@router.get("/partners", response_model=list[PartnerOut])
def list_partners(
    requester: Annotated[TokenClaims, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_session)],
) -> list[PartnerOut]:
    rows = session.scalars(
        select(RecyclingPartner).where(
            RecyclingPartner.org_id == requester.org_id, RecyclingPartner.deleted_at.is_(None)
        )
    )
    return [
        PartnerOut(
            id=p.id,
            name=p.name,
            materials_accepted=p.materials_accepted,
            min_kg_per_month=p.min_kg_per_month,
            indicative_price_kes_per_kg=p.indicative_price_kes_per_kg,
            contact=p.contact,
        )
        for p in rows
    ]


def _collected_kg(session: Session, org_id: uuid.UUID, start: datetime) -> float:
    total = session.scalar(
        select(func.coalesce(func.sum(CollectionEvent.estimated_weight_kg), 0.0)).where(
            CollectionEvent.org_id == org_id,
            CollectionEvent.deleted_at.is_(None),
            CollectionEvent.occurred_at >= start,
        )
    )
    return float(total or 0.0)


def _value(session: Session, org_id: uuid.UUID, days: int) -> ValueOut:
    now = datetime.now(UTC)
    start = now - timedelta(days=days)
    total_kg = _collected_kg(session, org_id, start)
    materials = _materials(session, org_id, start, now, None)
    counts = Counter(materials)
    total_n = sum(counts.values())
    shares = {m: 100 * c / total_n for m, c in counts.items()} if total_n else {}
    report = value_report(total_kg, shares, _current_prices(session, org_id))

    partners = [
        (p.materials_accepted, p.min_kg_per_month)
        for p in session.scalars(
            select(RecyclingPartner).where(
                RecyclingPartner.org_id == org_id, RecyclingPartner.deleted_at.is_(None)
            )
        )
    ]
    monthly_factor = 30 / days
    out_materials = []
    for m in report.materials:
        kg_month = m.kg * monthly_factor
        n_partners = sum(1 for acc, min_kg in partners if m.material in acc and kg_month >= min_kg)
        out_materials.append(
            MaterialValueOut(
                material=m.material,
                kg=m.kg,
                kes_per_kg=m.kes_per_kg,
                value_kes=m.value_kes,
                partners=n_partners,
            )
        )
    return ValueOut(
        window_days=days,
        total_kg=report.total_kg,
        total_value_kes=report.total_value_kes,
        materials=out_materials,
    )


@router.get("/value", response_model=ValueOut)
def recycling_value(
    requester: Annotated[TokenClaims, require_roles(*STAFF)],
    session: Annotated[Session, Depends(get_session)],
    days: Annotated[int, Query(gt=0, le=365)] = 7,
) -> ValueOut:
    return _value(session, requester.org_id, days)


class MatchOut(BaseModel):
    partners: list[str]


@router.get("/partners/match", response_model=MatchOut)
def match(
    requester: Annotated[TokenClaims, require_roles(*STAFF)],
    session: Annotated[Session, Depends(get_session)],
    material: str,
    kg_per_month: float,
) -> MatchOut:
    partners = [
        (p.name, p.materials_accepted, p.min_kg_per_month)
        for p in session.scalars(
            select(RecyclingPartner).where(
                RecyclingPartner.org_id == requester.org_id,
                RecyclingPartner.deleted_at.is_(None),
            )
        )
    ]
    return MatchOut(partners=match_partners(material, kg_per_month, partners))


@router.get("/supply-profile")
def supply_profile(
    requester: Annotated[TokenClaims, require_roles(*EDITORS)],
    session: Annotated[Session, Depends(get_session)],
    material: str,
    days: Annotated[int, Query(gt=0, le=365)] = 30,
) -> Response:
    report = _value(session, requester.org_id, days)
    row = next((m for m in report.materials if m.material == material), None)
    kg = row.kg if row else 0.0
    kg_month = round(kg * 30 / days, 1)
    price = row.kes_per_kg if row else None
    price_text = f"KES {price:g}" if price else "-"
    html = f"""<!doctype html><html><head><meta charset="utf-8">
<title>Supply profile - {escape(material)}</title>
<style>body{{font-family:system-ui,sans-serif;max-width:640px;margin:40px auto;color:#101828}}
h1{{border-bottom:2px solid #15803d;padding-bottom:12px}}
.n{{font-size:2rem;font-weight:680}} .l{{color:#667085;font-size:.85rem}}
.row{{display:flex;gap:40px;margin:24px 0}}</style></head><body>
<h1>Supply profile - {escape(material)}</h1>
<div class="row">
  <div><div class="n">{kg_month:g} kg</div><div class="l">estimated per month</div></div>
  <div><div class="n">{price_text}</div><div class="l">per kg</div></div>
</div>
<p class="l">Estimated from photo-derived composition and collected tonnage over the last
{days} days. Figures are indicative; confirm against sorting-site weights before contracting.</p>
</body></html>"""
    return Response(content=html, media_type="text/html")
