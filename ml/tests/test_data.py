import json
from pathlib import Path

from owi_ml.data.coco import CocoDataset, LabeledImage, load_coco, merge
from owi_ml.data.split import split_dataset
from owi_ml.data.taxonomy_map import OWI_CLASSES, map_category


def test_taxonomy_maps_known_and_unknown() -> None:
    assert map_category("PET bottle") == "plastic"
    assert map_category("Aluminium can") == "metal"
    assert map_category("Cardboard") == "paper"
    assert map_category("something weird") == "other_mixed"
    assert set(map_category(n) for n in ["bottle", "can", "paper"]) <= set(OWI_CLASSES)


def test_load_coco_maps_categories(tmp_path: Path) -> None:
    doc = {
        "images": [{"id": 1, "file_name": "a.jpg"}, {"id": 2, "file_name": "b.jpg"}],
        "categories": [{"id": 10, "name": "PET bottle"}, {"id": 11, "name": "Glass bottle"}],
        "annotations": [
            {"image_id": 1, "category_id": 10},
            {"image_id": 1, "category_id": 11},
            {"image_id": 2, "category_id": 10},
        ],
    }
    path = tmp_path / "result.json"
    path.write_text(json.dumps(doc))
    ds = load_coco(path)
    assert ds.class_counts() == {"plastic": 2, "glass": 1}
    a = next(i for i in ds.images if i.file_name == "a.jpg")
    assert a.owi_labels == ["glass", "plastic"]


def test_merge_local_wins() -> None:
    public = CocoDataset([LabeledImage("shared.jpg", ["other_mixed"])])
    local = CocoDataset([LabeledImage("shared.jpg", ["plastic"])])
    merged = merge(public, local)
    assert len(merged.images) == 1
    assert merged.images[0].owi_labels == ["plastic"]


def test_split_is_deterministic_and_disjoint() -> None:
    ds = CocoDataset([LabeledImage(f"img_{i}.jpg", ["plastic"]) for i in range(400)])
    a = split_dataset(ds)
    b = split_dataset(ds)
    assert [i.file_name for i in a.golden] == [i.file_name for i in b.golden]

    names = lambda xs: {i.file_name for i in xs}  # noqa: E731
    assert not (names(a.train) & names(a.golden))
    assert not (names(a.train) & names(a.val))
    assert not (names(a.val) & names(a.golden))
    assert len(a.train) + len(a.val) + len(a.golden) == 400
    assert 0 < len(a.golden) < len(a.train)
