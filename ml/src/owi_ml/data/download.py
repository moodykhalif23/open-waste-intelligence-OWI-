"""Pull public training data (TrashNet, resized) into OWI class folders:

    python -m owi_ml.data.download

Public data pretrains generic material appearance; the local Safi export fine-tunes.
TrashNet has no organic/e-waste/textile classes — those come from local data later.
"""

import io
import sys
import time
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

ZIP_URL = "https://github.com/garythung/trashnet/raw/master/data/dataset-resized.zip"
TRASHNET_TO_OWI = {
    "cardboard": "paper",
    "glass": "glass",
    "metal": "metal",
    "paper": "paper",
    "plastic": "plastic",
    "trash": "other_mixed",
}
OUT_DIR = Path("datasets/trashnet")
MAX_ATTEMPTS = 5


def _download(url: str) -> bytes:
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            with urllib.request.urlopen(url, timeout=120) as response:
                return bytes(response.read())
        except (urllib.error.URLError, TimeoutError) as exc:
            if attempt == MAX_ATTEMPTS:
                raise
            wait = 2**attempt
            print(f"  attempt {attempt} failed ({exc}); retrying in {wait}s")
            time.sleep(wait)
    raise RuntimeError("unreachable")


def main() -> None:
    print("fetching TrashNet (resized) ...")
    archive = zipfile.ZipFile(io.BytesIO(_download(ZIP_URL)))
    counts: dict[str, int] = {}
    for member in archive.namelist():
        parts = member.lower().split("/")
        if not member.lower().endswith((".jpg", ".jpeg", ".png")):
            continue
        source_class = next((p for p in parts if p in TRASHNET_TO_OWI), None)
        if source_class is None:
            continue
        owi = TRASHNET_TO_OWI[source_class]
        folder = OUT_DIR / owi
        folder.mkdir(parents=True, exist_ok=True)
        (folder / f"{owi}_{counts.get(owi, 0)}.jpg").write_bytes(archive.read(member))
        counts[owi] = counts.get(owi, 0) + 1

    total = sum(counts.values())
    print(f"saved {total} images to {OUT_DIR}: {counts}")
    if total == 0:
        sys.exit("no images extracted")


if __name__ == "__main__":
    main()
