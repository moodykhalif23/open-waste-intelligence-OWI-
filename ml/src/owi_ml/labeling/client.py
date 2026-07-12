from typing import Any

import httpx

from owi_ml.config import Settings


class LabelStudio:
    """Thin client for the few Label Studio endpoints the pipeline needs."""

    def __init__(self, settings: Settings) -> None:
        if not settings.label_studio_user_token:
            raise RuntimeError("LABEL_STUDIO_USER_TOKEN missing — set it in the repo-root .env")
        self._client = httpx.Client(
            base_url=settings.label_studio_url,
            headers={"Authorization": f"Token {settings.label_studio_user_token}"},
            timeout=120,
        )

    def find_project(self, title: str) -> dict[str, Any] | None:
        response = self._client.get("/api/projects", params={"title": title})
        response.raise_for_status()
        results: list[dict[str, Any]] = response.json()["results"]
        return next((p for p in results if p["title"] == title), None)

    def create_project(self, title: str, label_config: str) -> dict[str, Any]:
        response = self._client.post(
            "/api/projects", json={"title": title, "label_config": label_config}
        )
        response.raise_for_status()
        return dict(response.json())

    def list_s3_storages(self, project_id: int) -> list[dict[str, Any]]:
        response = self._client.get("/api/storages/s3", params={"project": project_id})
        response.raise_for_status()
        return list(response.json())

    def create_s3_storage(self, payload: dict[str, Any]) -> dict[str, Any]:
        response = self._client.post("/api/storages/s3", json=payload)
        response.raise_for_status()
        return dict(response.json())

    def sync_s3_storage(self, storage_id: int) -> dict[str, Any]:
        response = self._client.post(f"/api/storages/s3/{storage_id}/sync")
        response.raise_for_status()
        return dict(response.json())

    def task_count(self, project_id: int) -> int:
        response = self._client.get(f"/api/projects/{project_id}")
        response.raise_for_status()
        return int(response.json()["task_number"])

    def export_coco(self, project_id: int) -> bytes:
        response = self._client.get(
            f"/api/projects/{project_id}/export",
            params={"exportType": "COCO", "download_all_tasks": "false"},
        )
        response.raise_for_status()
        return response.content
