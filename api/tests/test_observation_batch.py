import asyncio
import io
import json
import uuid
from typing import Any, cast

from fastapi import UploadFile

from owi_api.models.enums import UserRole
from owi_api.routers.observations import ingest_batch
from owi_api.security import TokenClaims


def upload() -> UploadFile:
    return UploadFile(io.BytesIO(b"jpeg"), filename="r.jpg")


def test_invalid_items_are_rejected_one_by_one() -> None:
    meta = [
        {"captured_at": "2026-10-28T07:40:00Z", "bin_qr": "Q" * 80},
        {"captured_at": "2026-10-28T07:41:00Z", "fill_tap": "high"},
    ]
    claims = TokenClaims(uuid.uuid4(), uuid.uuid4(), UserRole.COLLECTOR, 0)
    unused = cast(Any, None)
    response = asyncio.run(
        ingest_batch([upload(), upload()], json.dumps(meta), claims, unused, unused, unused)
    )
    assert [r.status for r in response.results] == ["rejected", "rejected"]
    assert "bin_qr" in (response.results[0].detail or "")
    assert "GPS" in (response.results[1].detail or "")
