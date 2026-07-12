"""End-to-end smoke test: python scripts/smoke.py <base_url> <phone> <password>"""

import json
import sys

import cv2
import httpx
import numpy as np

failures: list[str] = []


def check(name: str, condition: bool, detail: str = "") -> None:
    print(f"{'PASS' if condition else 'FAIL'}  {name}{'  ' + detail if detail else ''}")
    if not condition:
        failures.append(name)


def make_jpeg(seed: int) -> bytes:
    rng = np.random.default_rng(seed)
    image = rng.integers(0, 255, (480, 640, 3), dtype=np.uint8)
    ok, buffer = cv2.imencode(".jpg", image)
    assert ok
    return buffer.tobytes()


def main() -> None:
    base, phone, password = sys.argv[1], sys.argv[2], sys.argv[3]
    client = httpx.Client(base_url=base, timeout=30)

    health = client.get("/healthz")
    check("healthz", health.status_code == 200)
    check("security headers", health.headers.get("x-content-type-options") == "nosniff")

    check("unauthenticated is rejected", client.get("/api/v1/bins").status_code == 401)
    check(
        "wrong password is rejected",
        client.post(
            "/api/v1/auth/login", json={"phone": phone, "password": "definitely-wrong"}
        ).status_code
        == 401,
    )

    login = client.post("/api/v1/auth/login", json={"phone": phone, "password": password})
    check("admin login", login.status_code == 200)
    admin = {"Authorization": f"Bearer {login.json()['access_token']}"}

    collector = client.post(
        "/api/v1/users",
        headers=admin,
        json={"name": "Kevin", "phone": "+254700000001", "role": "collector"},
    )
    check("create collector", collector.status_code == 201, collector.text[:120])
    device = client.post(
        "/api/v1/auth/device-tokens", headers=admin, json={"user_id": collector.json()["id"]}
    )
    check("issue device token", device.status_code == 200)
    device_auth = {"Authorization": f"Bearer {device.json()['access_token']}"}

    site = client.post(
        "/api/v1/sites",
        headers=admin,
        json={"name": "Estate A", "site_type": "estate", "ward": "Test Ward"},
    )
    check("create site", site.status_code == 201, site.text[:120])
    bin_resp = client.post(
        "/api/v1/bins",
        headers=admin,
        json={
            "site_id": site.json()["id"],
            "lat": -1.2921,
            "lng": 36.8219,
            "volume_liters": 240,
            "bin_type": "standard",
        },
    )
    check("create bin", bin_resp.status_code == 201, bin_resp.text[:120])
    bin_data = bin_resp.json()

    by_qr = client.get(f"/api/v1/bins/by-qr/{bin_data['qr_code']}", headers=device_auth)
    check("collector resolves bin by QR", by_qr.status_code == 200)
    check(
        "collector cannot create bins",
        client.post("/api/v1/bins", headers=device_auth, json={}).status_code == 403,
    )

    qr_svg = client.get(f"/api/v1/bins/{bin_data['id']}/qr.svg", headers=admin)
    check("QR SVG renders", qr_svg.status_code == 200 and b"<svg" in qr_svg.content)

    gps_image, bin_image = make_jpeg(1), make_jpeg(2)
    meta = [
        {"captured_at": "2026-07-12T10:00:00Z", "lat": -1.2921, "lng": 36.8219, "fill_tap": "high"},
        {
            "captured_at": "2026-07-12T10:05:00Z",
            "bin_qr": bin_data["qr_code"],
            "fill_tap": "overflowing",
        },
        {"captured_at": "2026-07-12T10:06:00Z", "bin_qr": "nonexistent-code"},
        {"captured_at": "2026-07-12T10:07:00Z", "lat": -1.29, "lng": 36.82},
    ]
    files = [
        ("files", ("a.jpg", gps_image, "image/jpeg")),
        ("files", ("b.jpg", bin_image, "image/jpeg")),
        ("files", ("c.jpg", make_jpeg(3), "image/jpeg")),
        ("files", ("d.jpg", b"not an image", "image/jpeg")),
    ]
    batch = client.post(
        "/api/v1/observations/batch",
        headers=device_auth,
        data={"meta": json.dumps(meta)},
        files=files,
    )
    check("batch accepted", batch.status_code == 200, batch.text[:200])
    results = batch.json()["results"]
    check("GPS observation created", results[0]["status"] == "created")
    check("bin-QR observation created (no GPS)", results[1]["status"] == "created")
    check("unknown bin rejected", results[2]["status"] == "rejected")
    check("garbage image rejected", results[3]["status"] == "rejected")

    again = client.post(
        "/api/v1/observations/batch",
        headers=device_auth,
        data={"meta": json.dumps(meta[:1])},
        files=[("files", ("a.jpg", gps_image, "image/jpeg"))],
    )
    check("duplicate deduplicated", again.json()["results"][0]["status"] == "duplicate")

    revoke = client.post(f"/api/v1/users/{collector.json()['id']}/revoke-tokens", headers=admin)
    check("revoke tokens", revoke.status_code == 204)
    check(
        "revoked device token is dead",
        client.get("/api/v1/auth/me", headers=device_auth).status_code == 401,
    )

    statuses = {
        client.post(
            "/api/v1/auth/login", json={"phone": "+254799999999", "password": "x" * 8}
        ).status_code
        for _ in range(12)
    }
    check("login rate limit kicks in", 429 in statuses)

    print(f"\n{'ALL PASS' if not failures else f'{len(failures)} FAILURES: {failures}'}")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
