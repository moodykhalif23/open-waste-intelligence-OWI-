import uuid
from collections.abc import Iterator
from datetime import UTC, datetime, time, timedelta
from types import SimpleNamespace
from typing import Any

import pytest
from fastapi import HTTPException

from owi_api.models.enums import CollectionMethod, RouteStatus, UserRole
from owi_api.models.operations import CollectionEvent
from owi_api.models.registry import User
from owi_api.models.route import Route, RouteStop
from owi_api.routers import routes
from owi_api.routers.routes import (
    ReplanIn,
    RouteActionIn,
    RouteCompleteIn,
    StopSkipIn,
    collect_stop,
    complete_route,
    replan_routes,
    skip_stop,
    start_route,
)
from owi_api.security import TokenClaims

ORG = uuid.uuid4()
DRIVER = uuid.uuid4()


class _ScalarResults:
    def __init__(self, values: list[object]) -> None:
        self.values = values

    def all(self) -> list[object]:
        return self.values

    def __iter__(self) -> Iterator[object]:
        return iter(self.values)


class RouteSession:
    def __init__(
        self,
        route: SimpleNamespace,
        stops: list[SimpleNamespace],
        vehicle_id: uuid.UUID | None = None,
    ) -> None:
        self.route = route
        self.stops = stops
        self.vehicle_id = vehicle_id or route.truck_id
        self.added: list[object] = []
        self.commits = 0

    def scalar(self, statement: Any) -> object:
        entity = statement.column_descriptions[0]["entity"]
        if entity is Route:
            return self.route
        if entity is RouteStop:
            ids = set(statement.compile().params.values())
            return next((s for s in self.stops if s.id in ids), None)
        return len(self._matching(statement))

    def scalars(self, statement: Any) -> _ScalarResults:
        if statement.column_descriptions[0]["entity"] is Route:
            return _ScalarResults([self.route])
        return _ScalarResults(list(self._matching(statement)))

    def execute(self, _statement: object) -> SimpleNamespace:
        return SimpleNamespace(one=lambda: ("OWI-0001", -1.29, 36.82))

    def get(self, model: object, _id: object) -> SimpleNamespace:
        if model is User:
            return SimpleNamespace(vehicle_id=self.vehicle_id)
        return SimpleNamespace(name="Truck 1", method=CollectionMethod.TRUCK)

    def add(self, row: object) -> None:
        self.added.append(row)

    def commit(self) -> None:
        self.commits += 1

    def _matching(self, statement: Any) -> list[SimpleNamespace]:
        sql = str(statement.compile())
        return [
            s
            for s in self.stops
            if ("collected IS false" not in sql or not s.collected)
            and ("skipped_at IS NULL" not in sql or s.skipped_at is None)
        ]


def _route(
    status: RouteStatus = RouteStatus.ACTIVE, started_by: uuid.UUID | None = DRIVER
) -> SimpleNamespace:
    now = datetime.now(UTC)
    return SimpleNamespace(
        id=uuid.uuid4(),
        truck_id=uuid.uuid4(),
        date=(now - timedelta(days=1)).date(),
        status=status,
        planned_km=4.2,
        planned_fuel_l=1.1,
        demand_kg=300.0,
        bins_served=2,
        started_at=None if status is RouteStatus.PLANNED else now - timedelta(hours=2),
        started_by_user_id=None if status is RouteStatus.PLANNED else started_by,
        completed_at=None,
        actual_distance_km=None,
        actual_fuel_l=None,
        actual_weight_kg=None,
        deleted_at=None,
    )


def _stop(
    route: SimpleNamespace, seq: int, collected: bool = False, skipped: bool = False
) -> SimpleNamespace:
    return SimpleNamespace(
        id=uuid.uuid4(),
        org_id=ORG,
        route_id=route.id,
        bin_id=uuid.uuid4(),
        seq=seq,
        collected=collected,
        skipped_at=datetime.now(UTC) - timedelta(hours=1) if skipped else None,
        skip_reason="blocked" if skipped else None,
    )


def _claims(user_id: uuid.UUID = DRIVER, role: UserRole = UserRole.COLLECTOR) -> TokenClaims:
    return TokenClaims(user_id, ORG, role, 0)


