import uuid

import pytest
from fastapi import HTTPException

from owi_api.models.enums import UserRole
from owi_api.routers.users import ensure_can_manage
from owi_api.security import TokenClaims


def claims(role: UserRole) -> TokenClaims:
    return TokenClaims(uuid.uuid4(), uuid.uuid4(), role, 0)


@pytest.mark.parametrize("target", [UserRole.COLLECTOR, UserRole.VIEWER])
def test_coordinator_manages_field_roles(target: UserRole) -> None:
    ensure_can_manage(claims(UserRole.COORDINATOR), target)


@pytest.mark.parametrize("target", [UserRole.ADMIN, UserRole.COORDINATOR])
def test_coordinator_cannot_manage_privileged_roles(target: UserRole) -> None:
    with pytest.raises(HTTPException) as caught:
        ensure_can_manage(claims(UserRole.COORDINATOR), target)
    assert caught.value.status_code == 403


@pytest.mark.parametrize("target", list(UserRole))
def test_admin_manages_every_role(target: UserRole) -> None:
    ensure_can_manage(claims(UserRole.ADMIN), target)
