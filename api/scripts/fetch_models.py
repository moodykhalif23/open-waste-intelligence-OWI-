"""Download pinned model weights: python scripts/fetch_models.py"""

import hashlib
import sys
import urllib.request
from pathlib import Path

MODELS = {
    "var/models/yolox_tiny.onnx": (
        "https://github.com/Megvii-BaseDetection/YOLOX/releases/download/0.1.1rc0/yolox_tiny.onnx",
        "427cc366d34e27ff7a03e2899b5e3671425c262ea2291f88bb942bc1cc70b0f7",
    ),
}


def main() -> None:
    for path_str, (url, expected_sha) in MODELS.items():
        path = Path(path_str)
        if path.exists() and hashlib.sha256(path.read_bytes()).hexdigest() == expected_sha:
            print(f"ok       {path}")
            continue
        print(f"fetching {path} ...")
        path.parent.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(url) as response:
            data = response.read()
        actual_sha = hashlib.sha256(data).hexdigest()
        if actual_sha != expected_sha:
            sys.exit(f"CHECKSUM MISMATCH for {url}: got {actual_sha}")
        path.write_bytes(data)
        print(f"done     {path}")


if __name__ == "__main__":
    main()
