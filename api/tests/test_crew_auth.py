import uuid
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import jwt
import pytest
from fastapi import HTTPException, Request
from pydantic import ValidationError

from owi_api.config import settings
from owi_api.models.audit import AuditLog
from owi_api.models.enums import CollectionMethod, UserRole
from owi_api.models.route import Truck
from owi_api.ratelimit import SlidingWindowLimiter
from owi_api.routers import auth
from owi_api.routers.auth import FieldLoginRequest, field_login, get_current_user, me
from owi_api.routers.users import PinIn, set_pin
from owi_api.security import ALGORITHM, TokenClaims, create_token, hash_password, verify_password

ORG = uuid.uuid4()
PIN = "246810"
REQUEST = Request(
    {"type": "http", "method": "POST", "path": "/", "headers": [], "client": ("10.0.0.7", 1)}
)
TUKTUK = SimpleNamespace(
    id=uuid.uuid4(), name="TVS King tuk-tuk KMFJ 117A", method=CollectionMethod.TRICYCLE
)


def _user(role: UserRole = UserRole.COLLECTOR, pin: str | None = PIN) -> SimpleNamespace:
    return SimpleNamespace(
        id=uuid.uuid4(),
        org_id=ORG,
        name="Dennis Omondi",
        phone=f"+2547{uuid.uuid4().int % 10**8:08d}",
        role=role,
        password_hash=hash_password(pin) if pin else None,
        token_version=3,
        mfa_enabled=False,
        vehicle_id=TUKTUK.id,
        deleted_at=None,
    )


class AuthSession:
    def __init__(self, user: SimpleNamespace) -> None:
        self.user = user
        self.added: list[object] = []
        self.commits = 0

    def scalar(self, _statement: object) -> SimpleNamespace:
        return self.user

    def get(self, model: object, id_: uuid.UUID) -> SimpleNamespace | None:
        if model is Truck:
            return TUKTUK if id_ == TUKTUK.id else None
        return self.user if id_ == self.user.id else None

    def add(self, row: object) -> None:
        self.added.append(row)

    def commit(self) -> None:
        self.commits += 1

    def actions(self) -> list[str]:
        return [row.action for row in self.added if isinstance(row, AuditLog)]


