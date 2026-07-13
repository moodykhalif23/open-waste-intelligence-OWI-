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
    labels: list[str] | None = None,
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
            "labels": labels or [],
            "git_commit": git_commit,
            "dataset_hash": dataset_hash,
            "activate": activate,
        },
        timeout=30,
    )
    response.raise_for_status()
    return dict(response.json())


def upload_artifact(api_url: str, token: str, model_id: str, onnx: Path) -> None:
    with onnx.open("rb") as fh:
        response = httpx.put(
            f"{api_url.rstrip('/')}/api/v1/models/{model_id}/artifact",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": (onnx.name, fh, "application/octet-stream")},
            timeout=120,
        )
    response.raise_for_status()


def main() -> None:
    parser = argparse.ArgumentParser(description="Publish a trained model to the API registry")
    parser.add_argument("--api", required=True)
    parser.add_argument("--token", required=True)
    parser.add_argument("--task", required=True)
    parser.add_argument("--version", required=True)
    parser.add_argument("--onnx", type=Path, help="ONNX artifact to upload")
    parser.add_argument("--labels", type=Path, help="labels.json (class order)")
    parser.add_argument("--metrics", type=Path, help="metrics.json from training")
    parser.add_argument("--no-activate", action="store_true")
    args = parser.parse_args()

    metrics = json.loads(args.metrics.read_text()) if args.metrics else {}
    labels = json.loads(args.labels.read_text()) if args.labels else []
    artifact_hash = None
    if args.onnx and args.onnx.exists():
        artifact_hash = hashlib.sha256(args.onnx.read_bytes()).hexdigest()
    result = register_model(
        args.api,
        args.token,
        args.task,
        args.version,
        {k: float(v) for k, v in metrics.items() if isinstance(v, int | float)},
        labels=labels,
        dataset_hash=artifact_hash,
        activate=not args.no_activate,
    )
    model_id = str(result["id"])
    if args.onnx and args.onnx.exists():
        upload_artifact(args.api, args.token, model_id, args.onnx)
        print(f"uploaded artifact {args.onnx.name}")
    print(f"registered model {model_id} (active={result['active']})")


if __name__ == "__main__":
    main()
