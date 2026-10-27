from owi_ml.data.coco import CocoDataset, LabeledImage
from owi_ml.data.split import split_dataset
from owi_ml.data.taxonomy_map import map_category


def test_taxonomy_maps_known_and_unknown() -> None:
    assert map_category("PET bottle") == "plastic"
    assert map_category("Aluminium can") == "metal"
    assert map_category("Cardboard") == "paper"
    assert map_category("something weird") == "other_mixed"


def test_split_is_deterministic_and_disjoint() -> None:
    ds = CocoDataset([LabeledImage(f"img_{i}.jpg", ["plastic"]) for i in range(400)])
    a = split_dataset(ds)
    b = split_dataset(ds)
    assert [i.file_name for i in a.golden] == [i.file_name for i in b.golden]

    def names(xs: list[LabeledImage]) -> set[str]:
        return {i.file_name for i in xs}

    assert not (names(a.train) & names(a.golden))
    assert not (names(a.train) & names(a.val))
    assert not (names(a.val) & names(a.golden))
    assert len(a.train) + len(a.val) + len(a.golden) == 400
    assert 0 < len(a.golden) < len(a.train)
