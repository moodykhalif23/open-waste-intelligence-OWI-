from owi_api.analytics.carbon import (
    METHOD_VERSION,
    UNCERTAINTY,
    carbon_report,
    load_factors,
)

FACTORS = {"plastic": 1.5, "glass": 0.3, "organic": 0.25, "other_mixed": 0.0}


def test_factor_table_loads_with_all_classes() -> None:
    factors = load_factors()
    for m in ["plastic", "glass", "metal", "paper", "organic", "e_waste", "textile", "other_mixed"]:
        assert m in factors


def test_co2e_is_weight_times_factor() -> None:
    report = carbon_report({"plastic": 100.0, "glass": 200.0}, FACTORS)
    assert report.co2e_avoided_kg == 100 * 1.5 + 200 * 0.3  # 150 + 60 = 210
    assert report.method_version == METHOD_VERSION


def test_uncertainty_band_brackets_estimate() -> None:
    report = carbon_report({"plastic": 100.0}, FACTORS)
    assert report.co2e_low_kg == round(150 * (1 - UNCERTAINTY), 1)
    assert report.co2e_high_kg == round(150 * (1 + UNCERTAINTY), 1)
    assert report.co2e_low_kg < report.co2e_avoided_kg < report.co2e_high_kg


def test_unpriced_material_adds_zero() -> None:
    report = carbon_report({"other_mixed": 500.0}, FACTORS)
    assert report.co2e_avoided_kg == 0.0


def test_secondary_outputs() -> None:
    report = carbon_report({"plastic": 100.0}, FACTORS)
    assert report.plastic_diverted_kg == 100.0
    assert report.trees_equivalent > 0
    assert report.car_km_equivalent > 0
    assert report.landfill_m3_saved > 0
