import httpx

from owi_ml.config import Settings


def register_model(
    settings: Settings,
    api_url: str,
    token: str,
    task: str,
    version: str,
    metrics: dict[str, float],
    git_commit: str | None = None,
    dataset_hash: str | None = None,
    activate: bool = True,
) -> dict[str, object]:
    """Publish a trained model to the API registry; activating it makes the worker use it."""
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
