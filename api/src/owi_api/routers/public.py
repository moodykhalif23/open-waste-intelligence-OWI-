"""Open Data API — aggregates only, ward-level, small cells suppressed, 7-day delayed.

A hard governance boundary: no raw images, no coordinates, no bin identifiers ever leave
here. Consumers authenticate with a free API key (identify + rate-limit); the data served
is ward x week aggregates that pass the suppression floor and the delay window.
"""

import csv
import io
import secrets
import uuid
from collections import Counter, defaultdict
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from owi_api.analytics.composition import effective_material
from owi_api.analytics.public_data import (
    DATASET_VERSION,
    LICENSE,
    MIN_BINS,
    MIN_OBSERVATIONS,
    delay_cutoff,
    is_suppressed,
    iso_week,
)
from owi_api.config import settings
from owi_api.db import get_session
from owi_api.models.api_key import ApiKey
from owi_api.models.enums import FillBand, PredictionTask, UserRole
from owi_api.models.observation import Observation
from owi_api.models.prediction import Prediction
from owi_api.models.registry import Bin, Site
from owi_api.ratelimit import SlidingWindowLimiter
from owi_api.routers.auth import require_roles
from owi_api.security import TokenClaims, hash_password, verify_password

router = APIRouter(prefix="/api/v1/public", tags=["open-data"])
keys_router = APIRouter(prefix="/api/v1/admin/api-keys", tags=["open-data"])

_limiter = SlidingWindowLimiter(limit=settings.public_api_rate_per_min, window_seconds=60)
# Avoid a DB write on every call: only refresh last_used_at when it is this stale.
_LAST_USED_REFRESH = timedelta(minutes=5)


def _new_key() -> tuple[str, str]:
    """Return (full_key_shown_once, lookup_prefix). The full key is never stored in clear."""
    prefix = secrets.token_hex(4)
    return f"owi_{prefix}_{secrets.token_urlsafe(24)}", prefix


def require_api_key(
    session: Annotated[Session, Depends(get_session)],
    x_api_key: str = Header(default=""),
) -> ApiKey:
    parts = x_api_key.split("_")
    if len(parts) != 3 or parts[0] != "owi":
        raise HTTPException(status_code=401, detail="missing or malformed API key")
    key = session.scalar(
        select(ApiKey).where(
            ApiKey.key_prefix == parts[1],
            ApiKey.revoked_at.is_(None),
            ApiKey.deleted_at.is_(None),
        )
    )
    if key is None or not verify_password(x_api_key, key.key_hash):
        raise HTTPException(status_code=401, detail="invalid API key")
    if not _limiter.allow(key.key_prefix):
        raise HTTPException(status_code=429, detail="rate limit exceeded")
    now = datetime.now(UTC)
    if key.last_used_at is None or now - key.last_used_at > _LAST_USED_REFRESH:
        key.last_used_at = now
        session.commit()
    return key


# ---- shared aggregation ----


def _window(weeks: int) -> tuple[datetime, datetime]:
    """[start, end) capped so nothing newer than the delay window is exposed."""
    end = delay_cutoff(datetime.now(UTC), settings.public_api_delay_days)
    return end - timedelta(weeks=weeks), end


def _observation_rows(
    session: Session, start: datetime, end: datetime, ward: str | None
) -> list[tuple[str, str, uuid.UUID | None, FillBand | None]]:
    """(ward, week, bin_id, fill) for delayed, ward-attributable observations."""
    query = (
        select(Site.ward, Observation.captured_at, Observation.bin_id, Observation.human_fill_tap)
        .join(Bin, Bin.id == Observation.bin_id)
        .join(Site, Site.id == Bin.site_id)
        .where(
            Observation.deleted_at.is_(None),
            Observation.captured_at >= start,
            Observation.captured_at < end,
            Site.ward.is_not(None),
        )
    )
    if ward is not None:
        query = query.where(Site.ward == ward)
    return [
        (w, iso_week(captured.date()), bin_id, fill)
        for w, captured, bin_id, fill in session.execute(query)
    ]


def _csv_response(rows: list[dict[str, object]], fields: list[str], name: str) -> Response:
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=fields)
    writer.writeheader()
    writer.writerows(rows)
    return Response(
        content=buffer.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="owi-{name}.csv"'},
    )


# ---- meta (no key required, for discovery) ----


class MetaOut(BaseModel):
    dataset_version: str
    license: str
    attribution: str
    delay_days: int
    suppression: str
    endpoints: list[str]


@router.get("/meta", response_model=MetaOut)
def meta() -> MetaOut:
    return MetaOut(
        dataset_version=DATASET_VERSION,
        license=LICENSE,
        attribution="OpenWaste Intelligence / Safi Cleaners and Recyclers, CC-BY-4.0",
        delay_days=settings.public_api_delay_days,
        suppression=(
            f"ward x week cells with fewer than {MIN_BINS} bins or "
            f"{MIN_OBSERVATIONS} observations are withheld"
        ),
        endpoints=["/composition", "/cleanliness", "/collections"],
    )


# ---- composition ----


