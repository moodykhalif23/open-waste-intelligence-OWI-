"""Materialize reviewed ground truth into training folders:

    python -m owi_ml.data.export_reviewed --api URL --token JWT --out datasets/safi

Downloads each labeled observation's (blurred) image via the staff image endpoint into
<out>/<label>/safi_<observation_id>.jpg — the layout the trainer consumes, so
`--data datasets/merged datasets/safi` fine-tunes on public + local ground truth and
`--data datasets/safi` alone re-freezes a local golden set (Gate B). Idempotent:
existing files are skipped, so a weekly run only pulls new reviews.
"""

import argparse
from pathlib import Path

import httpx


def export_reviewed(api_url: str, token: str, out: Path, task: str = "classify") -> tuple[int, int]:
    """Returns (downloaded, skipped). Skips existing files and retention-purged images."""
    client = httpx.Client(
        base_url=api_url.rstrip("/"),
        headers={"Authorization": f"Bearer {token}"},
        timeout=60,
    )
    response = client.get("/api/v1/predictions/export", params={"task": task})
    response.raise_for_status()
    rows: list[dict[str, str]] = response.json()

    downloaded = skipped = 0
    for row in rows:
        target = out / row["label"] / f"safi_{row['observation_id']}.jpg"
        if target.exists():
            skipped += 1
            continue
        image = client.get(f"/api/v1/observations/{row['observation_id']}/image")
        if image.status_code in (404, 410):  # erased or retention-purged since review
            skipped += 1
            continue
        image.raise_for_status()
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(image.content)
        downloaded += 1
    return downloaded, skipped


def main() -> None:
    parser = argparse.ArgumentParser(description="Export reviewed ground truth for retraining")
    parser.add_argument("--api", required=True)
    parser.add_argument("--token", required=True, help="admin JWT")
    parser.add_argument("--out", type=Path, default=Path("datasets/safi"))
    parser.add_argument("--task", default="classify", choices=["classify", "fill"])
    args = parser.parse_args()
    downloaded, skipped = export_reviewed(args.api, args.token, args.out, args.task)
    print(f"exported {downloaded} new labeled image(s) to {args.out} ({skipped} already present)")


if __name__ == "__main__":
    main()
