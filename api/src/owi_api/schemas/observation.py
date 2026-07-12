import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from owi_api.models.enums import FillBand, PrivacyStatus


class ObservationIn(BaseModel):
    captured_at: datetime
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    bin_id: uuid.UUID | None = None
    collector_id: uuid.UUID | None = None
    fill_tap: FillBand | None = None


class ObservationResult(BaseModel):
    observation_id: uuid.UUID
    status: str  # "created" | "duplicate" | "rejected"
    privacy_status: PrivacyStatus | None = None
    detail: str | None = None


class BatchResponse(BaseModel):
    results: list[ObservationResult]
