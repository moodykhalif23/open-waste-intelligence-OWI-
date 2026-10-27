"""Bootstrap the single-node Garage object store: python scripts/garage_init.py

Idempotent, runs on every `up` next to the migrations: assigns the node a layout
role, creates the image bucket and imports the API's S3 key from .env.
"""

import os
import re
import sys
import time

import httpx

ADMIN_URL = os.environ.get("GARAGE_ADMIN_URL", "http://garage:3903")
ADMIN_TOKEN = os.environ.get("GARAGE_ADMIN_TOKEN", "")
BUCKET = os.environ.get("OWI_S3_BUCKET", "owi-images")
ACCESS_KEY = os.environ.get("OWI_S3_ACCESS_KEY", "")
SECRET_KEY = os.environ.get("OWI_S3_SECRET_KEY", "")

# Informational on one node; Garage only compares it between nodes.
NODE_CAPACITY_BYTES = 100 * 1024**3
ZONE = "dc1"
HEALTH_WAIT_S = 90

# Garage generates key IDs as "GK" + 12 random bytes and secrets as 32 random
# bytes, both hex; imports must look identical or the cluster rejects them.
_ACCESS_KEY_RE = re.compile(r"^GK[0-9a-f]{24}$")
_SECRET_KEY_RE = re.compile(r"^[0-9a-f]{64}$")


def _check_env() -> None:
    problems = []
    if not ADMIN_TOKEN:
        problems.append("GARAGE_ADMIN_TOKEN is unset")
    if not _ACCESS_KEY_RE.match(ACCESS_KEY):
        problems.append("OWI_S3_ACCESS_KEY must be GK followed by 24 hex characters")
    if not _SECRET_KEY_RE.match(SECRET_KEY):
        problems.append("OWI_S3_SECRET_KEY must be 64 hex characters")
    if problems:
        sys.exit("garage: " + "; ".join(problems) + " — see example.env for the generators")


def _wait_for(client: httpx.Client, want: set[int], what: str) -> None:
    deadline = time.monotonic() + HEALTH_WAIT_S
    while True:
        try:
            if client.get("/health").status_code in want:
                return
        except httpx.TransportError:
            pass
        if time.monotonic() > deadline:
            sys.exit(f"garage: {ADMIN_URL} not {what} after {HEALTH_WAIT_S}s")
        time.sleep(2)


def _ensure_layout(client: httpx.Client) -> None:
    status = client.get("/v2/GetClusterStatus").raise_for_status().json()
    layout = client.get("/v2/GetClusterLayout").raise_for_status().json()
    assigned = {role["id"] for role in layout["roles"]}
    nodes = [n for n in status["nodes"] if n["id"] not in assigned]
    if not nodes:
        print("garage: layout already assigned")
        return
    roles = [
        {"id": n["id"], "zone": ZONE, "capacity": NODE_CAPACITY_BYTES, "tags": []} for n in nodes
    ]
    staged = {"roles": roles, "parameters": None}
    client.post("/v2/UpdateClusterLayout", json=staged).raise_for_status()
    version = layout["version"] + 1
    client.post("/v2/ApplyClusterLayout", json={"version": version}).raise_for_status()
    print(f"garage: layout v{version} applied to {len(roles)} node(s)")


def _ensure_bucket(client: httpx.Client) -> str:
    response = client.get("/v2/GetBucketInfo", params={"globalAlias": BUCKET})
    if response.status_code == 404:
        response = client.post("/v2/CreateBucket", json={"globalAlias": BUCKET})
        print(f"garage: created bucket {BUCKET}")
    response.raise_for_status()
    return str(response.json()["id"])


def _ensure_key(client: httpx.Client) -> None:
    response = client.get("/v2/GetKeyInfo", params={"id": ACCESS_KEY})
    if response.status_code == 404:
        body = {"name": "owi-api", "accessKeyId": ACCESS_KEY, "secretAccessKey": SECRET_KEY}
        client.post("/v2/ImportKey", json=body).raise_for_status()
        print(f"garage: imported key {ACCESS_KEY}")
        return
    response.raise_for_status()


def main() -> None:
    _check_env()
    with httpx.Client(
        base_url=ADMIN_URL, headers={"Authorization": f"Bearer {ADMIN_TOKEN}"}, timeout=10
    ) as client:
        # A fresh node answers 503 until it has a layout; only then can it store anything.
        _wait_for(client, {200, 503}, "reachable")
        _ensure_layout(client)
        _wait_for(client, {200}, "healthy")
        bucket_id = _ensure_bucket(client)
        _ensure_key(client)
        grant = {
            "bucketId": bucket_id,
            "accessKeyId": ACCESS_KEY,
            "permissions": {"read": True, "write": True, "owner": True},
        }
        client.post("/v2/AllowBucketKey", json=grant).raise_for_status()
        print(f"garage: {ACCESS_KEY} has read/write/owner on {BUCKET}")


if __name__ == "__main__":
    main()