@pytest.fixture(autouse=True)
def _no_bin_refresh(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(routes, "estimate_collection_weight", lambda *_: 12.0)
    monkeypatch.setattr(routes, "refresh_bin", lambda *_: None)


def test_skip_resolves_a_stop_without_collecting_it() -> None:
    route = _route()
    stop = _stop(route, 0)
    session = RouteSession(route, [stop])
    at = datetime.now(UTC) - timedelta(minutes=10)

    skip_stop(stop.id, _claims(), session, StopSkipIn(reason="  missing  ", occurred_at=at))

    assert stop.skipped_at == at
    assert stop.skip_reason == "missing"
    assert stop.collected is False
    assert session.added == []
    assert session.commits == 1


def test_skip_without_a_body_records_server_time_and_no_reason() -> None:
    route = _route()
    stop = _stop(route, 0)
    before = datetime.now(UTC)

    skip_stop(stop.id, _claims(), RouteSession(route, [stop]), None)

    assert stop.skipped_at is not None and stop.skipped_at >= before
    assert stop.skip_reason is None


def test_replayed_skip_is_a_no_op() -> None:
    route = _route()
    stop = _stop(route, 0, skipped=True)
    first = stop.skipped_at
    session = RouteSession(route, [stop])

    skip_stop(stop.id, _claims(), session, StopSkipIn(reason="damaged"))

    assert stop.skipped_at == first
    assert stop.skip_reason == "blocked"
    assert session.commits == 0


def test_skip_rejects_a_collected_stop() -> None:
    route = _route()
    stop = _stop(route, 0, collected=True)

    with pytest.raises(HTTPException) as exc:
        skip_stop(stop.id, _claims(), RouteSession(route, [stop]), None)

    assert exc.value.status_code == 409
    assert stop.skipped_at is None


def test_skip_needs_a_started_route() -> None:
    route = _route(RouteStatus.PLANNED)
    stop = _stop(route, 0)

    with pytest.raises(HTTPException) as exc:
        skip_stop(stop.id, _claims(), RouteSession(route, [stop]), None)

    assert exc.value.status_code == 409


def test_collector_cannot_skip_on_a_route_started_elsewhere() -> None:
    route = _route(started_by=uuid.uuid4())
    stop = _stop(route, 0)

    with pytest.raises(HTTPException) as exc:
        skip_stop(stop.id, _claims(), RouteSession(route, [stop]), None)

    assert exc.value.status_code == 403
    assert stop.skipped_at is None


def test_replayed_collect_is_a_no_op() -> None:
    route = _route()
    stop = _stop(route, 0, collected=True)
    session = RouteSession(route, [stop])

    collect_stop(stop.id, _claims(), session, RouteActionIn(occurred_at=datetime.now(UTC)))

    assert session.added == []
    assert session.commits == 0


def test_collecting_a_skipped_stop_replaces_the_skip_and_clamps_to_route_start() -> None:
    route = _route()
    stop = _stop(route, 0, skipped=True)
    session = RouteSession(route, [stop])

    collect_stop(
        stop.id,
        _claims(),
        session,
        RouteActionIn(occurred_at=route.started_at - timedelta(hours=1)),
    )

    assert stop.collected is True
    assert stop.skipped_at is None and stop.skip_reason is None
    [event] = session.added
    assert isinstance(event, CollectionEvent)
    assert event.occurred_at == route.started_at


def test_complete_accepts_a_mix_of_collected_and_skipped_stops() -> None:
    route = _route()
    session = RouteSession(route, [_stop(route, 0, collected=True), _stop(route, 1, skipped=True)])
    at = datetime.now(UTC) - timedelta(minutes=5)

    out = complete_route(
        route.id,
        RouteCompleteIn(actual_fuel_l=3.5, actual_weight_kg=410, occurred_at=at),
        _claims(),
        session,
    )

    assert out.status is RouteStatus.DONE
    assert route.completed_at == at
    assert [s.skipped for s in out.stops] == [False, True]
    assert out.stops[1].skip_reason == "blocked"
    assert session.commits == 1


def test_complete_is_still_blocked_by_unresolved_stops() -> None:
    route = _route()
    session = RouteSession(route, [_stop(route, 0, skipped=True), _stop(route, 1)])

    with pytest.raises(HTTPException) as exc:
        complete_route(
            route.id, RouteCompleteIn(actual_fuel_l=1, actual_weight_kg=1), _claims(), session
        )

    assert exc.value.status_code == 409
    assert route.status is RouteStatus.ACTIVE


def test_replayed_complete_is_a_no_op() -> None:
    route = _route(RouteStatus.DONE)
    route.completed_at = datetime.now(UTC) - timedelta(minutes=30)
    route.actual_weight_kg = 410.0
    session = RouteSession(route, [_stop(route, 0, collected=True)])

    out = complete_route(
        route.id, RouteCompleteIn(actual_fuel_l=9, actual_weight_kg=999), _claims(), session
    )

    assert out.status is RouteStatus.DONE
    assert route.actual_weight_kg == 410.0
    assert session.commits == 0


def test_complete_by_another_user_conflicts() -> None:
    route = _route(RouteStatus.DONE)

    with pytest.raises(HTTPException) as exc:
        complete_route(
            route.id,
            RouteCompleteIn(actual_fuel_l=1, actual_weight_kg=1),
            _claims(uuid.uuid4()),
            RouteSession(route, []),
        )

    assert exc.value.status_code == 409


@pytest.mark.parametrize("status", [RouteStatus.ACTIVE, RouteStatus.DONE])
def test_replayed_start_by_the_same_user_is_a_no_op(status: RouteStatus) -> None:
    route = _route(status)
    first = route.started_at
    session = RouteSession(route, [])

    out = start_route(route.id, _claims(), session, RouteActionIn(occurred_at=datetime.now(UTC)))

    assert out.started_by_me is True
    assert route.status is status
    assert route.started_at == first
    assert session.commits == 0


@pytest.mark.parametrize("status", [RouteStatus.ACTIVE, RouteStatus.DONE])
def test_start_by_another_user_still_conflicts(status: RouteStatus) -> None:
    route = _route(status, started_by=uuid.uuid4())

    with pytest.raises(HTTPException) as exc:
        start_route(route.id, _claims(), RouteSession(route, []), None)

    assert exc.value.status_code == 409


def test_start_clamps_client_time_to_the_route_day() -> None:
    route = _route(RouteStatus.PLANNED)
    stale = datetime.combine(route.date, time.min, tzinfo=UTC) - timedelta(days=2)

    start_route(route.id, _claims(), RouteSession(route, []), RouteActionIn(occurred_at=stale))

    assert route.status is RouteStatus.ACTIVE
    assert route.started_at == datetime.combine(route.date, time.min, tzinfo=UTC)
    assert route.started_by_user_id == DRIVER


def test_start_clamps_future_client_time_to_now() -> None:
    route = _route(RouteStatus.PLANNED)
    future = datetime.now(UTC) + timedelta(hours=3)

    start_route(route.id, _claims(), RouteSession(route, []), RouteActionIn(occurred_at=future))

    assert route.started_at <= datetime.now(UTC)


def test_naive_client_time_is_read_as_utc() -> None:
    route = _route()
    stop = _stop(route, 0)
    at = datetime.now(UTC) - timedelta(minutes=20)

    skip_stop(
        stop.id,
        _claims(),
        RouteSession(route, [stop]),
        StopSkipIn(occurred_at=at.replace(tzinfo=None)),
    )

    assert stop.skipped_at == at


def _off_vehicle(route: SimpleNamespace, stops: list[SimpleNamespace]) -> RouteSession:
    return RouteSession(route, stops, vehicle_id=uuid.uuid4())


def _assert_other_vehicle(exc: pytest.ExceptionInfo[HTTPException]) -> None:
    assert exc.value.status_code == 403
    assert exc.value.detail == "route belongs to another vehicle"


@pytest.mark.parametrize("status", list(RouteStatus))
def test_collector_cannot_start_another_vehicles_route(status: RouteStatus) -> None:
    route = _route(status)
    session = _off_vehicle(route, [])

    with pytest.raises(HTTPException) as exc:
        start_route(route.id, _claims(), session, None)

    _assert_other_vehicle(exc)
    assert route.status is status
    assert session.commits == 0


def test_unassigned_collector_cannot_start_a_route() -> None:
    route = _route(RouteStatus.PLANNED)
    session = RouteSession(route, [])
    session.vehicle_id = None

    with pytest.raises(HTTPException) as exc:
        start_route(route.id, _claims(), session, None)

    _assert_other_vehicle(exc)


def test_collector_cannot_complete_another_vehicles_route() -> None:
    route = _route()
    session = _off_vehicle(route, [_stop(route, 0, collected=True)])

    with pytest.raises(HTTPException) as exc:
        complete_route(
            route.id, RouteCompleteIn(actual_fuel_l=1, actual_weight_kg=1), _claims(), session
        )

    _assert_other_vehicle(exc)
    assert route.status is RouteStatus.ACTIVE


@pytest.mark.parametrize("collected", [False, True])
def test_collector_cannot_collect_on_another_vehicles_route(collected: bool) -> None:
    route = _route()
    stop = _stop(route, 0, collected=collected)
    session = _off_vehicle(route, [stop])

    with pytest.raises(HTTPException) as exc:
        collect_stop(stop.id, _claims(), session, None)

    _assert_other_vehicle(exc)
    assert session.added == []


def test_vehicle_check_runs_before_the_started_by_rule() -> None:
    route = _route(started_by=uuid.uuid4())
    stop = _stop(route, 0)

    with pytest.raises(HTTPException) as exc:
        skip_stop(stop.id, _claims(), _off_vehicle(route, [stop]), None)

    _assert_other_vehicle(exc)
    assert stop.skipped_at is None


def test_crewmate_who_did_not_start_the_route_keeps_the_device_rule() -> None:
    route = _route(started_by=uuid.uuid4())
    stop = _stop(route, 0)

    with pytest.raises(HTTPException) as exc:
        collect_stop(stop.id, _claims(), RouteSession(route, [stop]), None)

    assert exc.value.detail == "route is active on another device"


def test_coordinator_acts_on_any_vehicles_route() -> None:
    route = _route(RouteStatus.PLANNED)
    coordinator = _claims(uuid.uuid4(), UserRole.COORDINATOR)

    out = start_route(route.id, coordinator, _off_vehicle(route, []), None)

    assert out.status is RouteStatus.ACTIVE
    assert route.started_by_user_id == coordinator.user_id


def test_replan_treats_skipped_stops_as_resolved() -> None:
    route = _route(RouteStatus.PLANNED)
    session = RouteSession(route, [_stop(route, 0, collected=True), _stop(route, 1, skipped=True)])
    claims = TokenClaims(uuid.uuid4(), ORG, UserRole.ADMIN, 0)

    assert replan_routes(ReplanIn(), claims, session) == []
    assert route.deleted_at is None
    assert session.commits == 0
