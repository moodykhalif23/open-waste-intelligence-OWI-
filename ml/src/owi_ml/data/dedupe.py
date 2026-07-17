"""Cross-source perceptual dedup: python -m owi_ml.data.dedupe --data datasets/merged

Aggregated public sets share images (GD v2 folds in TrashNet-era photos); an exact
dHash match across sources would let a "training" copy leak into the golden split
under a different filename and quietly inflate the gate score.
"""

import argparse
from pathlib import Path

HASH_SIZE = 8


def dhash(path: Path) -> int:
    from PIL import Image

    with Image.open(path) as raw:
        gray = raw.convert("L").resize((HASH_SIZE + 1, HASH_SIZE), Image.Resampling.LANCZOS)
    pixels = list(gray.getdata())
    bits = 0
    for row in range(HASH_SIZE):
        for col in range(HASH_SIZE):
            left = pixels[row * (HASH_SIZE + 1) + col]
            right = pixels[row * (HASH_SIZE + 1) + col + 1]
            bits = (bits << 1) | (left > right)
    return bits


def dedupe_tree(root: Path) -> tuple[int, int]:
    """Keep the first occurrence of each hash (sorted paths → deterministic); returns
    (kept, removed). Unreadable files count as removed."""
    seen: dict[int, Path] = {}
    kept = removed = 0
    for path in sorted(root.rglob("*.jpg")):
        try:
            digest = dhash(path)
        except Exception:
            path.unlink()
            removed += 1
            continue
        if digest in seen:
            path.unlink()
            removed += 1
        else:
            seen[digest] = path
            kept += 1
    return kept, removed


def main() -> None:
    parser = argparse.ArgumentParser(description="Perceptual-dedup a class-folder tree")
    parser.add_argument("--data", type=Path, required=True)
    args = parser.parse_args()
    kept, removed = dedupe_tree(args.data)
    print(f"dedupe: kept {kept}, removed {removed} duplicate/unreadable image(s)")


if __name__ == "__main__":
    main()
