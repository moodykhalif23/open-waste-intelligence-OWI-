"""Per-org settings access: org value wins, deployment default fills the gaps."""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from owi_api.config import settings
from owi_api.models.org_settings import OrgSettings


def org_settings_row(session: Session, org_id: uuid.UUID) -> OrgSettings:
    row = session.scalar(select(OrgSettings).where(OrgSettings.org_id == org_id))
    if row is None:
        row = OrgSettings(org_id=org_id)
        session.add(row)
        session.flush()
    return row


def override(value: float | None, default: float) -> float:
    return default if value is None else value


def effective_waste_density(session: Session, org_id: uuid.UUID) -> float:
    row = session.scalar(select(OrgSettings).where(OrgSettings.org_id == org_id))
    return override(row.waste_density_kg_per_l if row else None, settings.waste_density_kg_per_l)


def effective_fuel_price(session: Session, org_id: uuid.UUID) -> float:
    row = session.scalar(select(OrgSettings).where(OrgSettings.org_id == org_id))
    return override(row.fuel_price_kes_per_l if row else None, settings.fuel_price_kes_per_l)
