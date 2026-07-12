import uuid
from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from owi_api.config import settings
from owi_api.db import get_session
from owi_api.models.enums import UserRole
from owi_api.models.registry import User
from owi_api.security import (
    InvalidTokenError,
    TokenClaims,
    create_token,
    decode_token,
    verify_password,
)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


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


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, session: Annotated[Session, Depends(get_session)]) -> TokenResponse:
    user = session.scalar(select(User).where(User.phone == body.phone, User.deleted_at.is_(None)))
    if (
        user is None
        or user.password_hash is None
        or not verify_password(body.password, user.password_hash)
    ):
        raise HTTPException(status_code=401, detail="invalid credentials")

    claims = TokenClaims(user.id, user.org_id, user.role, user.token_version)
    token = create_token(claims, timedelta(hours=settings.access_token_ttl_hours))
    return TokenResponse(access_token=token, role=user.role)


@router.post("/device-tokens", response_model=TokenResponse)
def issue_device_token(
    body: DeviceTokenRequest,
    session: Annotated[Session, Depends(get_session)],
    requester: Annotated[TokenClaims, require_roles(UserRole.ADMIN, UserRole.COORDINATOR)],
) -> TokenResponse:
    user = session.get(User, body.user_id)
    if user is None or user.deleted_at is not None or user.org_id != requester.org_id:
        raise HTTPException(status_code=404, detail="user not found")

    claims = TokenClaims(user.id, user.org_id, user.role, user.token_version)
    token = create_token(claims, timedelta(days=settings.device_token_ttl_days))
    return TokenResponse(access_token=token, role=user.role)


@router.get("/me", response_model=MeResponse)
def me(claims: Annotated[TokenClaims, Depends(get_current_user)]) -> MeResponse:
    return MeResponse(user_id=claims.user_id, org_id=claims.org_id, role=claims.role)
