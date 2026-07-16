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

    truck = client.post(
        "/api/v1/trucks",
        headers=admin,
        json={
            "name": "Truck 1",
            "capacity_kg": 2000,
            "fuel_l_per_100km": 25,
            "depot_lat": -1.2921,
            "depot_lng": 36.8219,
        },
    )
    check("create truck", truck.status_code == 201, truck.text[:120])
    plan = client.post("/api/v1/routes/optimize", headers=admin, json={})
    check("route optimization runs", plan.status_code == 200, plan.text[:150])
    if plan.status_code == 200:
        routes = plan.json()
        served = sum(r["bins_served"] for r in routes)
        check("route covers collect-today bins", served >= 1, f"served={served}")
        check("route reports distance + fuel", all(r["planned_km"] >= 0 for r in routes))
        check("route reports collection method", all(r.get("method") for r in routes))
    replan = client.post("/api/v1/routes/replan", headers=admin, json={})
    check("mid-day replan runs", replan.status_code == 200, replan.text[:150])

    listed = client.get("/api/v1/routes", headers=device_auth)
    check("driver can read today's routes", listed.status_code == 200)
    stops = [s for r in listed.json() for s in r["stops"]]
    if stops:
        first = stops[0]
        done = client.post(f"/api/v1/routes/stops/{first['id']}/collect", headers=device_auth)
        check("driver marks a stop collected", done.status_code == 204)
        after = client.get("/api/v1/routes", headers=device_auth).json()
        marked = next((s for r in after for s in r["stops"] if s["id"] == first["id"]), None)
        check("stop shows collected after marking", marked is not None and marked["collected"])

    savings = client.get("/api/v1/routes/savings", headers=admin)
    check("savings report computes", savings.status_code == 200, savings.text[:150])
    if savings.status_code == 200:
        s = savings.json()
        check(
            "savings compares fixed sweep vs need-driven",
            s["baseline"]["bins"] >= s["optimized"]["bins"] and "fuel_l_saved" in s,
        )

    methods = client.get("/api/v1/collection-methods", headers=admin)
    check(
        "collection-methods catalog served",
        methods.status_code == 200
        and any(m["method"] == "handcart" and not m["motorized"] for m in methods.json()),
        methods.text[:150],
    )
    check(
        "collection-methods require auth",
        client.get("/api/v1/collection-methods").status_code == 401,
    )
    cart = client.post(
        "/api/v1/trucks",
        headers=admin,
        json={
            "name": "Handcart 1",
            "method": "handcart",
            "capacity_kg": 120,
            "fuel_l_per_100km": 15,  # must be ignored: manual methods burn nothing
            "depot_lat": -1.2921,
            "depot_lng": 36.8219,
        },
    )
    check(
        "manual vehicle created with zero fuel",
        cart.status_code == 201
        and cart.json()["method"] == "handcart"
        and cart.json()["fuel_l_per_100km"] == 0,
        cart.text[:150],
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

    model = client.post(
        "/api/v1/models",
        headers=admin,
        json={
            "task": "fill",
            "version": "smoke-1",
            "metrics": {"macro_f1": 0.83},
            "activate": True,
        },
    )
    check("model registered + activated", model.status_code == 201 and model.json()["active"])
    check(
        "model carries labels for inference",
        model.status_code == 201 and model.json().get("id") is not None,
    )
    check(
        "model register is admin-only",
        client.post(
            "/api/v1/models", headers=device_auth, json={"task": "fill", "version": "x"}
        ).status_code
        == 403,
    )

    # Illegal dumping: a non-bin (street) observation becomes a candidate, confirm → site.
    dump_obs = client.post(
        "/api/v1/observations/batch",
        headers=device_auth,
        data={
            "meta": json.dumps(
                [{"captured_at": "2026-07-13T09:00:00Z", "lat": -1.30, "lng": 36.80}]
            )
        },
        files=[("files", ("street.jpg", make_jpeg(run_seed + 20), "image/jpeg"))],
    ).json()["results"][0]
    check("street observation created", dump_obs["status"] == "created")
    cands = client.get("/api/v1/dumping/candidates", headers=admin).json()
    check(
        "dumping candidate surfaced",
        any(c["observation_id"] == dump_obs["observation_id"] for c in cands),
    )
    confirmed = client.post(
        f"/api/v1/dumping/candidates/{dump_obs['observation_id']}/review",
        headers=admin,
        json={"review": "confirmed"},
    )
    check(
        "confirm creates dumping site",
        confirmed.status_code == 200 and confirmed.json()["event_count"] >= 1,
    )
    site_id = confirmed.json()["id"]
    check(
        "no re-review of same candidate",
        client.post(
            f"/api/v1/dumping/candidates/{dump_obs['observation_id']}/review",
            headers=admin,
            json={"review": "confirmed"},
        ).status_code
        == 409,
    )
    interv = client.post(
        f"/api/v1/dumping/sites/{site_id}/interventions",
        headers=admin,
        json={"kind": "cleanup", "performed_on": "2026-07-13", "notes": "cleared"},
    )
    check("intervention recorded", interv.status_code == 201)
    sites = client.get("/api/v1/dumping/sites", headers=admin).json()
    check("hotspot list ranks sites", len(sites) >= 1 and "hotspot_score" in sites[0])

    price = client.post(
        "/api/v1/recycling/prices",
        headers=admin,
        json={"material": "plastic", "kes_per_kg": 50, "effective_date": "2026-01-01"},
    )
    check("material price set", price.status_code == 201)
    partner = client.post(
        "/api/v1/recycling/partners",
        headers=admin,
        json={"name": "PET Buyer", "materials_accepted": ["plastic"], "min_kg_per_month": 100},
    )
    check("recycling partner added", partner.status_code == 201)
    rvalue = client.get("/api/v1/recycling/value?days=30", headers=admin)
    check(
        "recycling value computes",
        rvalue.status_code == 200 and "total_value_kes" in rvalue.json(),
    )
    match_resp = client.get(
        "/api/v1/recycling/partners/match",
        headers=admin,
        params={"material": "plastic", "kg_per_month": 500},
    )
    check("partner matching works", "PET Buyer" in match_resp.json()["partners"])

    clean = client.get("/api/v1/cleanliness", headers=admin)
    check("cleanliness scores compute", clean.status_code == 200 and isinstance(clean.json(), list))
    method = client.get("/api/v1/cleanliness/methodology", headers=admin)
    check(
        "cleanliness methodology published",
        method.status_code == 200 and method.json()["version"] == "cleanliness-v1",
    )

    factors = client.get("/api/v1/carbon/factors", headers=admin)
    check(
        "carbon factor table loads (cited)",
        factors.status_code == 200 and len(factors.json()) >= 8,
    )
    carbon = client.get("/api/v1/carbon?days=30", headers=admin)
    check(
        "carbon report computes with method version + range",
        carbon.status_code == 200
        and carbon.json()["method_version"] == "carbon-v1"
        and carbon.json()["co2e_low_kg"] <= carbon.json()["co2e_high_kg"],
    )

    comp = client.get("/api/v1/analytics/composition?days=30", headers=admin)
    check("composition endpoint", comp.status_code == 200 and "materials" in comp.json())
    check(
        "composition reports a total + sufficiency flag",
        isinstance(comp.json()["total"], int) and isinstance(comp.json()["sufficient"], bool),
    )

    queue = client.get("/api/v1/predictions", headers=admin)
    check(
        "review queue reachable",
        queue.status_code == 200 and isinstance(queue.json()["unreviewed"], int),
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

    # --- Open Data API (aggregates only, keyed, suppressed, 7-day delayed) ---
    pmeta = client.get("/api/v1/public/meta")
    check(
        "open-data meta is public + CC-BY",
        pmeta.status_code == 200 and pmeta.json()["license"] == "CC-BY-4.0",
    )
    check(
        "open-data endpoint rejects missing key",
        client.get("/api/v1/public/composition").status_code == 401,
    )
    check(
        "api-key creation is admin-only",
        client.post("/api/v1/admin/api-keys", headers=device_auth, json={"label": "x"}).status_code
        == 403,
    )
    made = client.post("/api/v1/admin/api-keys", headers=admin, json={"label": "researcher"})
    check(
        "api key issued (shown once, owi-prefixed)",
        made.status_code == 200 and made.json()["api_key"].startswith("owi_"),
    )
    key_headers = {"X-API-Key": made.json()["api_key"]}
    key_id, key_prefix = made.json()["id"], made.json()["key_prefix"]
    listed_keys = client.get("/api/v1/admin/api-keys", headers=admin).json()
    check(
        "api key listed by prefix",
        any(k["key_prefix"] == key_prefix for k in listed_keys),
    )
    coll = client.get("/api/v1/public/collections", headers=key_headers)
    check(
        "public collections aggregate returns",
        coll.status_code == 200
        and "cells" in coll.json()
        and isinstance(coll.json()["suppressed_cells"], int),
    )
    check(
        "public payload carries org attribution",
        coll.status_code == 200 and "attribution" in coll.json(),
    )
    check(
        "public composition + cleanliness reachable with key",
        client.get("/api/v1/public/composition", headers=key_headers).status_code == 200
        and client.get("/api/v1/public/cleanliness", headers=key_headers).status_code == 200,
    )
    csv_resp = client.get("/api/v1/public/collections?format=csv", headers=key_headers)
    check(
        "public CSV export",
        csv_resp.status_code == 200 and "text/csv" in csv_resp.headers.get("content-type", ""),
    )
    revoke_key = client.post(f"/api/v1/admin/api-keys/{key_id}/revoke", headers=admin)
    check("api key revocable", revoke_key.status_code == 200)
    check(
        "revoked key is rejected",
        client.get("/api/v1/public/collections", headers=key_headers).status_code == 401,
    )

    org_settings = client.get("/api/v1/admin/settings", headers=admin)
    check(
        "org settings served with retention default",
        org_settings.status_code == 200 and org_settings.json()["image_retention_months"] >= 1,
        org_settings.text[:120],
    )
    patched = client.patch(
        "/api/v1/admin/settings", headers=admin, json={"image_retention_months": 36}
    )
    check(
        "org retention configurable",
        patched.status_code == 200 and patched.json()["image_retention_months"] == 36,
    )
    img_purge = client.post("/api/v1/admin/images/purge", headers=admin)
    check(
        "retention purge runs (nothing expired)",
        img_purge.status_code == 200 and img_purge.json()["purged"] >= 0,
        img_purge.text[:100],
    )

    audit = client.get("/api/v1/admin/audit", headers=admin)
    audit_actions = {row["action"] for row in audit.json()} if audit.status_code == 200 else set()
    check(
        "audit trail records admin actions",
        audit.status_code == 200
        and {"user.create", "device_token.issue", "api_key.create", "api_key.revoke"}
        <= audit_actions,
        str(sorted(audit_actions))[:150],
    )
    check(
        "audit trail is admin-only",
        client.get("/api/v1/admin/audit", headers=device_auth).status_code == 403,
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
