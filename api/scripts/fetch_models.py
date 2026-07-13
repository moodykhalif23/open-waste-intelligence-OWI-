"""Download pinned model weights: python scripts/fetch_models.py"""

import hashlib
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

MODELS = {
    "var/models/yolox_tiny.onnx": (
        "https://github.com/Megvii-BaseDetection/YOLOX/releases/download/0.1.1rc0/yolox_tiny.onnx",
        "427cc366d34e27ff7a03e2899b5e3671425c262ea2291f88bb942bc1cc70b0f7",
    ),
}

MAX_ATTEMPTS = 5


def _download(url: str) -> bytes:
    # Builds run on flaky networks; a single transient failure must not break the image.
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            with urllib.request.urlopen(url, timeout=60) as response:
                return bytes(response.read())
        except (urllib.error.URLError, TimeoutError) as exc:
            if attempt == MAX_ATTEMPTS:
                raise
            wait = 2**attempt
            print(f"  attempt {attempt} failed ({exc}); retrying in {wait}s")
            time.sleep(wait)
    raise RuntimeError("unreachable")


def main() -> None:
    for path_str, (url, expected_sha) in MODELS.items():
        path = Path(path_str)
        if path.exists() and hashlib.sha256(path.read_bytes()).hexdigest() == expected_sha:
            print(f"ok       {path}")
            continue
        print(f"fetching {path} ...")
        path.parent.mkdir(parents=True, exist_ok=True)
        data = _download(url)
        actual_sha = hashlib.sha256(data).hexdigest()
        if actual_sha != expected_sha:
            sys.exit(f"CHECKSUM MISMATCH for {url}: got {actual_sha}")
        path.write_bytes(data)
        print(f"done     {path}")


if __name__ == "__main__":
    main()
