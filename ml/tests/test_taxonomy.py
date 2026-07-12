from owi_ml.labeling.taxonomy import CLASSES, label_config

TOP_LEVEL = {"plastic", "glass", "metal", "paper", "organic", "e_waste", "textile", "other_mixed"}


def test_taxonomy_matches_prd_classes() -> None:
    assert {name for name, _ in CLASSES} == TOP_LEVEL


def test_label_config_declares_every_class() -> None:
    config = label_config()
    assert config.startswith("<View>")
    for name, color in CLASSES:
        assert f'value="{name}"' in config
        assert color in config
