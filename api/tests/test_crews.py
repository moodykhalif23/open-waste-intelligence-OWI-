import uuid
from datetime import UTC, date, datetime
from types import SimpleNamespace
from typing import Any

import pytest
from fastapi import HTTPException, Request
from sqlalchemy.dialects import postgresql

from owi_api.models.audit import AuditLog
from owi_api.models.enums import CollectionMethod, UserRole
from owi_api.models.registry import User
from owi_api.models.route import Truck
from owi_api.routers.routes import CrewIn, list_routes, list_trucks, set_truck_crew
from owi_api.security import TokenClaims

ORG = uuid.uuid4()
OTHER_ORG = uuid.uuid4()
REQUEST = Request(
    {"type": "http", "method": "PUT", "path": "/", "headers": [], "client": ("10.0.0.5", 1)}
)


def _truck(name: str, org_id: uuid.UUID = ORG) -> SimpleNamespace:
    return SimpleNamespace(
        id=uuid.uuid4(),
        org_id=org_id,
        name=name,
        method=CollectionMethod.TRUCK,
        capacity_kg=3000.0,
        fuel_l_per_100km=22.0,
        deleted_at=None,
    )


def _user(
    name: str,
    role: UserRole = UserRole.COLLECTOR,
    vehicle_id: uuid.UUID | None = None,
    org_id: uuid.UUID = ORG,
    deleted: bool = False,
) -> SimpleNamespace:
    return SimpleNamespace(
        id=uuid.uuid4(),
        org_id=org_id,
        name=name,
        phone=f"+2547{uuid.uuid4().int % 10**8:08d}",
        role=role,
        vehicle_id=vehicle_id,
        deleted_at=datetime.now(UTC) if deleted else None,
    )


def _claims(role: UserRole, user_id: uuid.UUID | None = None) -> TokenClaims:
    return TokenClaims(user_id or uuid.uuid4(), ORG, role, 0)


class _Rows:
    def all(self) -> list[object]:
        return []


class CrewSession:
    def __init__(self, users: list[SimpleNamespace], trucks: list[SimpleNamespace]) -> None:
        self.users = users
        self.trucks = trucks
        self.statements: list[Any] = []
        self.added: list[object] = []
        self.commits = 0

    def get(self, model: object, id_: uuid.UUID) -> SimpleNamespace | None:
        rows = self.users if model is User else self.trucks
        return next((row for row in rows if row.id == id_), None)

    def scalars(self, statement: Any) -> list[SimpleNamespace]:
        if statement.column_descriptions[0]["entity"] is Truck:
            return [t for t in self.trucks if t.org_id == ORG]
        sql = statement.compile(dialect=postgresql.dialect())
        text, param = str(sql), next(iter(sql.params.values()))
        if "users.id IN" in text:
            return [u for u in self.users if u.id in param]
        if "users.vehicle_id = " in text:
            return [u for u in self.users if u.vehicle_id == param]
        crew = [
            u
            for u in self.users
            if u.org_id == param and u.deleted_at is None and u.vehicle_id is not None
        ]
        return sorted(crew, key=lambda u: u.name)

    def execute(self, statement: Any) -> _Rows:
        self.statements.append(statement)
        return _Rows()

    def add(self, row: object) -> None:
        self.added.append(row)

    def commit(self) -> None:
        self.commits += 1


def _route_params(session: CrewSession) -> set[object]:
    [statement] = session.statements
    return set(statement.compile(dialect=postgresql.dialect()).params.values())


def test_collector_lists_only_their_vehicles_routes() -> None:
    truck = _truck("Isuzu FVR")
    driver = _user("John Kamau", vehicle_id=truck.id)
    session = CrewSession([driver], [truck])

    assert list_routes(_claims(UserRole.COLLECTOR, driver.id), session, date(2026, 10, 28)) == []

    assert truck.id in _route_params(session)


def test_unassigned_collector_lists_no_routes() -> None:
    walker = _user("Mary Njeri")
    session = CrewSession([walker], [])

    assert list_routes(_claims(UserRole.COLLECTOR, walker.id), session, None) == []

    assert session.statements == []


@pytest.mark.parametrize("role", [UserRole.ADMIN, UserRole.COORDINATOR, UserRole.VIEWER])
def test_other_roles_list_every_vehicles_routes(role: UserRole) -> None:
    truck = _truck("Isuzu FVR")
    staff = _user("Grace Wanjiku", role=role, vehicle_id=truck.id)
    session = CrewSession([staff], [truck])

    list_routes(_claims(role, staff.id), session, date(2026, 10, 28))

    assert truck.id not in _route_params(session)


def _set_crew(
    session: CrewSession, truck: SimpleNamespace, members: list[SimpleNamespace]
) -> list[Any]:
    return set_truck_crew(
        truck.id,
        CrewIn(user_ids=[m.id for m in members]),
        REQUEST,
        _claims(UserRole.COORDINATOR),
        session,
    )


