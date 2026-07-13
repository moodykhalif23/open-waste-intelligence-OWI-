"""Publish a trained model to the API registry:

    python -m owi_ml.registry --api URL --token JWT --task classify --version v1 \
        --onnx artifacts/classifier.onnx --metrics artifacts/metrics.json

Activating (default) makes the batch worker use this model. Register is admin-only.
"""

import argparse
import hashlib
import json
from pathlib import Path

import httpx


def register_model(
    api_url: str,
    token: str,
    task: str,
    version: str,
    metrics: dict[str, float],
    git_commit: str | None = None,
    dataset_hash: str | None = None,
    activate: bool = True,
) -> dict[str, object]:
    response = httpx.post(
        f"{api_url.rstrip('/')}/api/v1/models",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "task": task,
            "version": version,
            "metrics": metrics,
            "git_commit": git_commit,
            "dataset_hash": dataset_hash,
            "activate": activate,
        },
        timeout=30,
    )
    response.raise_for_status()
    return dict(response.json())


def main() -> None:
    parser = argparse.ArgumentParser(description="Publish a trained model to the API registry")
    parser.add_argument("--api", required=True)
    parser.add_argument("--token", required=True)
    parser.add_argument("--task", required=True)
    parser.add_argument("--version", required=True)
    parser.add_argument("--onnx", type=Path, help="model artifact (hashed for provenance)")
    parser.add_argument("--metrics", type=Path, help="metrics.json from training")
    parser.add_argument("--no-activate", action="store_true")
    args = parser.parse_args()

    metrics = json.loads(args.metrics.read_text()) if args.metrics else {}
    artifact_hash = None
    if args.onnx and args.onnx.exists():
        artifact_hash = hashlib.sha256(args.onnx.read_bytes()).hexdigest()
    result = register_model(
        args.api,
        args.token,
        args.task,
        args.version,
        {k: float(v) for k, v in metrics.items() if isinstance(v, int | float)},
        dataset_hash=artifact_hash,
        activate=not args.no_activate,
    )
    print(f"registered model {result['id']} (active={result['active']})")


if __name__ == "__main__":
    main()
