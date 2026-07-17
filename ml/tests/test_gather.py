from pathlib import Path

from owi_ml.train.classify import _gather


def _make(tree: Path, class_name: str, names: list[str]) -> None:
    folder = tree / class_name
    folder.mkdir(parents=True)
    for name in names:
        (folder / name).write_bytes(b"fake")


def test_gather_merges_multiple_roots(tmp_path: Path) -> None:
    public = tmp_path / "merged"
    local = tmp_path / "safi"
    _make(public, "plastic", ["a.jpg", "b.jpg"])
    _make(local, "plastic", ["safi_1.jpg"])
    _make(local, "organic", ["safi_2.jpg"])

    samples = _gather([public, local])
    labels = sorted(label for _, label in samples)
    assert labels == ["organic", "plastic", "plastic", "plastic"]


def test_gather_single_root(tmp_path: Path) -> None:
    _make(tmp_path / "merged", "glass", ["g.jpg"])
    assert _gather([tmp_path / "merged"]) == [(tmp_path / "merged" / "glass" / "g.jpg", "glass")]