@pytest.fixture(autouse=True)
def _fresh_limiters(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(auth, "phone_limiter", SlidingWindowLimiter(10, 900))
    monkeypatch.setattr(auth, "ip_limiter", SlidingWindowLimiter(50, 900))


def _field_login(session: AuthSession, pin: str = PIN) -> auth.FieldLoginResponse:
    return field_login(FieldLoginRequest(phone=session.user.phone, pin=pin), REQUEST, session)


def test_field_login_issues_a_device_token_for_a_collector() -> None:
    user = _user()
    session = AuthSession(user)

    out = _field_login(session)

    payload = jwt.decode(out.access_token, settings.jwt_secret, algorithms=[ALGORITHM])
    assert payload["sub"] == str(user.id) and payload["org"] == str(ORG)
    assert payload["role"] == "collector" and payload["ver"] == 3
    lifetime = datetime.fromtimestamp(payload["exp"], UTC) - datetime.now(UTC)
    assert abs(lifetime - timedelta(days=settings.device_token_ttl_days)) < timedelta(minutes=1)
    assert out.role is UserRole.COLLECTOR and out.name == "Dennis Omondi"
    assert out.vehicle is not None
    assert (out.vehicle.id, out.vehicle.name, out.vehicle.method) == (
        TUKTUK.id,
        TUKTUK.name,
        CollectionMethod.TRICYCLE,
    )
    assert session.actions() == ["auth.field_login"]


def test_field_login_without_a_vehicle_returns_null_vehicle() -> None:
    user = _user()
    user.vehicle_id = None

    assert _field_login(AuthSession(user)).vehicle is None


@pytest.mark.parametrize(
    "role", [UserRole.ADMIN, UserRole.COORDINATOR, UserRole.VIEWER, UserRole.API_CONSUMER]
)
def test_field_login_sends_other_roles_to_the_dashboard(role: UserRole) -> None:
    session = AuthSession(_user(role))

    with pytest.raises(HTTPException) as exc:
        _field_login(session)

    assert exc.value.status_code == 403
    assert exc.value.detail == "use the dashboard sign-in"
    assert session.actions() == []


def test_field_login_wrong_pin_is_audited_as_a_failed_login() -> None:
    session = AuthSession(_user(UserRole.ADMIN))

    with pytest.raises(HTTPException) as exc:
        _field_login(session, pin="135790")

    assert exc.value.status_code == 401
    assert session.actions() == ["auth.login_failed"]


def test_field_login_needs_a_pin_to_be_set() -> None:
    with pytest.raises(HTTPException) as exc:
        _field_login(AuthSession(_user(pin=None)))

    assert exc.value.status_code == 401


def test_field_login_shares_the_login_rate_limit() -> None:
    session = AuthSession(_user())
    for _ in range(10):
        with pytest.raises(HTTPException):
            _field_login(session, pin="000000")

    with pytest.raises(HTTPException) as exc:
        _field_login(session)

    assert exc.value.status_code == 429


def test_me_reports_name_and_vehicle() -> None:
    user = _user()
    claims = TokenClaims(user.id, ORG, user.role, user.token_version)

    out = me(claims, AuthSession(user))

    assert out.name == "Dennis Omondi"
    assert out.vehicle is not None and out.vehicle.method is CollectionMethod.TRICYCLE


@pytest.mark.parametrize("pin", ["24681", "1234567890123", "24681a", " 246810", "", "٢٤٦٨١٠"])
def test_pin_must_be_six_to_twelve_digits(pin: str) -> None:
    with pytest.raises(ValidationError):
        PinIn(pin=pin)


@pytest.mark.parametrize("pin", ["246810", "123456789012"])
def test_pin_accepts_six_to_twelve_digits(pin: str) -> None:
    assert PinIn(pin=pin).pin == pin


def _planner(role: UserRole = UserRole.COORDINATOR) -> TokenClaims:
    return TokenClaims(uuid.uuid4(), ORG, role, 0)


def test_setting_a_pin_revokes_old_device_tokens() -> None:
    user = _user(pin=None)
    session = AuthSession(user)
    old_token = create_token(
        TokenClaims(user.id, ORG, user.role, user.token_version), timedelta(days=180)
    )

    set_pin(user.id, PinIn(pin="975310"), REQUEST, session, _planner())

    assert user.token_version == 4
    assert verify_password("975310", user.password_hash)
    assert session.actions() == ["user.pin_set"] and session.commits == 1
    with pytest.raises(HTTPException) as exc:
        get_current_user(session, f"Bearer {old_token}")
    assert exc.value.detail == "token revoked"
    assert _field_login(session, pin="975310").access_token


@pytest.mark.parametrize("role", [UserRole.VIEWER, UserRole.COORDINATOR, UserRole.ADMIN])
def test_pins_are_for_collectors_only(role: UserRole) -> None:
    user = _user(role, pin=None)

    with pytest.raises(HTTPException) as exc:
        set_pin(user.id, PinIn(pin=PIN), REQUEST, AuthSession(user), _planner(UserRole.ADMIN))

    assert exc.value.status_code == 403
    assert user.password_hash is None and user.token_version == 3


def test_coordinator_cannot_set_a_pin_on_an_admin() -> None:
    user = _user(UserRole.ADMIN, pin=None)

    with pytest.raises(HTTPException) as exc:
        set_pin(user.id, PinIn(pin=PIN), REQUEST, AuthSession(user), _planner())

    assert exc.value.detail == "coordinators manage collectors and viewers only"


def test_pin_cannot_be_set_across_orgs() -> None:
    user = _user(pin=None)
    user.org_id = uuid.uuid4()

    with pytest.raises(HTTPException) as exc:
        set_pin(user.id, PinIn(pin=PIN), REQUEST, AuthSession(user), _planner())

    assert exc.value.status_code == 404
