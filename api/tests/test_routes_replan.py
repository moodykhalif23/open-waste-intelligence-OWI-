import uuid
from collections.abc import Iterator
from types import SimpleNamespace

from owi_api.models.enums import RouteStatus, UserRole
from owi_api.routers.routes import ReplanIn, replan_routes
from owi_api.security import TokenClaims


class EmptyPendingSession:
    def __init__(self, status: RouteStatus = RouteStatus.PLANNED) -> None:
        self.route = SimpleNamespace(id=uuid.uuid4(), deleted_at=None, status=status)
        self.calls = 0
        self.commits = 0

    def scalars(self, _statement: object) -> "_ScalarResults":
        self.calls += 1
        return _ScalarResults([self.route] if self.calls == 1 else [])

    def commit(self) -> None:
        self.commits += 1


class _ScalarResults:
    def __init__(self, values: list[object]) -> None:
        self.values = values

    def all(self) -> list[object]:
        return self.values

    def __iter__(self) -> Iterator[object]:
        return iter(self.values)


def test_replan_with_no_uncollected_stops_leaves_existing_plan_unchanged() -> None:
    session = EmptyPendingSession()
    claims = TokenClaims(uuid.uuid4(), uuid.uuid4(), UserRole.ADMIN, 0)

    assert replan_routes(ReplanIn(), claims, session) == []
    assert session.route.deleted_at is None
    assert session.commits == 0


def test_replan_does_not_supersede_an_active_route() -> None:
    session = EmptyPendingSession(RouteStatus.ACTIVE)
    claims = TokenClaims(uuid.uuid4(), uuid.uuid4(), UserRole.ADMIN, 0)

    assert replan_routes(ReplanIn(), claims, session) == []
    assert session.route.deleted_at is None
    assert session.commits == 0
