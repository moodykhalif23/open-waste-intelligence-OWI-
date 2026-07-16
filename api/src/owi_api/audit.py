"""Audit trail: one record_audit call per security-relevant mutation."""

import uuid

from fastapi import Request
from sqlalchemy.orm import Session

from owi_api.models.audit import AuditLog


def client_ip(request: Request | None) -> str | None:
    """Prefer the reverse proxy's X-Forwarded-For (first hop) over the socket peer."""
    if request is None:
        return None
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()[:45]
    return request.client.host if request.client else None


def record_audit(
    session: Session,
    *,
    org_id: uuid.UUID,
    action: str,
    entity: str,
    entity_id: uuid.UUID | None = None,
    actor_user_id: uuid.UUID | None = None,
    ip: str | None = None,
    detail: dict[str, object] | None = None,
) -> None:
    # Added to the caller's session so the trail commits atomically with the change.
    session.add(
        AuditLog(
            org_id=org_id,
            actor_user_id=actor_user_id,
            action=action,
            entity=entity,
            entity_id=entity_id,
            ip=ip,
            detail=detail or {},
        )
    )
