"""Pull licensed public training data into OWI class folders:

    python -m owi_ml.data.download

Manifest-driven: every source declares its verified license and a `shippable` flag —
the enforcement point for ml/DATA_LICENSES.md. Non-shippable sources never reach the
training tree. Fetchers write <out>/<owi_class>/<source>_<n>.jpg (source prefix keeps
filenames collision-free and the hash-based split stable), then the tree is deduped.
"""

import io
import json
import sys
import time
import urllib.error
import urllib.request
import zipfile
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

from owi_ml.data.dedupe import dedupe_tree
from owi_ml.data.taxonomy_map import map_category

OUT_DIR = Path("datasets/merged")
MAX_ATTEMPTS = 5

TRASHNET_ZIP = "https://github.com/garythung/trashnet/raw/master/data/dataset-resized.zip"
GDV2_KAGGLE = "sumn2u/garbage-classification-v2"


@dataclass(frozen=True)
class Source:
    key: str
    license: str
    shippable: bool
    fetch: Callable[[Path, str], dict[str, int]]


def _download(url: str) -> bytes:
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            with urllib.request.urlopen(url, timeout=180) as response:
                return bytes(response.read())
        except (urllib.error.URLError, TimeoutError) as exc:
            if attempt == MAX_ATTEMPTS:
                raise
            wait = 2**attempt
            print(f"  attempt {attempt} failed ({exc}); retrying in {wait}s")
            time.sleep(wait)
    raise RuntimeError("unreachable")


def _save(out: Path, owi: str, key: str, counts: dict[str, int], data: bytes) -> None:
    folder = out / owi
    folder.mkdir(parents=True, exist_ok=True)
    (folder / f"{key}_{owi}_{counts.get(owi, 0)}.jpg").write_bytes(data)
    counts[owi] = counts.get(owi, 0) + 1


def fetch_trashnet(out: Path, key: str) -> dict[str, int]:
    archive = zipfile.ZipFile(io.BytesIO(_download(TRASHNET_ZIP)))
    counts: dict[str, int] = {}
    for member in sorted(archive.namelist()):
        if not member.lower().endswith((".jpg", ".jpeg", ".png")):
            continue
        parts = member.lower().split("/")
        source_class = next((p for p in parts if map_category(p) != "other_mixed"), None)
        owi = map_category(source_class) if source_class else "other_mixed"
        if "trash" in parts:  # TrashNet's mixed class folds honestly to other_mixed
            owi = "other_mixed"
        elif source_class is None:
            continue
        _save(out, owi, key, counts, archive.read(member))
    return counts


def fetch_gdv2(out: Path, key: str) -> dict[str, int]:
    import kagglehub

    root = Path(kagglehub.dataset_download(GDV2_KAGGLE))
    counts: dict[str, int] = {}
    for path in sorted(root.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in (".jpg", ".jpeg", ".png"):
            continue
        owi = map_category(path.parent.name)
        _save(out, owi, key, counts, path.read_bytes())
    return counts


SOURCES = [
    Source("trashnet", "MIT", True, fetch_trashnet),
    Source("gdv2", "CC BY 4.0", True, fetch_gdv2),
]


def main() -> None:
    totals: dict[str, int] = {}
    manifest: dict[str, str] = {}
    for source in SOURCES:
        if not source.shippable:
            print(f"skipping {source.key}: {source.license} is not shippable (eval-only)")
            continue
        print(f"fetching {source.key} ({source.license}) ...")
        counts = source.fetch(OUT_DIR, source.key)
        manifest[source.key] = source.license
        print(f"  {source.key}: {sum(counts.values())} images {counts}")
        for owi, n in counts.items():
            totals[owi] = totals.get(owi, 0) + n

    kept, removed = dedupe_tree(OUT_DIR)
    (OUT_DIR / "SOURCES.json").write_text(json.dumps(manifest, indent=2))
    print(f"dedupe: kept {kept}, removed {removed}")
    print(f"merged corpus at {OUT_DIR}: {totals}")
    if kept == 0:
        sys.exit("no images downloaded")


if __name__ == "__main__":
    main()
