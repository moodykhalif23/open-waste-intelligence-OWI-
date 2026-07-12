import uuid

from pydantic import BaseModel, Field


class SiteCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    site_type: str = Field(min_length=1, max_length=50)
    ward: str | None = Field(default=None, max_length=100)


class SiteOut(BaseModel):
    id: uuid.UUID
    name: str
    site_type: str
    ward: str | None


class BinCreate(BaseModel):
    site_id: uuid.UUID
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    volume_liters: int = Field(gt=0)
    bin_type: str = Field(min_length=1, max_length=50)


class BinOut(BaseModel):
    id: uuid.UUID
    site_id: uuid.UUID
    qr_code: str
    lat: float
    lng: float
    volume_liters: int
    bin_type: str
