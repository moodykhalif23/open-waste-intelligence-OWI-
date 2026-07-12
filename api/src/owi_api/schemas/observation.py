import uuid
from datetime import datetime

from pydantic import BaseModel, Field, model_validator

from owi_api.models.enums import FillBand, PrivacyStatus


class ObservationIn(BaseModel):
    captured_at: datetime
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)
    bin_id: uuid.UUID | None = None
    bin_qr: str | None = Field(default=None, max_length=64)
    collector_id: uuid.UUID | None = None
    fill_tap: FillBand | None = None

    @model_validator(mode="after")
    def check_locatable(self) -> "ObservationIn":
        has_gps = self.lat is not None and self.lng is not None
        if not has_gps and self.bin_id is None and self.bin_qr is None:
            raise ValueError("observation needs GPS coordinates or a bin reference")
        return self


class ObservationResult(BaseModel):
    observation_id: uuid.UUID
    status: str  # "created" | "duplicate" | "rejected"
    privacy_status: PrivacyStatus | None = None
    detail: str | None = None


class BatchResponse(BaseModel):
    results: list[ObservationResult]
