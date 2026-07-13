import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from owi_api.config import settings
from owi_api.models.operations import BinHealthDaily
from owi_api.models.registry import Bin


def estimate_collection_weight(session: Session, bin_id: uuid.UUID) -> float:
    """kg collected ~ latest fill x bin volume x waste density; unknown fill assumes full."""
    bin_ = session.get(Bin, bin_id)
    if bin_ is None:
        return 0.0
    fill_pct = session.scalar(
        select(BinHealthDaily.fill_pct)
        .where(BinHealthDaily.bin_id == bin_id)
        .order_by(BinHealthDaily.date.desc())
        .limit(1)
    )
    fill = fill_pct if fill_pct is not None else 100.0
    return round(fill / 100 * bin_.volume_liters * settings.waste_density_kg_per_l, 2)
