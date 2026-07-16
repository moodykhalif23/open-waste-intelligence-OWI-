"""Seed a realistic demo dataset so a fresh install doesn't look empty.

Usage: uv run python scripts/seed.py <base_url> <admin_phone> <password>

Mirrors scripts/smoke.py's auth + API-call style. Safe to re-run: registry rows
are get-or-created by name/label, observations dedupe on deterministic image bytes,
and the create-only steps (collections, dumping, routes) guard against piling up.
"""

import json
import sys
from datetime import UTC, datetime, timedelta

import cv2
import httpx
import numpy as np

# Nairobi CBD anchor — every site/bin sits a few km around here.
NAIROBI = (-1.2921, 36.8219)
FILL_BANDS = ["empty", "low", "half", "high", "overflowing"]

# Per-profile 14-reading fill patterns (oldest -> newest). "fast" bins end overflowing
# so they surface as collect-today / route candidates; "slow" bins stay low.
FILL_PATTERNS = {
    "fast": [
        "low",
        "half",
        "high",
        "overflowing",
        "low",
        "half",
        "high",
        "overflowing",
        "half",
        "high",
        "overflowing",
        "high",
        "overflowing",
        "overflowing",
    ],
    "medium": [
        "empty",
        "low",
        "low",
        "half",
        "high",
        "half",
        "low",
        "half",
        "high",
        "half",
        "high",
        "half",
        "high",
        "high",
    ],
    "slow": [
        "empty",
        "empty",
        "low",
        "low",
        "empty",
        "low",
        "half",
        "low",
        "empty",
        "low",
        "half",
        "low",
        "half",
        "low",
    ],
}
# Rotate capture hours so the Overview day x hour heatmap looks alive.
CAPTURE_HOURS = [7, 9, 11, 14, 16, 18, 20]

# Sites spread across three wards, each with an anchor point and bin count.
SITES = [
    ("Yaya Centre Estate", "estate", "Kilimani", (-1.2935, 36.7856), 3),
    ("Kilimani Primary", "residential", "Kilimani", (-1.2870, 36.7900), 3),
    ("Kawangware Market", "market", "Kawangware", (-1.2833, 36.7440), 3),
    ("Congo Estate", "estate", "Kawangware", (-1.2790, 36.7500), 3),
    ("Kayole Junction", "commercial", "Kayole", (-1.2740, 36.9080), 3),
]
BIN_TYPES = [("standard", 240), ("communal", 1100), ("recycling", 660)]

# Realistic Nairobi buy-back prices (KES/kg), effective start of year.
PRICES = [
    ("plastic", 35.0, "Mr. Green Africa 2026 buy-back rate"),
    ("glass", 5.0, "local cullet buyer indicative"),
    ("metal", 42.0, "scrap dealer indicative"),
    ("paper", 8.0, "Kamongo waste-paper rate"),
    ("organic", 2.0, "compost off-taker indicative"),
]
PARTNERS = [
    ("Mr. Green Africa", ["plastic"], 100.0, 38.0, "+254720000001"),
    ("TakaTaka Solutions", ["plastic", "paper", "organic", "glass"], 200.0, None, "+254720000002"),
    ("Kamongo Waste Paper", ["paper", "metal"], 150.0, 10.0, "+254720000003"),
]

# Two illegal-dumping hotspots (street points, no bin) captured over recent days.
DUMP_POINTS = [
    ("Ngong Road culvert", (-1.3010, 36.7800), 1),
    ("Ngong Road culvert", (-1.3011, 36.7801), 3),
    ("Kawangware backlane", (-1.2860, 36.7420), 5),
    ("Kawangware backlane", (-1.2861, 36.7421), 7),
]

# (name, method, capacity_kg, fuel_l_per_100km, depot) — fuel None lets the API
# apply the method default (0 for manual methods).
TRUCKS = [
    ("Isuzu FRR 01", "truck", 5000.0, 28.0, NAIROBI),
    ("Isuzu NQR 02", "truck", 3500.0, 24.0, (-1.2960, 36.8100)),
    ("Tuktuk collector 03", "tricycle", 800.0, 6.0, (-1.2800, 36.7500)),
    ("Mkokoteni crew 04", "handcart", 150.0, None, (-1.2850, 36.7460)),
]


def encode(image: np.ndarray) -> bytes:
    ok, buffer = cv2.imencode(".jpg", image)
    assert ok
    return buffer.tobytes()


