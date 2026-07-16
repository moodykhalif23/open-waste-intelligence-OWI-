from datetime import UTC, datetime

from owi_api.digest import build_digest, digest_window_open


def test_digest_lists_top_bins_and_total() -> None:
    rows = [("Yaya Centre", "abc123", 96.0), ("Kawangware Market", "def456", 88.4)]
    body = build_digest(rows, 2)
    assert "2 bin(s)" in body
    assert "Yaya Centre abc123 96%" in body
    assert "def456 88%" in body


def test_digest_truncates_to_five_lines() -> None:
    rows = [(f"Site {i}", f"qr{i}", 90.0 - i) for i in range(8)]
    body = build_digest(rows, 8)
    assert body.count("\n- ") == 5
    assert "...and 3 more" in body


def test_digest_window_is_morning_only() -> None:
    morning = datetime(2026, 7, 16, 7, 0, tzinfo=UTC).astimezone()
    night = datetime(2026, 7, 16, 22, 0, tzinfo=UTC).astimezone()
    assert digest_window_open(morning.astimezone(UTC)) == (6 <= morning.hour <= 8)
    assert digest_window_open(night.astimezone(UTC)) == (6 <= night.hour <= 8)
