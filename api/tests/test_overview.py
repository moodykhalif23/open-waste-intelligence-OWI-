import uuid
from collections.abc import Iterator
from datetime import UTC, date, datetime, timedelta
from typing import Any

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.dialects import postgresql

from owi_api.analytics.overview import LOCAL_TZ, fill_mix, heatmap, per_day, window
from owi_api.db import get_session
from owi_api.models.enums import FillBand, UserRole
from owi_api.routers import analytics
from owi_api.routers.auth import get_current_user
from owi_api.security import TokenClaims


def test_window_is_local_calendar_days_ending_now() -> None:
    now = datetime(2026, 10, 27, 22, 30, tzinfo=UTC)
    span = window(now, 7)
    assert span.first_day == date(2026, 10, 22)
    assert span.start == datetime(2026, 10, 22, tzinfo=LOCAL_TZ)
    assert span.start.astimezone(UTC) == datetime(2026, 10, 21, 21, 0, tzinfo=UTC)
    assert span.prev_start == span.start - timedelta(days=7)
    assert span.end == now


def test_per_day_zero_fills_oldest_first() -> None:
    first = date(2026, 10, 22)
    days = per_day(first, 3, {date(2026, 10, 23): (5, 2)})
    assert [(d.date, d.reports, d.overflowing) for d in days] == [
        (date(2026, 10, 22), 0, 0),
        (date(2026, 10, 23), 5, 2),
        (date(2026, 10, 24), 0, 0),
    ]


def test_heatmap_rows_are_iso_weekdays_and_columns_hours() -> None:
    grid = heatmap([(1, 8, 4), (7, 23, 2), (1, 8, 1)])
    assert len(grid) == 7 and all(len(row) == 24 for row in grid)
    assert grid[0][8] == 5
    assert grid[6][23] == 2
    assert sum(map(sum, grid)) == 7


def test_fill_mix_lists_every_band_and_ignores_untapped() -> None:
    mix = fill_mix({FillBand.HIGH: 3, None: 9})
    assert mix == {"empty": 0, "low": 0, "half": 0, "high": 3, "overflowing": 0}


class _Result:
    def __init__(self, rows: list[Any]) -> None:
        self.rows = rows

    def __iter__(self) -> Iterator[Any]:
        return iter(self.rows)

    def one(self) -> Any:
        return self.rows[0]

    def all(self) -> list[Any]:
        return self.rows


class ScriptedSession:
    def __init__(self, results: list[list[Any]]) -> None:
        self.results = iter(results)
        self.sql: list[str] = []

    def scalar(self, statement: Any) -> int:
        self.sql.append(str(statement.compile(dialect=postgresql.dialect())))
        return 1502

    def execute(self, statement: Any) -> _Result:
        self.sql.append(str(statement.compile(dialect=postgresql.dialect())))
        return _Result(next(self.results))


def client_for(session: ScriptedSession, role: UserRole) -> TestClient:
    app = FastAPI()
    app.include_router(analytics.router)
    app.dependency_overrides[get_session] = lambda: session
    app.dependency_overrides[get_current_user] = lambda: TokenClaims(
        uuid.uuid4(), uuid.uuid4(), role, 0
    )
    return TestClient(app)


def test_overview_assembles_sql_aggregates() -> None:
    today = datetime.now(UTC).astimezone(LOCAL_TZ).date()
    report_id = uuid.uuid4()
    captured = datetime.now(UTC)
    session = ScriptedSession(
        [
            [(40, 31, 12, 6)],
            [(today, 40, 6)],
            [(FillBand.OVERFLOWING, 6), (FillBand.LOW, 30), (None, 4)],
            [(3, 9, 40)],
            [(report_id, captured, "QR1", "Kiamaiko Market", FillBand.OVERFLOWING)],
        ]
    )
    response = client_for(session, UserRole.VIEWER).get(
        "/api/v1/analytics/overview", params={"days": 3}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["window_days"] == 3
    assert (body["bins_registered"], body["bins_reported"]) == (1502, 12)
    assert (body["reports"], body["reports_prev"], body["overflowing"]) == (40, 31, 6)
    assert [d["reports"] for d in body["per_day"]] == [0, 0, 40]
    assert body["per_day"][-1]["date"] == today.isoformat()
    assert body["fill_mix"] == {"empty": 0, "low": 30, "half": 0, "high": 0, "overflowing": 6}
    assert body["heatmap"][2][9] == 40
    assert body["latest"][0]["site_name"] == "Kiamaiko Market"
    assert any("Africa/Nairobi" in sql and "isodow" in sql for sql in session.sql)


def test_overview_is_staff_only_and_bounds_days() -> None:
    assert (
        client_for(ScriptedSession([]), UserRole.COLLECTOR)
        .get("/api/v1/analytics/overview")
        .status_code
        == 403
    )
    assert (
        client_for(ScriptedSession([]), UserRole.ADMIN)
        .get("/api/v1/analytics/overview", params={"days": 366})
        .status_code
        == 422
    )
