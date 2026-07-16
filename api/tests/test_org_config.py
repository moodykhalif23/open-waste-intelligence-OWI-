from owi_api.org_config import override


def test_org_value_wins() -> None:
    assert override(0.25, 0.1) == 0.25
    assert override(0.0, 5.0) == 0.0


def test_none_falls_back_to_default() -> None:
    assert override(None, 0.1) == 0.1
