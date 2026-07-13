from owi_api.analytics.cleanliness import MIN_OBSERVATIONS, cleanliness_index


def test_insufficient_observations_no_score() -> None:
    result = cleanliness_index({"overflow": 90.0}, observations=MIN_OBSERVATIONS - 1)
    assert result.score is None and result.sufficient is False


def test_weighted_renormalized_over_present_components() -> None:
    # overflow 90 (w .30), dumping 60 (w .20), reliability 100 (w .15) → weights renormalize to .65.
    result = cleanliness_index(
        {"overflow": 90.0, "dumping": 60.0, "reliability": 100.0}, observations=50
    )
    expected = (90 * 0.30 + 60 * 0.20 + 100 * 0.15) / 0.65
    assert result.score == round(expected, 1)
    assert result.sufficient is True
    assert {c.name for c in result.components} == {"overflow", "dumping", "reliability"}


def test_single_component_scores_itself() -> None:
    result = cleanliness_index({"overflow": 80.0}, observations=20)
    assert result.score == 80.0  # renormalized to weight 1.0


def test_unknown_component_ignored() -> None:
    result = cleanliness_index({"overflow": 80.0, "bogus": 10.0}, observations=20)
    assert {c.name for c in result.components} == {"overflow"}
    assert result.score == 80.0