@pytest.mark.parametrize(
    "outsider",
    [
        _user("Grace Wanjiku", role=UserRole.COORDINATOR),
        _user("Read Only", role=UserRole.VIEWER),
        _user("Open Data", role=UserRole.API_CONSUMER),
        _user("Kevin Ouma", org_id=OTHER_ORG),
        _user("erased user", deleted=True),
    ],
    ids=["coordinator", "viewer", "api-consumer", "other-org", "erased"],
)
def test_crew_must_be_active_collectors_in_the_org(outsider: SimpleNamespace) -> None:
    truck = _truck("Isuzu FVR")
    member = _user("John Kamau", vehicle_id=truck.id)
    newcomer = _user("Mary Njeri")
    session = CrewSession([member, newcomer, outsider], [truck])

    with pytest.raises(HTTPException) as exc:
        _set_crew(session, truck, [newcomer, outsider])

    assert exc.value.status_code == 422
    assert member.vehicle_id == truck.id
    assert newcomer.vehicle_id is None and outsider.vehicle_id is None
    assert session.commits == 0 and session.added == []


def test_crew_rejects_unknown_users() -> None:
    truck = _truck("Isuzu FVR")
    session = CrewSession([], [truck])

    with pytest.raises(HTTPException) as exc:
        _set_crew(session, truck, [_user("ghost")])

    assert exc.value.status_code == 422


def test_crew_update_moves_members_between_vehicles_and_drops_the_rest() -> None:
    truck_a, truck_b = _truck("Isuzu FVR"), _truck("TVS King tuk-tuk")
    mover = _user("Dennis Omondi", vehicle_id=truck_a.id)
    stays_on_a = _user("Joseph Mwangi", vehicle_id=truck_a.id)
    kept = _user("Janet Akinyi", vehicle_id=truck_b.id)
    dropped = _user("Brian Kiprotich", vehicle_id=truck_b.id)
    session = CrewSession([mover, stays_on_a, kept, dropped], [truck_a, truck_b])

    crew = _set_crew(session, truck_b, [mover, kept, mover])

    assert [m.name for m in crew] == ["Dennis Omondi", "Janet Akinyi"]
    assert crew[0].phone == mover.phone
    assert mover.vehicle_id == truck_b.id and kept.vehicle_id == truck_b.id
    assert dropped.vehicle_id is None
    assert stays_on_a.vehicle_id == truck_a.id
    assert session.commits == 1
    [audit] = session.added
    assert isinstance(audit, AuditLog)
    assert audit.action == "truck.crew_update"
    assert audit.entity_id == truck_b.id
    assert audit.detail == {
        "user_ids": [str(mover.id), str(kept.id)],
        "removed": [str(dropped.id)],
    }


def test_empty_crew_clears_the_vehicle() -> None:
    truck = _truck("Mkokoteni crew Mathare")
    member = _user("Kevin Ouma", vehicle_id=truck.id)
    session = CrewSession([member], [truck])

    assert _set_crew(session, truck, []) == []
    assert member.vehicle_id is None


def test_crew_update_cannot_reach_another_orgs_vehicle() -> None:
    truck = _truck("Isuzu FVR", org_id=OTHER_ORG)
    session = CrewSession([], [truck])

    with pytest.raises(HTTPException) as exc:
        _set_crew(session, truck, [])

    assert exc.value.status_code == 404


def _listed_crew(role: UserRole) -> dict[str, list[tuple[str, str | None]]]:
    truck, cart = _truck("Isuzu FVR"), _truck("Mkokoteni crew Korogocho")
    users = [
        _user("Mary Njeri", vehicle_id=truck.id),
        _user("John Kamau", vehicle_id=truck.id),
        _user("Brian Kiprotich", vehicle_id=cart.id),
        _user("erased user", vehicle_id=cart.id, deleted=True),
        _user("Lucy Wairimu"),
    ]
    trucks = list_trucks(_claims(role), CrewSession(users, [truck, cart]))
    return {t.name: [(m.name, m.phone) for m in t.crew] for t in trucks}


@pytest.mark.parametrize("role", [UserRole.ADMIN, UserRole.COORDINATOR])
def test_planners_see_each_vehicles_crew_with_phones(role: UserRole) -> None:
    listed = _listed_crew(role)

    assert [name for name, _ in listed["Isuzu FVR"]] == ["John Kamau", "Mary Njeri"]
    assert [name for name, _ in listed["Mkokoteni crew Korogocho"]] == ["Brian Kiprotich"]
    assert all(phone for crew in listed.values() for _, phone in crew)


@pytest.mark.parametrize("role", [UserRole.COLLECTOR, UserRole.VIEWER])
def test_field_and_viewer_roles_see_crew_names_only(role: UserRole) -> None:
    listed = _listed_crew(role)

    assert [name for name, _ in listed["Isuzu FVR"]] == ["John Kamau", "Mary Njeri"]
    assert all(phone is None for crew in listed.values() for _, phone in crew)


def test_api_consumers_see_no_crew() -> None:
    assert _listed_crew(UserRole.API_CONSUMER) == {
        "Isuzu FVR": [],
        "Mkokoteni crew Korogocho": [],
    }
