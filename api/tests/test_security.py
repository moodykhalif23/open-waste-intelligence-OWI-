import uuid
from datetime import timedelta

import pytest

from owi_api.models.enums import UserRole
from owi_api.security import (
    InvalidTokenError,
    TokenClaims,
    create_token,
    decode_token,
    hash_password,
    verify_password,
)


def claims(role: UserRole = UserRole.COLLECTOR, version: int = 0) -> TokenClaims:
    return TokenClaims(uuid.uuid4(), uuid.uuid4(), role, version)


def test_password_hash_roundtrip() -> None:
    hashed = hash_password("correct horse battery staple")
    assert verify_password("correct horse battery staple", hashed)
    assert not verify_password("wrong password", hashed)


def test_hash_is_salted() -> None:
    assert hash_password("same input") != hash_password("same input")


def test_token_roundtrip() -> None:
    original = claims(UserRole.COORDINATOR, version=3)
    decoded = decode_token(create_token(original, timedelta(hours=1)))
    assert decoded == original


def test_expired_token_rejected() -> None:
    token = create_token(claims(), timedelta(seconds=-1))
    with pytest.raises(InvalidTokenError):
        decode_token(token)


def test_tampered_token_rejected() -> None:
    token = create_token(claims(), timedelta(hours=1))
    header, payload, signature = token.split(".")
    with pytest.raises(InvalidTokenError):
        decode_token(f"{header}.{payload}.{'A' * len(signature)}")


def test_garbage_token_rejected() -> None:
    with pytest.raises(InvalidTokenError):
        decode_token("not-a-jwt")
