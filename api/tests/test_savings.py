from owi_api.analytics.savings import Scenario, compute_savings


def test_need_driven_beats_full_sweep_on_km_per_tonne() -> None:
    # Full sweep: 100 km for 2 t (much of it near-empty) → 50 km/t.
    # Need-driven: 40 km for 1.5 t (only full bins) → ~26.7 km/t.
    report = compute_savings(
        Scenario(km=100, kg=2000, fuel_l=25),
        Scenario(km=40, kg=1500, fuel_l=10),
    )
    assert report.baseline_km_per_tonne == 50.0
    assert report.optimized_km_per_tonne == 26.67
    assert report.km_per_tonne_reduction_pct == 46.7
    assert report.fuel_l_saved == 15.0
    assert report.kes_saved is None


def test_kes_saved_when_price_supplied() -> None:
    report = compute_savings(
        Scenario(km=100, kg=2000, fuel_l=25),
        Scenario(km=40, kg=1500, fuel_l=10),
        fuel_price_kes_per_l=200,
    )
    assert report.kes_saved == 3000.0


def test_zero_tonnes_yields_no_ratio() -> None:
    report = compute_savings(Scenario(0, 0, 0), Scenario(0, 0, 0))
    assert report.baseline_km_per_tonne is None
    assert report.km_per_tonne_reduction_pct is None
