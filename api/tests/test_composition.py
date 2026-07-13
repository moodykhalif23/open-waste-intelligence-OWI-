from owi_api.analytics.composition import composition


def test_empty_is_insufficient() -> None:
    rows, sufficient = composition([])
    assert rows == [] and sufficient is False


def test_shares_and_ordering() -> None:
    materials = ["plastic"] * 5 + ["organic"] * 3 + ["paper"] * 2
    rows, _ = composition(materials)
    assert rows[0].material == "plastic" and rows[0].share_pct == 50.0
    assert sum(r.share_pct for r in rows) == 100.0
    assert [r.material for r in rows] == ["plastic", "organic", "paper"]


def test_sufficiency_threshold() -> None:
    assert composition(["plastic"] * 19)[1] is False
    assert composition(["plastic"] * 20)[1] is True


def test_delta_vs_previous_window() -> None:
    current = ["plastic"] * 6 + ["glass"] * 4  # plastic 60%
    previous = ["plastic"] * 4 + ["glass"] * 6  # plastic 40%
    rows, _ = composition(current, previous)
    plastic = next(r for r in rows if r.material == "plastic")
    assert plastic.delta_pct == 20.0


def test_no_previous_means_no_delta() -> None:
    rows, _ = composition(["plastic", "glass"])
    assert all(r.delta_pct is None for r in rows)
