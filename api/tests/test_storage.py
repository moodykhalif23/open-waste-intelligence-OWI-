from pathlib import Path

import pytest

from owi_api.ingestion.service import sha256_hex
from owi_api.ingestion.storage import LocalStore


def test_local_store_roundtrip(tmp_path: Path) -> None:
    store = LocalStore(tmp_path)
    store.put("images/org/abc.jpg", b"payload", "image/jpeg")
    assert store.get("images/org/abc.jpg") == b"payload"
    store.delete("images/org/abc.jpg")
    with pytest.raises(FileNotFoundError):
        store.get("images/org/abc.jpg")


def test_local_store_blocks_path_escape(tmp_path: Path) -> None:
    store = LocalStore(tmp_path)
    with pytest.raises(ValueError, match="escapes"):
        store.put("../outside.jpg", b"x", "image/jpeg")


def test_sha256_is_stable_for_dedupe() -> None:
    assert sha256_hex(b"same bytes") == sha256_hex(b"same bytes")
    assert sha256_hex(b"same bytes") != sha256_hex(b"other bytes")