def make_jpeg(seed: int) -> bytes:
    """Deterministic noise JPEG: passes the quality gate and dedupes identically on re-run."""
    rng = np.random.default_rng(seed)
    return encode(rng.integers(0, 255, (480, 640, 3), dtype=np.uint8))


def iso(now: datetime, days_ago: float, hour: int, minute: int = 0) -> str:
    dt = (now - timedelta(days=days_ago)).replace(hour=hour, minute=minute, second=0, microsecond=0)
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def offset(anchor: tuple[float, float], i: int) -> tuple[float, float]:
    """Fan bins out ~150-400 m around a site anchor, deterministically per index."""
    lat = anchor[0] + 0.0018 * ((i % 3) - 1)
    lng = anchor[1] + 0.0022 * ((i // 3) - 1) + 0.0011 * (i % 2)
    return round(lat, 6), round(lng, 6)


def main() -> None:
    if len(sys.argv) < 4:
        print("usage: python scripts/seed.py <base_url> <admin_phone> <password>")
        sys.exit(2)
    base, phone, password = sys.argv[1], sys.argv[2], sys.argv[3]
    now = datetime.now(UTC)
    client = httpx.Client(base_url=base, timeout=60)
    summary: dict[str, int] = {}

    def bump(key: str, n: int = 1) -> None:
        summary[key] = summary.get(key, 0) + n

    login = client.post("/api/v1/auth/login", json={"phone": phone, "password": password})
    if login.status_code != 200:
        print(f"admin login failed ({login.status_code}): {login.text[:200]}")
        sys.exit(1)
    admin = {"Authorization": f"Bearer {login.json()['access_token']}"}

    # --- Collector + device token (get-or-create by fixed phone) ---
    seed_phone = "+254711000777"
    resp = client.post(
        "/api/v1/users",
        headers=admin,
        json={"name": "Demo Collector", "phone": seed_phone, "role": "collector"},
    )
    if resp.status_code == 201:
        collector_id = resp.json()["id"]
        bump("users")
    elif resp.status_code == 409:
        users = client.get("/api/v1/users", headers=admin).json()
        collector_id = next(u["id"] for u in users if u["phone"] == seed_phone)
    else:
        print(f"collector create failed ({resp.status_code}): {resp.text[:200]}")
        sys.exit(1)
    device = client.post(
        "/api/v1/auth/device-tokens", headers=admin, json={"user_id": collector_id}
    )
    field = {"Authorization": f"Bearer {device.json()['access_token']}"}

    # --- Model registry (register/activate is idempotent per task+version) ---
    reg_labels = ["plastic", "glass", "metal", "paper", "organic"]
    reg_models = [("fill", "demo-fill-1", True), ("classify", "demo-cls-1", False)]
    for task, version, activate in reg_models:
        m = client.post(
            "/api/v1/models",
            headers=admin,
            json={
                "task": task,
                "version": version,
                "metrics": {"macro_f1": 0.81},
                "labels": reg_labels,
                "activate": activate,
            },
        )
        if m.status_code == 201:
            bump("models")

    # --- Sites (get-or-create by name) ---
    existing_sites = {s["name"]: s for s in client.get("/api/v1/sites", headers=admin).json()}
    site_ids: dict[str, str] = {}
    for name, site_type, ward, _anchor, _n in SITES:
        if name in existing_sites:
            site_ids[name] = existing_sites[name]["id"]
            continue
        r = client.post(
            "/api/v1/sites",
            headers=admin,
            json={"name": name, "site_type": site_type, "ward": ward},
        )
        site_ids[name] = r.json()["id"]
        bump("sites")

    # --- Bins (create up to each site's target count; keyed by site membership) ---
    all_bins = client.get("/api/v1/bins", headers=admin).json()
    per_site: dict[str, int] = {}
    for b in all_bins:
        per_site[b["site_id"]] = per_site.get(b["site_id"], 0) + 1
    for name, _t, _w, anchor, target in SITES:
        sid = site_ids[name]
        for i in range(per_site.get(sid, 0), target):
            lat, lng = offset(anchor, i)
            bin_type, volume = BIN_TYPES[i % len(BIN_TYPES)]
            r = client.post(
                "/api/v1/bins",
                headers=admin,
                json={
                    "site_id": sid,
                    "lat": lat,
                    "lng": lng,
                    "volume_liters": volume,
                    "bin_type": bin_type,
                },
            )
            if r.status_code == 201:
                bump("bins")

    # Re-fetch so observations attach to the stable bin set (sorted -> stable profiles).
    bins = sorted(client.get("/api/v1/bins", headers=admin).json(), key=lambda b: b["id"])
    profiles = ["fast", "medium", "slow"]

    # --- Observations: ~2.5 weeks of varied fill readings per bin (deterministic -> idempotent) ---
    for bi, b in enumerate(bins):
        pattern = FILL_PATTERNS[profiles[bi % 3]]
        metas, files = [], []
        for i, band in enumerate(pattern):
            days_ago = len(pattern) - 1 - i  # newest reading ~today
            hour = CAPTURE_HOURS[(bi + i) % len(CAPTURE_HOURS)]
            metas.append(
                {
                    "captured_at": iso(now, days_ago, hour, (i * 7) % 60),
                    "bin_qr": b["qr_code"],
                    "fill_tap": band,
                }
            )
            # Global-unique seed keeps different observations from deduping into each other.
            seed = 100_000 + bi * 1000 + i
            files.append(("files", (f"b{bi}_{i}.jpg", make_jpeg(seed), "image/jpeg")))
        res = client.post(
            "/api/v1/observations/batch",
            headers=field,
            data={"meta": json.dumps(metas)},
            files=files,
        )
        for row in res.json().get("results", []):
            bump("observations_created" if row["status"] == "created" else "observations_existing")

    # --- Recycling prices (one per material) + partners (by name) ---
    priced = {p["material"] for p in client.get("/api/v1/recycling/prices", headers=admin).json()}
    for material, kes, source in PRICES:
        if material in priced:
            continue
        r = client.post(
            "/api/v1/recycling/prices",
            headers=admin,
            json={
                "material": material,
                "kes_per_kg": kes,
                "effective_date": "2026-01-01",
                "source": source,
            },
        )
        if r.status_code == 201:
            bump("prices")
    have_partners = {
        p["name"] for p in client.get("/api/v1/recycling/partners", headers=admin).json()
    }
    for name, materials, min_kg, price, contact in PARTNERS:
        if name in have_partners:
            continue
        body = {
            "name": name,
            "materials_accepted": materials,
            "min_kg_per_month": min_kg,
            "contact": contact,
        }
        if price is not None:
            body["indicative_price_kes_per_kg"] = price
        r = client.post("/api/v1/recycling/partners", headers=admin, json=body)
        if r.status_code == 201:
            bump("partners")

    # First refresh: turn fill readings into bin_health rows (drives collections + route picks).
    client.post("/api/v1/admin/analytics/refresh", headers=admin)

    # --- Collections: past-dated for never-collected bins only (idempotent) ---
    health = {h["bin_id"]: h for h in client.get("/api/v1/bins/health", headers=admin).json()}
    for bi, b in enumerate(bins):
        if bi % 2 == 1:  # collect roughly half the fleet
            continue
        h = health.get(b["id"])
        if h is not None and h.get("days_since_collection") is not None:
            continue  # already has a collection from a prior seed run
        # Dated ~8-12 days back so recent fill readings still drive health/routing.
        occurred = iso(now, 8 + (bi % 3) * 2, 6)
        r = client.post(
            "/api/v1/collections",
            headers=field,
            json={"bin_id": b["id"], "occurred_at": occurred},
        )
        if r.status_code == 201:
            bump("collections")

    # Second refresh so cleanliness/health reflect the collections.
    client.post("/api/v1/admin/analytics/refresh", headers=admin)

    # --- Trucks (get-or-create by name) ---
    have_trucks = {t["name"] for t in client.get("/api/v1/trucks", headers=admin).json()}
    for name, method, cap, fuel, depot in TRUCKS:
        if name in have_trucks:
            continue
        body = {
            "name": name,
            "method": method,
            "capacity_kg": cap,
            "depot_lat": depot[0],
            "depot_lng": depot[1],
        }
        if fuel is not None:
            body["fuel_l_per_100km"] = fuel
        r = client.post("/api/v1/trucks", headers=admin, json=body)
        if r.status_code == 201:
            bump("trucks")

    # --- Route plan for today (skip if one already exists) ---
    if not client.get("/api/v1/routes", headers=admin).json():
        plan = client.post("/api/v1/routes/optimize", headers=admin, json={})
        if plan.status_code == 200:
            bump("routes", len(plan.json()))
        else:
            print(f"route optimize skipped ({plan.status_code}): {plan.text[:150]}")

    # --- Volunteer events (get-or-create by date+area+organizer) ---
    events = [
        (
            150,
            "cleanup",
            "Kilimani",
            "Wanjiru Mwangi",
            28,
            84.0,
            {"plastic": 42.0, "glass": 15.0, "paper": 20.0},
        ),
        (95, "education", "Kawangware", "Otieno Community Group", 40, 60.0, {}),
        (
            60,
            "cleanup",
            "Kayole",
            "Kayole Green Team",
            35,
            105.0,
            {"plastic": 55.0, "metal": 18.0, "organic": 30.0},
        ),
        (
            30,
            "sorting",
            "Kawangware",
            "TakaTaka Volunteers",
            18,
            72.0,
            {"plastic": 80.0, "paper": 45.0, "glass": 22.0},
        ),
        (7, "cleanup", "Kilimani", "Wanjiru Mwangi", 22, 55.0, {"plastic": 30.0, "paper": 12.0}),
    ]
    existing_events = {
        (e["occurred_on"], e["area"], e["organizer"])
        for e in client.get("/api/v1/volunteers", headers=admin).json()
    }
    for days_ago, etype, area, organizer, people, hours, materials in events:
        occurred_on = (now - timedelta(days=days_ago)).strftime("%Y-%m-%d")
        if (occurred_on, area, organizer) in existing_events:
            continue
        r = client.post(
            "/api/v1/volunteers",
            headers=admin,
            json={
                "occurred_on": occurred_on,
                "event_type": etype,
                "area": area,
                "organizer": organizer,
                "participant_count": people,
                "hours_total": hours,
                "materials_kg": materials,
            },
        )
        if r.status_code == 201:
            bump("volunteer_events")

    # --- Illegal dumping: street observations -> confirm the still-unreviewed ones as sites ---
    dump_obs_ids: set[str] = set()
    for di, (_area, (lat, lng), days_ago) in enumerate(DUMP_POINTS):
        res = client.post(
            "/api/v1/observations/batch",
            headers=field,
            data={
                "meta": json.dumps(
                    [
                        {
                            "captured_at": iso(
                                now, days_ago, CAPTURE_HOURS[di % len(CAPTURE_HOURS)]
                            ),
                            "lat": lat,
                            "lng": lng,
                        }
                    ]
                )
            },
            files=[("files", (f"dump{di}.jpg", make_jpeg(900_000 + di), "image/jpeg"))],
        )
        row = res.json()["results"][0]
        if row["status"] in ("created", "duplicate"):
            dump_obs_ids.add(row["observation_id"])
            if row["status"] == "created":
                bump("dumping_observations")

    cand_resp = client.get("/api/v1/dumping/candidates", headers=admin).json()
    candidates = {c["observation_id"] for c in cand_resp}
    confirmed_site: str | None = None
    for oid in dump_obs_ids & candidates:
        r = client.post(
            f"/api/v1/dumping/candidates/{oid}/review",
            headers=admin,
            json={"review": "confirmed"},
        )
        if r.status_code == 200 and r.json():
            bump("dumping_sites_confirmed")
            confirmed_site = r.json()["id"]

    # Record one intervention on a confirmed site (only if it has none yet).
    sites_now = client.get("/api/v1/dumping/sites", headers=admin).json()
    target_site = confirmed_site or (sites_now[0]["id"] if sites_now else None)
    if target_site is not None:
        detail = client.get(f"/api/v1/dumping/sites/{target_site}", headers=admin).json()
        if not detail.get("interventions"):
            r = client.post(
                f"/api/v1/dumping/sites/{target_site}/interventions",
                headers=admin,
                json={
                    "kind": "cleanup",
                    "performed_on": now.strftime("%Y-%m-%d"),
                    "notes": "Community cleanup + signage installed",
                },
            )
            if r.status_code == 201:
                bump("dumping_interventions")

    print("\nSeed complete. Created this run:")
    for key in sorted(summary):
        print(f"  {key:26} {summary[key]}")
    if not summary:
        print("  (nothing new — dataset already seeded)")


if __name__ == "__main__":
    main()
