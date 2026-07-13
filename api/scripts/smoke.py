"""End-to-end smoke test: python scripts/smoke.py <base_url> <phone> <password>"""

import json
import sys
import uuid

import cv2
import httpx
import numpy as np

failures: list[str] = []


def check(name: str, condition: bool, detail: str = "") -> None:
    print(f"{'PASS' if condition else 'FAIL'}  {name}{'  ' + detail if detail else ''}")
    if not condition:
        failures.append(name)


def encode(image: np.ndarray) -> bytes:
    ok, buffer = cv2.imencode(".jpg", image)
    assert ok
    return buffer.tobytes()


def make_jpeg(seed: int) -> bytes:
    rng = np.random.default_rng(seed)
    return encode(rng.integers(0, 255, (480, 640, 3), dtype=np.uint8))


def make_dark_jpeg(seed: int) -> bytes:
    rng = np.random.default_rng(seed)
    return encode(rng.integers(0, 10, (480, 640, 3), dtype=np.uint8))


def make_blurry_jpeg(seed: int) -> bytes:
    rng = np.random.default_rng(seed)
    image = rng.integers(0, 255, (480, 640, 3), dtype=np.uint8)
    return encode(cv2.GaussianBlur(image, (51, 51), 0))


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

    # Random phone keeps the script rerunnable against the same database.
    collector = client.post(
        "/api/v1/users",
        headers=admin,
        json={
            "name": "Kevin",
            "phone": f"+2547{uuid.uuid4().int % 10**8:08d}",
            "role": "collector",
        },
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

    # Per-run seeds: identical bytes would (correctly) dedupe against earlier runs.
    run_seed = uuid.uuid4().int % 2**31
    gps_image, bin_image = make_jpeg(run_seed), make_jpeg(run_seed + 1)
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
        ("files", ("c.jpg", make_jpeg(run_seed + 2), "image/jpeg")),
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

    quality_meta = [
        {"captured_at": "2026-07-13T10:00:00Z", "lat": -1.29, "lng": 36.82},
        {"captured_at": "2026-07-13T10:01:00Z", "lat": -1.29, "lng": 36.82},
    ]
    quality = client.post(
        "/api/v1/observations/batch",
        headers=device_auth,
        data={"meta": json.dumps(quality_meta)},
        files=[
            ("files", ("dark.jpg", make_dark_jpeg(run_seed + 3), "image/jpeg")),
            ("files", ("blurry.jpg", make_blurry_jpeg(run_seed + 4), "image/jpeg")),
        ],
    ).json()["results"]
    check(
        "dark image rejected", quality[0]["status"] == "rejected" and "dark" in quality[0]["detail"]
    )
    check(
        "blurry image rejected",
        quality[1]["status"] == "rejected" and "blurry" in quality[1]["detail"],
    )

    fill_meta = [
        {"captured_at": "2026-07-11T08:00:00Z", "bin_qr": bin_data["qr_code"], "fill_tap": "low"},
        {"captured_at": "2026-07-12T08:00:00Z", "bin_qr": bin_data["qr_code"], "fill_tap": "half"},
        {"captured_at": "2026-07-13T08:00:00Z", "bin_qr": bin_data["qr_code"], "fill_tap": "high"},
    ]
    client.post(
        "/api/v1/observations/batch",
        headers=device_auth,
        data={"meta": json.dumps(fill_meta)},
        files=[
            ("files", (f"f{i}.jpg", make_jpeg(run_seed + 10 + i), "image/jpeg")) for i in range(3)
        ],
    )
    refresh = client.post("/api/v1/admin/analytics/refresh", headers=admin)
    check("analytics refresh runs", refresh.status_code == 200 and refresh.json()["bins"] >= 1)

    health = client.get("/api/v1/bins/health", headers=admin).json()
    ours = next((r for r in health if r["bin_id"] == bin_data["id"]), None)
    check("bin health scored", ours is not None, str(ours)[:120])
    if ours:
        check(
            "fast-filling bin flagged for collection",
            ours["overflow_risk"] in ("medium", "high") and ours["fill_pct"] >= 75,
        )

    collect = client.post(
        "/api/v1/collections", headers=device_auth, json={"bin_id": bin_data["id"]}
    )
    check("collection recorded", collect.status_code == 201)
    after = client.get("/api/v1/bins/health", headers=admin).json()
    ours_after = next((r for r in after if r["bin_id"] == bin_data["id"]), None)
    check(
        "collection updates days-since-collection",
        ours_after is not None and (ours_after["days_since_collection"] or 0) < 1,
    )

    ev = client.post(
        "/api/v1/volunteers",
        headers=admin,
        json={
            "occurred_on": "2026-07-01",
            "event_type": "cleanup",
            "area": "Estate A",
            "organizer": "Wanjiru",
            "participant_count": 12,
            "hours_total": 36.0,
            "materials_kg": {"plastic": 15.5, "glass": 4.0},
        },
    )
    check("volunteer event created", ev.status_code == 201, ev.text[:120])
    vsum = client.get("/api/v1/volunteers/summary", headers=admin).json()
    check(
        "volunteer summary aggregates",
        vsum["events"] >= 1
        and vsum["participants"] >= 12
        and vsum["kg_by_material"]["plastic"] >= 15.5,
    )
    report = client.get(
        "/api/v1/volunteers/report",
        headers=admin,
        params={"start": "2026-01-01", "end": "2026-12-31"},
    )
    check(
        "grant report renders",
        report.status_code == 200
        and "Community Impact Report" in report.text
        and "Volunteer hours" in report.text,
    )

    queue = client.get("/api/v1/predictions", headers=admin)
    check(
        "review queue reachable (empty until a model is active)",
        queue.status_code == 200 and queue.json()["unreviewed"] == 0,
    )
    check(
        "review queue is reviewer-only",
        client.get("/api/v1/predictions", headers=device_auth).status_code == 403,
    )

    purge = client.post("/api/v1/admin/quarantine/purge", headers=admin)
    check("quarantine purge runs", purge.status_code == 200 and "purged" in purge.json())
    check(
        "purge is admin-only",
        client.post("/api/v1/admin/quarantine/purge", headers=device_auth).status_code == 403,
    )

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
