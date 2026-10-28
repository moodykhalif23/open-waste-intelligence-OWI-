import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.dialects import postgresql

from owi_api.digest import _due_bins, build_digest, digest_window_open


def test_digest_lists_top_bins_and_total() -> None:
    rows = [("Yaya Centre", "abc123", 96.0), ("Kawangware Market", "def456", 88.4)]
    body = build_digest(rows)
    assert "2 bin(s)" in body
    assert "Yaya Centre abc123 96%" in body
    assert "def456 88%" in body


def test_digest_truncates_to_five_lines() -> None:
    rows = [(f"Site {i}", f"qr{i}", 90.0 - i) for i in range(8)]
    body = build_digest(rows)
    assert body.count("\n- ") == 5
    assert "...and 3 more" in body


def test_digest_window_is_morning_only() -> None:
    morning = datetime(2026, 7, 16, 7, 0, tzinfo=UTC).astimezone()
    night = datetime(2026, 7, 16, 22, 0, tzinfo=UTC).astimezone()
    assert digest_window_open(morning.astimezone(UTC)) == (6 <= morning.hour <= 8)
    assert digest_window_open(night.astimezone(UTC)) == (6 <= night.hour <= 8)


def test_due_bins_filters_on_each_bins_latest_recommendation() -> None:
    class CapturingSession:
        statement: Any = None

        def execute(self, statement: Any) -> Any:
            self.statement = statement
            return self

        def all(self) -> list[tuple[str, str, float]]:
            return [("Market", "QR1", 75.0), ("Stage", "QR2", 100.0)]

    session = CapturingSession()
    rows = _due_bins(session, uuid.uuid4())
    assert [qr for _site, qr, _fill in rows] == ["QR2", "QR1"]
    sql = str(session.statement.compile(dialect=postgresql.dialect()))
    latest_per_bin = sql[sql.index("(SELECT DISTINCT ON") : sql.index(") AS")]
    assert "recommendation =" not in latest_per_bin
    assert sql.index("recommendation =") > sql.index(") AS")
