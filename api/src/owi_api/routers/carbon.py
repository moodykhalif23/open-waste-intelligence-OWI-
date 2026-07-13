import uuid
from collections import Counter
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from owi_api.analytics.carbon import carbon_report, load_factors
from owi_api.db import get_session
from owi_api.models.enums import UserRole
from owi_api.routers.analytics import _materials
from owi_api.routers.auth import require_roles
from owi_api.routers.recycling import _collected_kg
from owi_api.security import TokenClaims

router = APIRouter(prefix="/api/v1/carbon", tags=["carbon"])

STAFF = (UserRole.ADMIN, UserRole.COORDINATOR, UserRole.VIEWER)


def kg_by_material(session: Session, org_id: uuid.UUID, days: int) -> dict[str, float]:
    """Collected tonnage split by photo-derived composition — the input to carbon + value."""
    now = datetime.now(UTC)
    start = now - timedelta(days=days)
    total_kg = _collected_kg(session, org_id, start)
    counts = Counter(_materials(session, org_id, start, now, None))
    total_n = sum(counts.values())
    if total_n == 0:
        return {}
    return {m: total_kg * c / total_n for m, c in counts.items()}


class MaterialCarbonOut(BaseModel):
    material: str
    kg: float
    co2e_kg: float


class CarbonOut(BaseModel):
    window_days: int
    method_version: str
    co2e_avoided_kg: float
    co2e_low_kg: float
    co2e_high_kg: float
    landfill_m3_saved: float
    plastic_diverted_kg: float
    trees_equivalent: float
    car_km_equivalent: float
    materials: list[MaterialCarbonOut]


class FactorOut(BaseModel):
    material: str
    co2e_kg_per_kg: float


@router.get("/factors", response_model=list[FactorOut])
def factors(_: Annotated[TokenClaims, require_roles(*STAFF)]) -> list[FactorOut]:
    return [FactorOut(material=m, co2e_kg_per_kg=f) for m, f in load_factors().items()]


@router.get("", response_model=CarbonOut)
def carbon(
    claims: Annotated[TokenClaims, require_roles(*STAFF)],
    session: Annotated[Session, Depends(get_session)],
    days: Annotated[int, Query(gt=0, le=365)] = 30,
) -> CarbonOut:
    report = carbon_report(kg_by_material(session, claims.org_id, days), load_factors())
    return CarbonOut(
        window_days=days,
        method_version=report.method_version,
        co2e_avoided_kg=report.co2e_avoided_kg,
        co2e_low_kg=report.co2e_low_kg,
        co2e_high_kg=report.co2e_high_kg,
        landfill_m3_saved=report.landfill_m3_saved,
        plastic_diverted_kg=report.plastic_diverted_kg,
        trees_equivalent=report.trees_equivalent,
        car_km_equivalent=report.car_km_equivalent,
        materials=[
            MaterialCarbonOut(material=m.material, kg=m.kg, co2e_kg=m.co2e_kg)
            for m in report.materials
        ],
    )