class MaterialShareOut(BaseModel):
    material: str
    share_pct: float


class CompositionCell(BaseModel):
    ward: str
    week: str
    observations: int
    materials: list[MaterialShareOut]


class CompositionOut(BaseModel):
    dataset_version: str = DATASET_VERSION
    license: str = LICENSE
    suppressed_cells: int
    cells: list[CompositionCell]


@router.get("/composition", response_model=None)
def composition_public(
    _: Annotated[ApiKey, Depends(require_api_key)],
    session: Annotated[Session, Depends(get_session)],
    weeks: Annotated[int, Query(gt=0, le=52)] = 12,
    ward: str | None = None,
    format: Annotated[str, Query(pattern="^(json|csv)$")] = "json",
) -> CompositionOut | Response:
    start, end = _window(weeks)
    query = (
        select(
            Prediction.observation_id,
            Site.ward,
            Observation.captured_at,
            Observation.bin_id,
            Prediction.payload,
            Prediction.corrected_payload,
            Prediction.review_status,
        )
        .join(Observation, Observation.id == Prediction.observation_id)
        .join(Bin, Bin.id == Observation.bin_id)
        .join(Site, Site.id == Bin.site_id)
        .where(
            Prediction.task == PredictionTask.CLASSIFY,
            Prediction.deleted_at.is_(None),
            Observation.captured_at >= start,
            Observation.captured_at < end,
            Site.ward.is_not(None),
        )
        .order_by(Prediction.observation_id, Prediction.created_at.desc())
    )
    if ward is not None:
        query = query.where(Site.ward == ward)
    # Keep the latest classification per observation, bucketed into ward x week cells.
    seen_obs: set[uuid.UUID] = set()
    materials: dict[tuple[str, str], list[str]] = defaultdict(list)
    bins: dict[tuple[str, str], set[uuid.UUID | None]] = defaultdict(set)
    for obs_id, ward_name, captured, bin_id, payload, corrected, status in session.execute(query):
        if obs_id in seen_obs:
            continue  # order_by keeps the newest prediction first per observation
        seen_obs.add(obs_id)
        material = effective_material(payload, corrected, status)
        if material is None:
            continue
        cell = (ward_name, iso_week(captured.date()))
        materials[cell].append(material)
        bins[cell].add(bin_id)
    cells: list[CompositionCell] = []
    suppressed = 0
    for cell, mats in materials.items():
        if is_suppressed(len(bins[cell]), len(mats)):
            suppressed += 1
            continue
        total = len(mats)
        shares = [
            MaterialShareOut(material=m, share_pct=round(100 * c / total, 1))
            for m, c in Counter(mats).most_common()
        ]
        cells.append(
            CompositionCell(ward=cell[0], week=cell[1], observations=total, materials=shares)
        )
    cells.sort(key=lambda c: (c.ward, c.week))
    if format == "csv":
        flat = [
            {"ward": c.ward, "week": c.week, "observations": c.observations,
             "material": m.material, "share_pct": m.share_pct}
            for c in cells
            for m in c.materials
        ]
        return _csv_response(
            flat, ["ward", "week", "observations", "material", "share_pct"], "composition"
        )
    return CompositionOut(suppressed_cells=suppressed, cells=cells)


# ---- collections ----


class CollectionsCell(BaseModel):
    ward: str
    week: str
    observations: int
    bins: int
    overflow_rate_pct: float


class CollectionsOut(BaseModel):
    dataset_version: str = DATASET_VERSION
    license: str = LICENSE
    suppressed_cells: int
    cells: list[CollectionsCell]


@router.get("/collections", response_model=None)
def collections_public(
    _: Annotated[ApiKey, Depends(require_api_key)],
    session: Annotated[Session, Depends(get_session)],
    weeks: Annotated[int, Query(gt=0, le=52)] = 12,
    ward: str | None = None,
    format: Annotated[str, Query(pattern="^(json|csv)$")] = "json",
) -> CollectionsOut | Response:
    start, end = _window(weeks)
    obs_count: dict[tuple[str, str], int] = defaultdict(int)
    overflow: dict[tuple[str, str], int] = defaultdict(int)
    cell_bins: dict[tuple[str, str], set[uuid.UUID | None]] = defaultdict(set)
    for ward_name, week, bin_id, fill in _observation_rows(session, start, end, ward):
        cell = (ward_name, week)
        obs_count[cell] += 1
        cell_bins[cell].add(bin_id)
        if fill == FillBand.OVERFLOWING:
            overflow[cell] += 1
    cells: list[CollectionsCell] = []
    suppressed = 0
    for cell, count in obs_count.items():
        if is_suppressed(len(cell_bins[cell]), count):
            suppressed += 1
            continue
        cells.append(
            CollectionsCell(
                ward=cell[0],
                week=cell[1],
                observations=count,
                bins=len(cell_bins[cell]),
                overflow_rate_pct=round(100 * overflow[cell] / count, 1),
            )
        )
    cells.sort(key=lambda c: (c.ward, c.week))
    if format == "csv":
        flat = [c.model_dump() for c in cells]
        return _csv_response(
            flat, ["ward", "week", "observations", "bins", "overflow_rate_pct"], "collections"
        )
    return CollectionsOut(suppressed_cells=suppressed, cells=cells)


