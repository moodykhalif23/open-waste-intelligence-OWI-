"""Idempotent Label Studio bootstrap: python -m owi_ml.labeling.setup_project"""

from owi_ml.config import settings
from owi_ml.labeling.client import LabelStudio
from owi_ml.labeling.taxonomy import PROJECT_TITLE, label_config


def main() -> None:
    ls = LabelStudio(settings)

    project = ls.find_project(PROJECT_TITLE)
    if project is None:
        project = ls.create_project(PROJECT_TITLE, label_config())
        print(f"created project {project['id']}: {PROJECT_TITLE}")
    else:
        print(f"project {project['id']} exists: {PROJECT_TITLE}")

    storages = ls.list_s3_storages(project["id"])
    if storages:
        storage = storages[0]
        print(f"storage {storage['id']} exists")
    else:
        storage = ls.create_s3_storage(
            {
                "project": project["id"],
                "title": "owi-images (MinIO)",
                "bucket": settings.owi_s3_bucket,
                "prefix": "images/",
                "s3_endpoint": settings.owi_s3_internal_endpoint,
                "aws_access_key_id": settings.owi_s3_access_key,
                "aws_secret_access_key": settings.owi_s3_secret_key,
                "use_blob_urls": True,
                # Label Studio proxies images itself; the browser never needs
                # to reach MinIO directly.
                "presign": False,
                "recursive_scan": True,
            }
        )
        print(f"created storage {storage['id']}")

    ls.sync_s3_storage(storage["id"])
    print(f"synced — project now has {ls.task_count(project['id'])} tasks")


if __name__ == "__main__":
    main()
