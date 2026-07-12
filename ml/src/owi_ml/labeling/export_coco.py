"""Export labeled data as a COCO snapshot: python -m owi_ml.labeling.export_coco"""

from datetime import UTC, datetime
from pathlib import Path

from owi_ml.config import settings
from owi_ml.labeling.client import LabelStudio
from owi_ml.labeling.taxonomy import PROJECT_TITLE

SNAPSHOT_DIR = Path("datasets/snapshots")


def main() -> None:
    ls = LabelStudio(settings)
    project = ls.find_project(PROJECT_TITLE)
    if project is None:
        raise SystemExit(f"project '{PROJECT_TITLE}' not found — run setup_project first")

    data = ls.export_coco(project["id"])
    SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(UTC).strftime("%Y%m%d-%H%M%S")
    path = SNAPSHOT_DIR / f"owi-coco-{stamp}.zip"
    path.write_bytes(data)
    print(f"wrote {path} ({len(data)} bytes)")


if __name__ == "__main__":
    main()
