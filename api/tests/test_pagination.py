import uuid
from collections.abc import Iterator
from datetime import UTC, date, datetime, timedelta
from types import SimpleNamespace
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.dialects import postgresql

from owi_api.db import get_session
from owi_api.models.enums import OverflowRisk, ReviewStatus, UserRole
from owi_api.routers import dumping, observations, operations, review
from owi_api.routers.analytics import _materials
from owi_api.routers.auth import get_current_user
from owi_api.routers.observations import _observation_ids_for_material
from owi_api.security import TokenClaims

ORG = uuid.uuid4()


class _Result:
    def __init__(self, rows: list[Any]) -> None:
        self.rows = rows

    def __iter__(self) -> Iterator[Any]:
        return iter(self.rows)

    def all(self) -> list[Any]:
        return self.rows


class RecordingSession:
    def __init__(self, rows: list[Any] | None = None) -> None:
        self.rows = rows or []
        self.statements: list[Any] = []

    def execute(self, statement: Any) -> _Result:
        self.statements.append(statement)
        return _Result(self.rows)

    def scalars(self, statement: Any) -> _Result:
        self.statements.append(statement)
        return _Result(self.rows)

    def scalar(self, statement: Any) -> int:
        return 0


def client_for(
    router: Any, session: RecordingSession, role: UserRole = UserRole.ADMIN
) -> TestClient:
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_session] = lambda: session
    app.dependency_overrides[get_current_user] = lambda: TokenClaims(uuid.uuid4(), ORG, role, 0)
    return TestClient(app)


def compiled(statement: Any) -> tuple[str, set[object]]:
    sql = statement.compile(dialect=postgresql.dialect())
    return str(sql), set(sql.params.values())


def test_observations_page_with_offset() -> None:
    session = RecordingSession()
    response = client_for(observations.router, session).get(
        "/api/v1/observations", params={"limit": 37, "offset": 74}
    )
    assert response.status_code == 200
    sql, params = compiled(session.statements[-1])
    assert "LIMIT" in sql and "OFFSET" in sql
    assert {37, 74} <= params


@pytest.mark.parametrize("query", [{"offset": -1}, {"limit": 1001}])
def test_observations_reject_out_of_range_paging(query: dict[str, int]) -> None:
    response = client_for(observations.router, RecordingSession()).get(
        "/api/v1/observations", params=query
    )
    assert response.status_code == 422


def test_review_queue_is_bounded_and_pages() -> None:
    session = RecordingSession()
    client = client_for(review.router, session)
    assert client.get("/api/v1/predictions", params={"limit": 501}).status_code == 422
    response = client.get("/api/v1/predictions", params={"limit": 23, "offset": 46})
    assert response.status_code == 200
    _sql, params = compiled(session.statements[-1])
    assert {23, 46} <= params


def test_dumping_candidates_are_bounded_and_page() -> None:
    session = RecordingSession()
    client = client_for(dumping.router, session)
    assert client.get("/api/v1/dumping/candidates", params={"limit": 0}).status_code == 422
    response = client.get("/api/v1/dumping/candidates", params={"limit": 19, "offset": 57})
    assert response.status_code == 200
    _sql, params = compiled(session.statements[-1])
    assert {19, 57} <= params


def _health_row(risk: OverflowRisk, fill: float) -> SimpleNamespace:
    return SimpleNamespace(
        bin_id=uuid.uuid4(),
        qr_code="qr",
        name="Site",
        date=date(2026, 10, 28),
        fill_pct=fill,
        fill_velocity_pct_per_day=None,
        days_to_full=None,
        days_since_collection=None,
        overflow_risk=risk.value,
        recommendation="no_action",
    )


def test_bin_health_pages_after_ranking_by_risk() -> None:
    rows = [
        _health_row(OverflowRisk.LOW, 25),
        _health_row(OverflowRisk.HIGH, 100),
        _health_row(OverflowRisk.MEDIUM, 75),
        _health_row(OverflowRisk.HIGH, 85),
        _health_row(OverflowRisk.LOW, 5),
    ]
    client = client_for(operations.router, RecordingSession(rows))
    everything = client.get("/api/v1/bins/health").json()
    assert [r["fill_pct"] for r in everything] == [100, 85, 75, 25, 5]
    page = client.get("/api/v1/bins/health", params={"limit": 2, "offset": 1}).json()
    assert [r["fill_pct"] for r in page] == [85, 75]
    assert client.get("/api/v1/bins/health", params={"limit": 0}).status_code == 422


def _prediction_rows() -> list[tuple[uuid.UUID, dict[str, object], Any, ReviewStatus]]:
    newest_wins, corrected, overridden = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    return [
        (newest_wins, {"material": "plastic"}, None, ReviewStatus.UNREVIEWED),
        (newest_wins, {"material": "paper"}, None, ReviewStatus.CONFIRMED),
        (corrected, {"material": "glass"}, {"material": "plastic"}, ReviewStatus.CORRECTED),
        (overridden, {"material": "plastic"}, {"material": "glass"}, ReviewStatus.CORRECTED),
    ]


def test_material_drilldown_uses_latest_effective_material() -> None:
    rows = _prediction_rows()
    matching = _observation_ids_for_material(RecordingSession(rows), ORG, "plastic")
    assert matching == [rows[0][0], rows[2][0]]


def test_materials_counts_one_effective_label_per_observation() -> None:
    now = datetime.now(UTC)
    materials = _materials(
        RecordingSession(_prediction_rows()), ORG, now - timedelta(days=7), now, None
    )
    assert materials == ["plastic", "plastic", "glass"]