# ---- cleanliness ----


class CleanlinessCell(BaseModel):
    ward: str
    week: str
    mean_score: float


class CleanlinessOut(BaseModel):
    dataset_version: str = DATASET_VERSION
    license: str = LICENSE
    suppressed_cells: int
    cells: list[CleanlinessCell]


@router.get("/cleanliness", response_model=None)
def cleanliness_public(
    _: Annotated[ApiKey, Depends(require_api_key)],
    session: Annotated[Session, Depends(get_session)],
    weeks: Annotated[int, Query(gt=0, le=52)] = 12,
    ward: str | None = None,
    format: Annotated[str, Query(pattern="^(json|csv)$")] = "json",
) -> CleanlinessOut | Response:
    from owi_api.models.cleanliness import CleanlinessDaily

    start, end = _window(weeks)
    # Backing (bins + observations) gates suppression, same floor as the other endpoints.
    backing_bins: dict[tuple[str, str], set[uuid.UUID | None]] = defaultdict(set)
    backing_obs: dict[tuple[str, str], int] = defaultdict(int)
    for ward_name, week, bin_id, _fill in _observation_rows(session, start, end, ward):
        backing_bins[(ward_name, week)].add(bin_id)
        backing_obs[(ward_name, week)] += 1

    scores: dict[tuple[str, str], list[float]] = defaultdict(list)
    query = (
        select(Site.ward, CleanlinessDaily.date, CleanlinessDaily.score)
        .join(Site, Site.id == CleanlinessDaily.site_id)
        .where(
            CleanlinessDaily.deleted_at.is_(None),
            CleanlinessDaily.date >= start.date(),
            CleanlinessDaily.date < end.date(),
            CleanlinessDaily.score.is_not(None),
            Site.ward.is_not(None),
        )
    )
    if ward is not None:
        query = query.where(Site.ward == ward)
    for ward_name, day, score in session.execute(query):
        scores[(ward_name, iso_week(day))].append(float(score))

    cells: list[CleanlinessCell] = []
    suppressed = 0
    for cell, values in scores.items():
        if is_suppressed(len(backing_bins[cell]), backing_obs[cell]):
            suppressed += 1
            continue
        mean = round(sum(values) / len(values), 1)
        cells.append(CleanlinessCell(ward=cell[0], week=cell[1], mean_score=mean))
    cells.sort(key=lambda c: (c.ward, c.week))
    if format == "csv":
        flat = [c.model_dump() for c in cells]
        return _csv_response(flat, ["ward", "week", "mean_score"], "cleanliness")
    return CleanlinessOut(suppressed_cells=suppressed, cells=cells)


# ---- key management (admin only) ----


class KeyOut(BaseModel):
    id: uuid.UUID
    label: str
    key_prefix: str
    created_at: datetime
    last_used_at: datetime | None
    revoked_at: datetime | None


class KeyCreateRequest(BaseModel):
    label: str


class KeyCreatedOut(KeyOut):
    api_key: str  # shown once


@keys_router.get("", response_model=list[KeyOut])
def list_keys(
    requester: Annotated[TokenClaims, require_roles(UserRole.ADMIN)],
    session: Annotated[Session, Depends(get_session)],
) -> list[ApiKey]:
    return list(
        session.scalars(
            select(ApiKey)
            .where(ApiKey.org_id == requester.org_id, ApiKey.deleted_at.is_(None))
            .order_by(ApiKey.created_at.desc())
        )
    )


@keys_router.post("", response_model=KeyCreatedOut)
def create_key(
    body: KeyCreateRequest,
    requester: Annotated[TokenClaims, require_roles(UserRole.ADMIN)],
    session: Annotated[Session, Depends(get_session)],
) -> KeyCreatedOut:
    full, prefix = _new_key()
    key = ApiKey(
        org_id=requester.org_id,
        label=body.label,
        key_prefix=prefix,
        key_hash=hash_password(full),
        created_by=requester.user_id,
    )
    session.add(key)
    session.commit()
    session.refresh(key)
    return KeyCreatedOut(
        id=key.id,
        label=key.label,
        key_prefix=key.key_prefix,
        created_at=key.created_at,
        last_used_at=key.last_used_at,
        revoked_at=key.revoked_at,
        api_key=full,
    )


@keys_router.post("/{key_id}/revoke", response_model=KeyOut)
def revoke_key(
    key_id: uuid.UUID,
    requester: Annotated[TokenClaims, require_roles(UserRole.ADMIN)],
    session: Annotated[Session, Depends(get_session)],
) -> ApiKey:
    key = session.get(ApiKey, key_id)
    if key is None or key.org_id != requester.org_id or key.deleted_at is not None:
        raise HTTPException(status_code=404, detail="key not found")
    if key.revoked_at is None:
        key.revoked_at = datetime.now(UTC)
        session.commit()
    return key
