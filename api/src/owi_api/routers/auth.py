import io
import secrets
import uuid
from datetime import timedelta
from typing import Annotated
from urllib.parse import quote

import segno
from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from owi_api.audit import client_ip, record_audit
from owi_api.config import settings
from owi_api.db import get_session
from owi_api.models.enums import UserRole
from owi_api.models.registry import User
from owi_api.ratelimit import SlidingWindowLimiter
from owi_api.security import (
    InvalidTokenError,
    TokenClaims,
    create_token,
    decode_token,
    hash_password,
    new_totp_secret,
    verify_password,
    verify_totp,
)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

# Per-IP is looser than per-account: whole sites share one NAT IP in the field.
phone_limiter = SlidingWindowLimiter(limit=10, window_seconds=15 * 60)
ip_limiter = SlidingWindowLimiter(limit=50, window_seconds=15 * 60)


def get_current_user(
    session: Annotated[Session, Depends(get_session)],
    authorization: str = Header(default=""),
) -> TokenClaims:
    token = authorization.removeprefix("Bearer ").strip()
    try:
        claims = decode_token(token)
    except InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail="invalid token") from exc

    user = session.get(User, claims.user_id)
    # token_version check makes stateless JWTs revocable per user.
    if user is None or user.deleted_at is not None or user.token_version != claims.token_version:
        raise HTTPException(status_code=401, detail="token revoked")
    return claims


def require_roles(*roles: UserRole) -> object:
    def guard(claims: Annotated[TokenClaims, Depends(get_current_user)]) -> TokenClaims:
        if claims.role not in roles:
            raise HTTPException(status_code=403, detail="insufficient role")
        return claims

    return Depends(guard)


class LoginRequest(BaseModel):
    phone: str
    password: str
    otp: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: UserRole


class DeviceTokenRequest(BaseModel):
    user_id: uuid.UUID


class MeResponse(BaseModel):
    user_id: uuid.UUID
    org_id: uuid.UUID
    role: UserRole
    mfa_enabled: bool


@router.post("/login", response_model=TokenResponse)
def login(
    body: LoginRequest,
    request: Request,
    session: Annotated[Session, Depends(get_session)],
) -> TokenResponse:
    # Keyed per account and per source
    client_ip = request.client.host if request.client else "unknown"
    if not phone_limiter.allow(body.phone) or not ip_limiter.allow(client_ip):
        raise HTTPException(status_code=429, detail="too many attempts, try later")

    user = session.scalar(select(User).where(User.phone == body.phone, User.deleted_at.is_(None)))
    if (
        user is None
        or user.password_hash is None
        or not verify_password(body.password, user.password_hash)
    ):
        raise HTTPException(status_code=401, detail="invalid credentials")
    if user.mfa_enabled:
        _require_second_factor(session, user, body.otp)

    claims = TokenClaims(user.id, user.org_id, user.role, user.token_version)
    token = create_token(claims, timedelta(hours=settings.access_token_ttl_hours))
    return TokenResponse(access_token=token, role=user.role)


def _use_recovery_code(user: User, code: str) -> bool:
    for hashed in list(user.mfa_recovery or []):
        if verify_password(code, hashed):
            # Reassign (not mutate) so SQLAlchemy sees the JSONB change.
            user.mfa_recovery = [h for h in (user.mfa_recovery or []) if h != hashed]
            return True
    return False


def _require_second_factor(session: Session, user: User, otp: str | None) -> None:
    if not otp:
        raise HTTPException(status_code=401, detail="otp required")
    if verify_totp(user.mfa_secret or "", otp) or _use_recovery_code(user, otp):
        session.commit()  # a spent recovery code must not be reusable
        return
    raise HTTPException(status_code=401, detail="invalid otp")


@router.post("/device-tokens", response_model=TokenResponse)
def issue_device_token(
    body: DeviceTokenRequest,
    request: Request,
    session: Annotated[Session, Depends(get_session)],
    requester: Annotated[TokenClaims, require_roles(UserRole.ADMIN, UserRole.COORDINATOR)],
) -> TokenResponse:
    user = session.get(User, body.user_id)
    if user is None or user.deleted_at is not None or user.org_id != requester.org_id:
        raise HTTPException(status_code=404, detail="user not found")

    claims = TokenClaims(user.id, user.org_id, user.role, user.token_version)
    token = create_token(claims, timedelta(days=settings.device_token_ttl_days))
    record_audit(
        session,
        org_id=requester.org_id,
        actor_user_id=requester.user_id,
        action="device_token.issue",
        entity="user",
        entity_id=user.id,
        ip=client_ip(request),
        detail={"ttl_days": settings.device_token_ttl_days},
    )
    session.commit()
    return TokenResponse(access_token=token, role=user.role)


