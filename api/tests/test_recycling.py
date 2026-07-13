from owi_api.analytics.recycling import match_partners, value_report


def test_value_splits_tonnage_by_share_and_prices() -> None:
    report = value_report(
        total_kg=1000,
        shares_pct={"plastic": 40.0, "organic": 60.0},
        prices={"plastic": 50.0, "organic": 2.0},
    )
    plastic = next(m for m in report.materials if m.material == "plastic")
    assert plastic.kg == 400.0
    assert plastic.value_kes == 20000.0  # 400 kg x 50
    assert report.total_value_kes == 20000.0 + 1200.0  # organic 600 kg x 2 = 1200
    assert report.materials[0].material == "organic"  # ordered by share desc (60 > 40)


def test_missing_price_contributes_zero_value() -> None:
    report = value_report(100, {"e_waste": 100.0}, {})
    assert report.materials[0].kes_per_kg is None
    assert report.materials[0].value_kes == 0.0
    assert report.total_value_kes == 0.0


def test_partner_matching_respects_material_and_minimum() -> None:
    partners = [
        ("PET Buyer", ["plastic"], 500.0),
        ("Glass Co", ["glass"], 100.0),
        ("Big Plastics", ["plastic"], 2000.0),
    ]
    assert match_partners("plastic", 800, partners) == ["PET Buyer"]
    assert match_partners("plastic", 2500, partners) == ["PET Buyer", "Big Plastics"]
    assert match_partners("glass", 50, partners) == []
