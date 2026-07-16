import base64
import hmac
import secrets
import struct
import time
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

from owi_api.config import settings
from owi_api.models.enums import UserRole

_hasher = PasswordHasher()

ALGORITHM = "HS256"


class InvalidTokenError(Exception):
    pass


@dataclass(frozen=True)
class TokenClaims:
    user_id: uuid.UUID
    org_id: uuid.UUID
    role: UserRole
    token_version: int


def hash_password(plain: str) -> str:
    return _hasher.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return _hasher.verify(hashed, plain)
    except VerifyMismatchError:
        return False


def create_token(claims: TokenClaims, ttl: timedelta) -> str:
    payload = {
        "sub": str(claims.user_id),
        "org": str(claims.org_id),
        "role": claims.role.value,
        "ver": claims.token_version,
        "exp": datetime.now(UTC) + ttl,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def decode_token(token: str) -> TokenClaims:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
        return TokenClaims(
            user_id=uuid.UUID(payload["sub"]),
            org_id=uuid.UUID(payload["org"]),
            role=UserRole(payload["role"]),
            token_version=int(payload["ver"]),
        )
    except (jwt.PyJWTError, KeyError, ValueError) as exc:
        raise InvalidTokenError(str(exc)) from exc


# RFC 6238 TOTP in stdlib — 6 digits, 30s steps, SHA-1 (what authenticator apps expect).
TOTP_STEP_S = 30
TOTP_DIGITS = 6


def new_totp_secret() -> str:
    return base64.b32encode(secrets.token_bytes(20)).decode()


def _hotp(key: bytes, counter: int) -> str:
    mac = hmac.new(key, struct.pack(">Q", counter), "sha1").digest()
    offset = mac[-1] & 0x0F
    code = (int.from_bytes(mac[offset : offset + 4]) & 0x7FFFFFFF) % 10**TOTP_DIGITS
    return f"{code:0{TOTP_DIGITS}d}"


def totp_now(secret_b32: str, at: float | None = None) -> str:
    key = base64.b32decode(secret_b32)
    return _hotp(key, int((time.time() if at is None else at) // TOTP_STEP_S))


def verify_totp(secret_b32: str, code: str, at: float | None = None, window: int = 1) -> bool:
    """±window steps of clock drift tolerated — field phones are rarely NTP-perfect."""
    try:
        key = base64.b32decode(secret_b32)
    except (ValueError, TypeError):
        return False
    counter = int((time.time() if at is None else at) // TOTP_STEP_S)
    return any(
        hmac.compare_digest(_hotp(key, counter + offset), code)
        for offset in range(-window, window + 1)
    )