@router.get("/me", response_model=MeResponse)
def me(
    claims: Annotated[TokenClaims, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_session)],
) -> MeResponse:
    user = session.get(User, claims.user_id)
    return MeResponse(
        user_id=claims.user_id,
        org_id=claims.org_id,
        role=claims.role,
        mfa_enabled=bool(user and user.mfa_enabled),
    )


class MfaEnrollResponse(BaseModel):
    secret: str
    otpauth_uri: str


class MfaCodeRequest(BaseModel):
    code: str


class MfaRecoveryResponse(BaseModel):
    recovery_codes: list[str]


def _current_user_row(session: Session, claims: TokenClaims) -> User:
    user = session.get(User, claims.user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="invalid token")
    return user


def _otpauth_uri(user: User) -> str:
    label = quote(f"OpenWaste:{user.phone or user.name}")
    return f"otpauth://totp/{label}?secret={user.mfa_secret}&issuer=OpenWaste"


@router.post("/mfa/enroll", response_model=MfaEnrollResponse)
def mfa_enroll(
    claims: Annotated[TokenClaims, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_session)],
) -> MfaEnrollResponse:
    user = _current_user_row(session, claims)
    if user.mfa_enabled:
        raise HTTPException(status_code=409, detail="MFA already active — disable it first")
    user.mfa_secret = new_totp_secret()
    session.commit()
    return MfaEnrollResponse(secret=user.mfa_secret, otpauth_uri=_otpauth_uri(user))


@router.get("/mfa/qr.svg")
def mfa_qr_svg(
    claims: Annotated[TokenClaims, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_session)],
) -> Response:
    user = _current_user_row(session, claims)
    # Only during enrollment: once active, re-serving the QR would leak the secret.
    if user.mfa_secret is None or user.mfa_enabled:
        raise HTTPException(status_code=404, detail="no enrollment in progress")
    buffer = io.BytesIO()
    segno.make(_otpauth_uri(user), error="m").save(buffer, kind="svg", scale=6)
    return Response(content=buffer.getvalue(), media_type="image/svg+xml")


@router.post("/mfa/activate", response_model=MfaRecoveryResponse)
def mfa_activate(
    body: MfaCodeRequest,
    request: Request,
    claims: Annotated[TokenClaims, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_session)],
) -> MfaRecoveryResponse:
    user = _current_user_row(session, claims)
    if user.mfa_secret is None or user.mfa_enabled:
        raise HTTPException(status_code=409, detail="no enrollment in progress")
    if not verify_totp(user.mfa_secret, body.code):
        raise HTTPException(status_code=401, detail="invalid otp")
    recovery = [secrets.token_hex(5) for _ in range(8)]
    user.mfa_recovery = [hash_password(code) for code in recovery]
    user.mfa_enabled = True
    record_audit(
        session,
        org_id=claims.org_id,
        actor_user_id=claims.user_id,
        action="mfa.enable",
        entity="user",
        entity_id=user.id,
        ip=client_ip(request),
    )
    session.commit()
    return MfaRecoveryResponse(recovery_codes=recovery)


@router.post("/mfa/disable", status_code=204)
def mfa_disable(
    body: MfaCodeRequest,
    request: Request,
    claims: Annotated[TokenClaims, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_session)],
) -> None:
    user = _current_user_row(session, claims)
    if not user.mfa_enabled:
        raise HTTPException(status_code=409, detail="MFA is not active")
    if not (verify_totp(user.mfa_secret or "", body.code) or _use_recovery_code(user, body.code)):
        raise HTTPException(status_code=401, detail="invalid otp")
    user.mfa_secret = None
    user.mfa_enabled = False
    user.mfa_recovery = None
    record_audit(
        session,
        org_id=claims.org_id,
        actor_user_id=claims.user_id,
        action="mfa.disable",
        entity="user",
        entity_id=user.id,
        ip=client_ip(request),
    )
    session.commit()
