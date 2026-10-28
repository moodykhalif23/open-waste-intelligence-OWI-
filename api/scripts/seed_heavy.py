"""Heavy demo dataset for the dashboard admin's organization: make seed-heavy / seed-heavy-purge

Runs inside the api container (it needs the database, the object store and OSRM):
    docker compose --profile prod exec -T api uv run python - [--purge|--dry-run] < api/scripts/seed_heavy.py
"""

import argparse
import base64
import hashlib
import math
import time
import uuid
from bisect import bisect_left, bisect_right
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta, timezone
from datetime import time as dtime
from typing import Any

import cv2
import httpx
import numpy as np
import psycopg
from psycopg.types.json import Jsonb

from owi_api.analytics.bin_health import BAND_PCT, compute_health
from owi_api.analytics.cleanliness import cleanliness_index
from owi_api.analytics.cleanliness_refresh import (
    DUMPING_PENALTY_PER_SITE,
    DUMPING_RADIUS_M,
    OVERFLOW_BANDS,
    WINDOW_DAYS,
    refresh_cleanliness,
)
from owi_api.analytics.dumping import HALF_LIFE_DAYS, is_recurring
from owi_api.analytics.refresh import LOOKBACK_DAYS, MAX_OBSERVATIONS, refresh_bin_health
from owi_api.analytics.routing import haversine_m
from owi_api.config import settings
from owi_api.db import SessionLocal
from owi_api.ingestion.quality import assess_quality, decode_image
from owi_api.ingestion.storage import get_store
from owi_api.models.enums import (
    CollectionMethod,
    DumpingReview,
    DumpingStatus,
    EventType,
    FillBand,
    InterventionKind,
    LocationSource,
    OverflowRisk,
    PredictionTask,
    PrivacyStatus,
    ReviewStatus,
    RouteStatus,
    UserRole,
)

NAMESPACE = uuid.UUID("5b0e7f1c-9a43-4c6e-8f2d-3e1a6c0b7d42")
MARKER = "owi-seed-heavy"
SEED = 20261028
HISTORY_DAYS = 90
ROUTE_DAYS = 60
TARGET_BINS = 1500
EAT = timezone(timedelta(hours=3), "EAT")
HOLIDAYS = {(1, 1), (5, 1), (6, 1), (10, 10), (10, 20), (12, 12), (12, 25), (12, 26)}
MATERIALS = sorted(
    ["plastic", "organic", "paper", "glass", "metal", "textile", "e_waste", "other_mixed"]
)
MODEL_VERSION = "seed-heavy-cls-1"

WARDS: list[tuple[str, tuple[float, float], list[tuple[str, str]]]] = [
    (
        "Dandora Area I",
        (-1.2545, 36.8960),
        [
            ("Dandora Phase 1 Market", "market"),
            ("Dandora Phase 1 Estate", "estate"),
            ("Dandora Secondary School", "school"),
            ("Phase 1 Matatu Stage", "stage"),
            ("Dandora Health Centre", "health"),
            ("St Augustine Church Dandora", "church"),
        ],
    ),
    (
        "Dandora Area II",
        (-1.2490, 36.9035),
        [
            ("Dandora Phase 2 Market", "market"),
            ("Phase 2 Shopping Centre", "commercial"),
            ("Dandora Phase 2 Estate", "estate"),
            ("Kamukunji Grounds", "residential"),
            ("Dandora Primary School", "school"),
            ("Phase 2 Block 11", "estate"),
        ],
    ),
    (
        "Dandora Area III",
        (-1.2445, 36.9095),
        [
            ("Dandora Phase 3 Estate", "estate"),
            ("Phase 3 Stage", "stage"),
            ("Dandora Phase 3 Market", "market"),
            ("Waithaka Courts", "residential"),
            ("Phase 3 Block 5", "estate"),
        ],
    ),
    (
        "Dandora Area IV",
        (-1.2530, 36.9105),
        [
            ("Dandora Phase 4 Estate", "estate"),
            ("Phase 4 Shopping Centre", "commercial"),
            ("Dandora Phase 5 Estate", "estate"),
            ("Charity Courts", "residential"),
            ("Phase 4 Riverside Collection Point", "collection_point"),
        ],
    ),
    (
        "Kariobangi North",
        (-1.2540, 36.8820),
        [
            ("Kariobangi North Market", "market"),
            ("Kariobangi North Estate", "estate"),
            ("Kariobangi Catholic Church", "church"),
            ("Kariobangi North Primary", "school"),
            ("Sports Road Stage", "stage"),
            ("Kariobangi Health Centre", "health"),
        ],
    ),
    (
        "Kariobangi South",
        (-1.2655, 36.8870),
        [
            ("Civil Servants Estate", "estate"),
            ("Kariobangi Light Industries", "industrial"),
            ("Kariobangi South Market", "market"),
            ("Outer Ring Road Stage", "stage"),
            ("Kariobangi South Primary", "school"),
            ("Kariobangi South Shopping Centre", "commercial"),
        ],
    ),
    (
        "Baba Dogo",
        (-1.2410, 36.8770),
        [
            ("Baba Dogo Market", "market"),
            ("Baba Dogo Road Stage", "stage"),
            ("Ruaraka Industrial Area", "industrial"),
            ("Baba Dogo Estate", "residential"),
            ("Baba Dogo Primary School", "school"),
            ("Ngumba Estate", "estate"),
        ],
    ),
    (
        "Komarock",
        (-1.2690, 36.9180),
        [
            ("Komarock Shopping Centre", "commercial"),
            ("Komarock Sector 1", "estate"),
            ("Komarock Sector 2", "estate"),
            ("Komarock Sector 3", "estate"),
            ("Komarock Market", "market"),
            ("Kangundo Road Stage", "stage"),
            ("Komarock Sector 4 Plots", "collection_point"),
        ],
    ),
    (
        "Korogocho",
        (-1.2475, 36.8835),
        [
            ("Korogocho Market", "market"),
            ("Grogan Village", "lane"),
            ("Highridge Village", "lane"),
            ("Gitathuru Village", "lane"),
            ("Nyayo Village", "lane"),
            ("Korogocho Chief's Camp", "commercial"),
            ("Kisumu Ndogo Village", "lane"),
            ("Gitathuru Riverside", "collection_point"),
        ],
    ),
    (
        "Mathare",
        (-1.2615, 36.8560),
        [
            ("Mathare 4A", "lane"),
            ("Mabatini Village", "lane"),
            ("Mashimoni Village", "lane"),
            ("Mathare Area 3", "lane"),
            ("Mathare North Market", "market"),
            ("Mlango Kubwa Stage", "stage"),
            ("Kosovo Village", "lane"),
            ("Mathare Valley Riverside", "collection_point"),
        ],
    ),
    (
        "Huruma",
        (-1.2590, 36.8700),
        [
            ("Huruma Estate", "estate"),
            ("Kiamaiko Market", "market"),
            ("Ngei Estate", "estate"),
            ("Madoya Village", "lane"),
            ("Huruma Stage", "stage"),
            ("Huruma Flats", "residential"),
        ],
    ),
    (
        "Lucky Summer",
        (-1.2345, 36.8860),
        [
            ("Lucky Summer Estate", "estate"),
            ("Lucky Summer Market", "market"),
            ("Ngomongo Village", "lane"),
            ("Lucky Summer Stage", "stage"),
            ("Lucky Summer Primary", "school"),
            ("Ruaraka Housing", "residential"),
            ("Lucky Summer Riverside Plots", "collection_point"),
        ],
    ),
    (
        "Mowlem",
        (-1.2650, 36.9065),
        [
            ("Mowlem Estate", "estate"),
            ("Mowlem Shopping Centre", "commercial"),
            ("Savannah Estate", "estate"),
            ("Mowlem Primary School", "school"),
            ("Mowlem Stage", "stage"),
        ],
    ),
    (
        "Umoja",
        (-1.2810, 36.8960),
        [
            ("Umoja Market", "market"),
            ("Umoja 1 Estate", "estate"),
            ("Umoja 2 Estate", "estate"),
            ("Umoja Innercore", "residential"),
            ("Moi Drive Stage", "stage"),
            ("Tena Estate", "estate"),
            ("Umoja Shopping Centre", "commercial"),
        ],
    ),
]

BINS_PER_SITE = {
    "market": (32, 48),
    "commercial": (16, 24),
    "estate": (18, 30),
    "residential": (14, 22),
    "stage": (8, 14),
    "school": (6, 10),
    "health": (5, 8),
    "church": (4, 7),
    "industrial": (12, 18),
    "lane": (14, 22),
    "collection_point": (0, 0),
}
SPREAD_M = {"market": 120, "estate": 280, "residential": 230, "lane": 190, "industrial": 260}
BIN_TYPES = {
    "standard": 240,
    "communal": 1100,
    "recycling": 660,
    "drum": 200,
}
BIN_MIX = {
    "market": {"communal": 0.4, "standard": 0.3, "drum": 0.15, "recycling": 0.15},
    "lane": {"drum": 0.5, "standard": 0.45, "communal": 0.05},
    "industrial": {"communal": 0.6, "standard": 0.25, "recycling": 0.15},
    "default": {"standard": 0.55, "communal": 0.2, "recycling": 0.12, "drum": 0.13},
}
FILL_RATE = {
    "market": 0.2,
    "stage": 0.15,
    "commercial": 0.13,
    "estate": 0.11,
    "residential": 0.1,
    "lane": 0.12,
    "school": 0.09,
    "health": 0.08,
    "church": 0.06,
    "industrial": 0.09,
}
VISITS_PER_DAY = {
    "market": 0.8,
    "stage": 0.55,
    "commercial": 0.48,
    "estate": 0.4,
    "residential": 0.38,
    "lane": 0.48,
    "school": 0.32,
    "health": 0.32,
    "church": 0.26,
    "industrial": 0.32,
}
VISIT_SCALE = 1.0
OBS_DOW = [1.15, 1.12, 1.1, 1.08, 1.0, 0.62, 0.3]
OBS_HOURS = {
    6: 0.35,
    7: 1.0,
    8: 1.55,
    9: 1.65,
    10: 1.4,
    11: 1.1,
    12: 0.8,
    13: 0.7,
    14: 0.85,
    15: 0.8,
    16: 0.65,
    17: 0.45,
    18: 0.25,
    19: 0.12,
}
DEPOSIT_BY_HOUR = (
    [0.2] * 6
    + [
        1.2,
        1.6,
        1.4,
        1.0,
        0.9,
        0.9,
        1.0,
        0.9,
        0.8,
        0.8,
        0.9,
        1.2,
        1.5,
        1.6,
        1.3,
        0.9,
    ]
    + [0.5, 0.3]
)
BAND_EDGES = [(0.15, FillBand.EMPTY), (0.375, FillBand.LOW), (0.625, FillBand.HALF)]

COORDINATORS = [
    (
        "Grace Wanjiku",
        ["Dandora Area I", "Dandora Area II", "Dandora Area III", "Dandora Area IV", "Mowlem"],
    ),
    (
        "Peter Otieno",
        ["Kariobangi North", "Kariobangi South", "Baba Dogo", "Lucky Summer", "Komarock", "Umoja"],
    ),
    ("Faith Achieng", ["Korogocho", "Mathare", "Huruma"]),
]
COLLECTORS = [
    ("John Kamau", ["Dandora Area I", "Dandora Area II"]),
    ("Mary Njeri", ["Dandora Area III", "Dandora Area IV"]),
    ("Kevin Ouma", ["Mathare"]),
    ("Esther Mwende", ["Kariobangi North", "Korogocho"]),
    ("Brian Kiprotich", ["Korogocho"]),
    ("Janet Akinyi", ["Huruma", "Mathare"]),
    ("Samuel Mutua", ["Baba Dogo", "Lucky Summer"]),
    ("Lucy Wairimu", ["Umoja"]),
    ("Dennis Omondi", ["Huruma"]),
    ("Mercy Chebet", ["Komarock", "Mowlem"]),
    ("Joseph Mwangi", ["Dandora Area II", "Dandora Area IV"]),
    ("Agnes Nduta", ["Kariobangi South", "Umoja"]),
    ("Collins Wekesa", ["Kariobangi South", "Mowlem"]),
    ("Purity Kerubo", ["Lucky Summer", "Baba Dogo", "Kariobangi North"]),
]


@dataclass(frozen=True)
class VehicleSpec:
    key: str
    name: str
    method: CollectionMethod
    capacity_kg: float
    fuel_l_per_100km: float
    depot: tuple[float, float]
    wards: tuple[str, ...]
    lanes_of: str | None
    crew: str
    max_stops: int
    start_hour: float
    speed_kmh: float
    service_min: float
    target_load: float


DEPOT = (-1.2600, 36.8870)
VEHICLES = [
    VehicleSpec(
        "truck-a",
        "Isuzu FVR KDH 214J",
        CollectionMethod.TRUCK,
        5000.0,
        30.0,
        DEPOT,
        ("Dandora Area I", "Dandora Area II", "Dandora Area III", "Dandora Area IV"),
        None,
        "Joseph Mwangi",
        95,
        6.0,
        14.0,
        3.5,
        0.86,
    ),
    VehicleSpec(
        "truck-b",
        "Isuzu NQR KDB 908Q",
        CollectionMethod.TRUCK,
        3500.0,
        22.0,
        DEPOT,
        ("Kariobangi North", "Kariobangi South", "Mowlem", "Komarock"),
        None,
        "Collins Wekesa",
        95,
        6.25,
        15.0,
        3.5,
        0.97,
    ),
    VehicleSpec(
        "truck-c",
        "Mitsubishi Canter KCU 233T",
        CollectionMethod.TRUCK,
        3000.0,
        18.0,
        DEPOT,
        ("Baba Dogo", "Lucky Summer", "Umoja", "Korogocho"),
        None,
        "Samuel Mutua",
        95,
        6.5,
        15.0,
        3.5,
        0.85,
    ),
    VehicleSpec(
        "tuktuk",
        "TVS King tuk-tuk KMFJ 117A",
        CollectionMethod.TRICYCLE,
        800.0,
        6.0,
        (-1.2590, 36.8700),
        ("Huruma", "Mathare"),
        None,
        "Dennis Omondi",
        40,
        7.0,
        16.0,
        4.0,
        0.9,
    ),
    VehicleSpec(
        "cart-mathare",
        "Mkokoteni crew Mathare",
        CollectionMethod.HANDCART,
        350.0,
        0.0,
        (-1.2615, 36.8560),
        (),
        "Mathare",
        "Kevin Ouma",
        24,
        6.5,
        4.0,
        6.0,
        1.03,
    ),
    VehicleSpec(
        "cart-korogocho",
        "Mkokoteni crew Korogocho",
        CollectionMethod.HANDCART,
        350.0,
        0.0,
        (-1.2475, 36.8835),
        (),
        "Korogocho",
        "Brian Kiprotich",
        24,
        6.5,
        4.0,
        6.0,
        1.0,
    ),
]
SKIP_REASONS = [
    ("Gate locked, caretaker absent", 0.2),
    ("Access blocked by parked matatus", 0.17),
    ("Market stalls blocking the bin", 0.14),
    ("Bin missing, reported to coordinator", 0.08),
    ("Already emptied by county truck", 0.12),
    ("Security concern, crew moved on", 0.07),
    (None, 0.22),
]
MATERIAL_MIX = {
    "market": {
        "organic": 0.5,
        "plastic": 0.2,
        "paper": 0.1,
        "other_mixed": 0.09,
        "textile": 0.04,
        "glass": 0.03,
        "metal": 0.02,
        "e_waste": 0.02,
    },
    "household": {
        "organic": 0.38,
        "plastic": 0.22,
        "paper": 0.11,
        "other_mixed": 0.13,
        "textile": 0.06,
        "glass": 0.04,
        "metal": 0.03,
        "e_waste": 0.03,
    },
    "commercial": {
        "plastic": 0.31,
        "paper": 0.21,
        "organic": 0.19,
        "other_mixed": 0.12,
        "glass": 0.07,
        "metal": 0.05,
        "textile": 0.03,
        "e_waste": 0.02,
    },
    "school": {
        "paper": 0.34,
        "plastic": 0.3,
        "organic": 0.2,
        "other_mixed": 0.1,
        "textile": 0.03,
        "glass": 0.01,
        "metal": 0.01,
        "e_waste": 0.01,
    },
    "industrial": {
        "plastic": 0.25,
        "metal": 0.2,
        "paper": 0.19,
        "other_mixed": 0.2,
        "textile": 0.08,
        "e_waste": 0.05,
        "glass": 0.03,
    },
    "pile": {
        "other_mixed": 0.3,
        "plastic": 0.28,
        "organic": 0.24,
        "textile": 0.07,
        "paper": 0.05,
        "metal": 0.03,
        "glass": 0.02,
        "e_waste": 0.01,
    },
}
MATERIAL_GROUP = {
    "market": "market",
    "commercial": "commercial",
    "stage": "commercial",
    "school": "school",
    "industrial": "industrial",
}
CONFUSION = {
    "plastic": ["other_mixed", "glass"],
    "organic": ["other_mixed"],
    "paper": ["textile", "plastic"],
    "glass": ["plastic"],
    "metal": ["e_waste", "other_mixed"],
    "textile": ["paper", "other_mixed"],
    "e_waste": ["metal"],
    "other_mixed": ["plastic", "organic"],
}
ACCURACY = {
    "organic": 0.88,
    "plastic": 0.85,
    "paper": 0.76,
    "glass": 0.7,
    "metal": 0.72,
    "textile": 0.66,
    "e_waste": 0.6,
    "other_mixed": 0.62,
}
PRICES = [
    ("plastic", 30.0, 34.0, "Eastlands PET aggregator buy-back, sorted"),
    ("paper", 7.0, 8.0, "Ruaraka waste-paper rate"),
    ("glass", 4.0, 5.0, "cullet buyer indicative"),
    ("metal", 38.0, 42.0, "Kariobangi scrap yard indicative"),
    ("organic", 1.5, 2.0, "compost off-taker indicative"),
    ("textile", 9.0, 10.0, "second-hand textile traders"),
    ("e_waste", 55.0, 60.0, "licensed e-waste handler"),
]
PARTNERS = [
    ("Eastlands PET Aggregators", ["plastic"], 300.0, 36.0, "+254711000201"),
    ("Ruaraka Paper Recovery", ["paper"], 500.0, 9.0, "+254711000202"),
    ("Kariobangi Scrap Metal Yard", ["metal", "e_waste"], 100.0, 45.0, "+254711000203"),
    ("Dandora Compost Collective", ["organic"], 1000.0, 2.5, "+254711000204"),
    ("Gikomba Textile Reuse Traders", ["textile"], 150.0, 11.0, "+254711000205"),
    ("Baba Dogo Cullet Buyers", ["glass"], 400.0, 5.5, "+254711000206"),
]
ORGANIZERS = {
    "Korogocho": "Korogocho Youth Clean-Up Group",
    "Mathare": "Mathare Green Champions",
    "Dandora Area II": "Dandora Phase 2 Residents Association",
    "Kariobangi North": "Kariobangi North Women Self-Help Group",
    "Huruma": "Huruma Environmental Youth",
    "Lucky Summer": "Lucky Summer Clean Team",
    "Umoja": "Umoja Residents Welfare",
    "Komarock": "Komarock Environment Club",
    "Baba Dogo": "Baba Dogo Youth Sports Club",
    "Dandora Area I": "St Augustine Youth Dandora",
}
VOLUNTEER_NOTES = {
    EventType.CLEANUP: [
        "Riverbank cleanup along the Gitathuru",
        "Drainage unblocking ahead of the rains",
        "Market close-of-day sweep with traders",
        "Stage and footpath cleanup",
        None,
    ],
    EventType.EDUCATION: [
        "Source-separation session for households",
        "School assembly talk on plastics",
        "Chama meeting on paid collection",
        None,
    ],
    EventType.SORTING: [
        "Sorting day at the collection point, PET and cartons",
        "Organics separated for compost trial",
        None,
    ],
}
INTERVENTION_NOTES = {
    InterventionKind.CLEANUP: "Crew and youth group cleared the pile",
    InterventionKind.SIGNAGE: "No-dumping signs posted, Swahili and English",
    InterventionKind.BIN_ADDED: "Communal bin placed at the corner",
    InterventionKind.ENGAGEMENT: "Baraza with residents and the area chief",
}


def seed_id(org_id: uuid.UUID, *parts: object) -> uuid.UUID:
    return uuid.uuid5(NAMESPACE, ":".join([str(org_id), *map(str, parts)]))


def marker_sha(observation_id: uuid.UUID) -> str:
    return hashlib.sha256(f"{MARKER}:{observation_id}".encode()).hexdigest()


def ewkt(lat: float, lng: float) -> str:
    return f"SRID=4326;POINT({lng:.7f} {lat:.7f})"


def offset(lat: float, lng: float, east_m: float, north_m: float) -> tuple[float, float]:
    return (
        lat + north_m / 111_320,
        lng + east_m / (111_320 * math.cos(math.radians(lat))),
    )


def random_offset(
    rng: np.random.Generator, lat: float, lng: float, radius_m: float, min_m: float = 0.0
) -> tuple[float, float]:
    angle = rng.uniform(0, 2 * math.pi)
    dist = math.sqrt(rng.uniform((min_m / radius_m) ** 2, 1.0)) * radius_m
    return offset(lat, lng, dist * math.cos(angle), dist * math.sin(angle))


def weighted(rng: np.random.Generator, options: dict[Any, float]) -> Any:
    keys = list(options)
    probs = np.array([options[k] for k in keys], dtype=float)
    return keys[int(rng.choice(len(keys), p=probs / probs.sum()))]


def band_for(level: float) -> FillBand:
    for edge, band in BAND_EDGES:
        if level < edge:
            return band
    return FillBand.HIGH if level < 0.875 else FillBand.OVERFLOWING


class Osrm:
    def __init__(self, base_url: str) -> None:
        self._client = httpx.Client(base_url=base_url.rstrip("/"), timeout=30)

    def nearest(self, point: tuple[float, float]) -> tuple[float, float, float]:
        lat, lng = point
        response = self._client.get(
            f"/nearest/v1/driving/{lng:.6f},{lat:.6f}", params={"number": 1}
        )
        response.raise_for_status()
        waypoint = response.json()["waypoints"][0]
        snapped_lng, snapped_lat = waypoint["location"]
        return snapped_lat, snapped_lng, float(waypoint["distance"])

    def route_km(self, points: list[tuple[float, float]]) -> float:
        coords = ";".join(f"{lng:.6f},{lat:.6f}" for lat, lng in points)
        try:
            response = self._client.get(
                f"/route/v1/driving/{coords}", params={"overview": "false", "steps": "false"}
            )
            data = response.json()
            if data.get("code") == "Ok":
                return round(float(data["routes"][0]["distance"]) / 1000, 2)
        except httpx.HTTPError:
            pass
        legs = sum(
            haversine_m((a[1], a[0]), (b[1], b[0]))
            for a, b in zip(points, points[1:], strict=False)
        )
        return round(legs * 1.35 / 1000, 2)

    def snap(
        self, candidates: list[list[tuple[float, float]]], max_distance_m: float
    ) -> list[tuple[float, float]]:
        flat = [c for group in candidates for c in group]
        with ThreadPoolExecutor(max_workers=8) as pool:
            snapped = list(pool.map(self.nearest, flat))
        chosen: list[tuple[float, float]] = []
        cursor = 0
        for group in candidates:
            options = snapped[cursor : cursor + len(group)]
            cursor += len(group)
            near = [o for o in options if o[2] <= max_distance_m]
            best = near[0] if near else min(options, key=lambda o: o[2])
            chosen.append((best[0], best[1]))
        return chosen


def _pick(rng: np.random.Generator, seq: list[Any]) -> Any:
    return seq[int(rng.integers(len(seq)))]


PLASTIC_BGR = [
    (200, 120, 40),
    (180, 90, 200),
    (235, 235, 235),
    (35, 35, 35),
    (60, 60, 200),
    (40, 170, 230),
]
PAPER_BGR = [(215, 225, 230), (170, 190, 205), (120, 150, 185)]
ORGANIC_BGR = [(50, 130, 60), (40, 75, 110), (40, 200, 225), (30, 100, 70), (60, 90, 120)]
BOTTLE_BGR = [(210, 200, 170), (150, 190, 140), (200, 230, 230)]
IMG_W, IMG_H = 640, 480


def _texture(rng: np.random.Generator, shape: tuple[int, ...], sigma: float) -> np.ndarray:
    return rng.normal(0, sigma, shape).astype(np.float32)


def _scene_background(rng: np.random.Generator, horizon: int) -> np.ndarray:
    img = np.zeros((IMG_H, IMG_W, 3), np.float32)
    style = int(rng.integers(0, 3))
    if style == 0:
        base = np.array(_pick(rng, [(70, 95, 150), (110, 110, 115), (60, 110, 165)]), np.float32)
        ridge = 0.75 + 0.25 * np.sin(np.arange(IMG_W, dtype=np.float32) / rng.uniform(5, 9))
        img[:horizon] = base * ridge[None, :, None]
        rust = np.clip(_texture(rng, (horizon, IMG_W, 1), 1.0), 0, None)
        img[:horizon] += rust * np.array([5, 25, 55], np.float32)
    elif style == 1:
        img[:horizon] = np.array(
            _pick(rng, [(150, 175, 195), (170, 170, 160), (120, 160, 190)]), np.float32
        )
        for y in range(0, horizon, int(rng.integers(28, 40))):
            img[y : y + 2, :] *= 0.8
    else:
        sky = np.linspace(1.0, 0.75, horizon, dtype=np.float32)[:, None, None]
        img[:horizon] = np.array((235, 200, 160), np.float32) * sky
        for _ in range(int(rng.integers(4, 9))):
            x0 = int(rng.integers(0, IMG_W - 60))
            top = int(rng.integers(int(horizon * 0.2), horizon - 20))
            width = int(rng.integers(40, 140))
            img[top:horizon, x0 : x0 + width] = _pick(
                rng, [(150, 160, 170), (120, 140, 175), (175, 180, 190)]
            )
    img[:horizon] += _texture(rng, (horizon, IMG_W, 3), 6)
    ground = _pick(rng, [(70, 105, 150), (95, 100, 105), (80, 120, 160)])
    depth = np.linspace(0.85, 1.1, IMG_H - horizon, dtype=np.float32)[:, None, None]
    img[horizon:] = np.array(ground, np.float32) * depth
    img[horizon:] += _texture(rng, (IMG_H - horizon, IMG_W, 3), 14)
    for _ in range(int(rng.integers(30, 70))):
        shade = float(rng.uniform(0.6, 1.3))
        cv2.circle(
            img,
            (int(rng.integers(0, IMG_W)), int(rng.integers(horizon, IMG_H))),
            int(rng.integers(1, 4)),
            tuple(float(c) * shade for c in ground),
            -1,
        )
    return img


def _waste_item(
    rng: np.random.Generator, img: np.ndarray, cx: float, cy: float, size: float
) -> None:
    kind = _pick(rng, ["bag", "bag", "bottle", "paper", "organic", "organic"])
    if kind == "bag":
        color = _pick(rng, PLASTIC_BGR)
        n = int(rng.integers(6, 10))
        pts = [
            (
                cx + size * rng.uniform(0.5, 1.2) * math.cos(2 * math.pi * k / n),
                cy + size * rng.uniform(0.35, 0.85) * math.sin(2 * math.pi * k / n),
            )
            for k in range(n)
        ]
        poly = np.array(pts, np.int32)
        cv2.fillPoly(img, [poly], color)
        cv2.polylines(img, [poly], True, tuple(c * 0.7 for c in color), 1)
    elif kind == "bottle":
        color = _pick(rng, BOTTLE_BGR)
        angle = float(rng.uniform(0, 180))
        axes = (int(size * 1.1), max(2, int(size * 0.35)))
        cv2.ellipse(img, (int(cx), int(cy)), axes, angle, 0, 360, color, -1)
        cv2.ellipse(img, (int(cx), int(cy)), axes, angle, 0, 360, (240, 240, 240), 1)
    elif kind == "paper":
        box = cv2.boxPoints(
            (
                (float(cx), float(cy)),
                (float(size * rng.uniform(0.8, 1.6)), float(size * rng.uniform(0.5, 1.0))),
                float(rng.uniform(0, 90)),
            )
        )
        cv2.fillPoly(img, [box.astype(np.int32)], _pick(rng, PAPER_BGR))
    else:
        axes = (
            max(2, int(size * rng.uniform(0.4, 0.9))),
            max(2, int(size * rng.uniform(0.2, 0.5))),
        )
        cv2.ellipse(
            img,
            (int(cx), int(cy)),
            axes,
            float(rng.uniform(0, 180)),
            0,
            360,
            _pick(rng, ORGANIC_BGR),
            -1,
        )


def _heap(
    rng: np.random.Generator,
    img: np.ndarray,
    cx: float,
    base_y: float,
    width: float,
    height: float,
    count: int,
) -> None:
    for _ in range(count):
        u = rng.uniform(-1, 1)
        top = base_y - height * (1 - u * u)
        _waste_item(rng, img, cx + u * width / 2, rng.uniform(top, base_y), rng.uniform(9, 20))


def _scene_bin(rng: np.random.Generator, img: np.ndarray, kind: str, level: float) -> None:
    cx = int(IMG_W / 2 + rng.integers(-60, 60))
    bottom = int(rng.integers(IMG_H - 70, IMG_H - 30))
    if kind == "drum":
        w, h = int(rng.integers(150, 190)), int(rng.integers(200, 240))
        body = _pick(rng, [(40, 90, 170), (150, 90, 40), (60, 60, 60)])
    elif kind == "communal":
        w, h = int(rng.integers(320, 400)), int(rng.integers(170, 210))
        body = _pick(rng, [(40, 150, 200), (60, 110, 60), (110, 110, 110)])
    else:
        w, h = int(rng.integers(170, 210)), int(rng.integers(230, 270))
        body = _pick(rng, [(40, 110, 40), (40, 40, 40), (140, 80, 30)])
    top = bottom - h
    taper = 0 if kind == "drum" else int(w * 0.06)
    poly = np.array(
        [
            (cx - w // 2, top),
            (cx + w // 2, top),
            (cx + w // 2 - taper, bottom),
            (cx - w // 2 + taper, bottom),
        ],
        np.int32,
    )
    cv2.ellipse(img, (cx, bottom + 6), (w // 2 + 20, 14), 0, 0, 360, (35, 45, 55), -1)
    cv2.fillPoly(img, [poly], body)
    body_mask = np.zeros((IMG_H, IMG_W), np.uint8)
    cv2.fillPoly(body_mask, [poly], 255)
    grad = np.linspace(1.15, 0.7, IMG_W, dtype=np.float32)[None, :, None]
    img[:] = np.where(body_mask[:, :, None] > 0, img * grad, img)
    darker = tuple(c * 0.6 for c in body)
    if kind == "drum":
        for k in (0.3, 0.65):
            y = int(top + h * k)
            cv2.line(img, (cx - w // 2, y), (cx + w // 2, y), darker, 3)
    else:
        cv2.rectangle(img, (cx - w // 2 - 4, top - 6), (cx + w // 2 + 4, top + 6), darker, -1)
    rim = (cx, top)
    axes = (w // 2, max(10, int(w * 0.12)))
    cv2.ellipse(img, rim, axes, 0, 0, 360, (25, 25, 25), -1)
    opening = np.zeros((IMG_H, IMG_W), np.uint8)
    cv2.ellipse(opening, rim, (axes[0] - 4, axes[1] - 3), 0, 0, 360, 255, -1)
    inside = img.copy()
    visible = min(level, 1.0)
    if visible > 0.08:
        for _ in range(int(8 + 70 * visible * (w / 200))):
            _waste_item(
                rng,
                inside,
                rim[0] + rng.uniform(-axes[0], axes[0]),
                rim[1] + rng.uniform(-axes[1], axes[1]) + (1 - visible) * axes[1] * 0.8,
                rng.uniform(8, 16),
            )
        if visible < 0.6:
            alpha = (1 - visible / 0.6) * 0.6
            inside = inside * (1 - alpha) + np.full_like(inside, 25) * alpha
    img[:] = np.where(opening[:, :, None] > 0, inside, img)
    cv2.ellipse(img, rim, axes, 0, 0, 360, tuple(c * 0.55 for c in body), 3)
    if level >= 0.95:
        _heap(rng, img, rim[0], rim[1] + 4, w * 1.05, h * 0.35 * min(level, 1.3), int(60 * w / 200))
    if level > 1.0:
        for _ in range(int(140 * (level - 0.9))):
            side = _pick(rng, [-1, 1])
            _waste_item(
                rng,
                img,
                cx + side * rng.uniform(w * 0.4, w * 0.95),
                rng.uniform(bottom - 40, IMG_H - 5),
                rng.uniform(9, 18),
            )


def _scene_pile(rng: np.random.Generator, img: np.ndarray, horizon: int) -> None:
    cx = int(IMG_W / 2 + rng.integers(-80, 80))
    base = int(rng.integers(IMG_H - 90, IMG_H - 40))
    width = int(rng.integers(380, 560))
    height = int(rng.integers(130, 210))
    outline = [
        (cx + u * width / 2, base - height * (1 - u * u) * rng.uniform(0.8, 1.1))
        for u in np.linspace(-1, 1, 25)
    ]
    outline += [(cx + width / 2, base + 10), (cx - width / 2, base + 10)]
    cv2.fillPoly(img, [np.array(outline, np.int32)], (45, 60, 75))
    _heap(rng, img, cx, base, width, height, 420)
    for _ in range(60):
        _waste_item(
            rng, img, rng.uniform(0, IMG_W), rng.uniform(horizon + 20, IMG_H), rng.uniform(8, 14)
        )


def render_scene(kind: str, level: float, seed: int) -> bytes:
    rng = np.random.default_rng(seed)
    horizon = int(rng.integers(int(IMG_H * 0.35), int(IMG_H * 0.5)))
    img = _scene_background(rng, horizon)
    if kind == "pile":
        _scene_pile(rng, img, horizon)
    else:
        _scene_bin(rng, img, kind, level)
    light = np.linspace(rng.uniform(0.85, 1.15), rng.uniform(0.85, 1.15), IMG_W, dtype=np.float32)
    img *= light[None, :, None]
    yy, xx = np.mgrid[0:IMG_H, 0:IMG_W].astype(np.float32)
    img *= (1 - 0.7 * (((xx - IMG_W / 2) / IMG_W) ** 2 + ((yy - IMG_H / 2) / IMG_H) ** 2))[
        :, :, None
    ]
    soft = cv2.GaussianBlur(np.clip(img, 0, 255), (0, 0), 0.7)
    final = np.clip(soft + _texture(rng, img.shape, 6), 0, 255).astype(np.uint8)
    ok, buffer = cv2.imencode(".jpg", final, [cv2.IMWRITE_JPEG_QUALITY, 84])
    if not ok:
        raise RuntimeError("jpeg encode failed")
    return bytes(buffer.tobytes())


SCENE_LEVEL = {
    FillBand.EMPTY: 0.02,
    FillBand.LOW: 0.25,
    FillBand.HALF: 0.5,
    FillBand.HIGH: 0.78,
    FillBand.OVERFLOWING: 1.18,
}
SCENE_KIND = {"standard": "wheelie", "recycling": "wheelie", "drum": "drum", "communal": "communal"}


@dataclass(frozen=True)
class SceneImage:
    key: str
    data: bytes
    flags: dict[str, float]


def build_images(
    org_id: uuid.UUID,
) -> tuple[dict[tuple[str, FillBand], list[SceneImage]], list[SceneImage]]:
    by_bin: dict[tuple[str, FillBand], list[SceneImage]] = {}
    seed = 7000
    for kind in ("wheelie", "drum", "communal"):
        for band, level in SCENE_LEVEL.items():
            variants = []
            for _ in range(2):
                seed += 1
                variants.append(_scene_image(org_id, render_scene(kind, level, seed)))
            by_bin[(kind, band)] = variants
    piles = [_scene_image(org_id, render_scene("pile", 0.0, 9000 + i)) for i in range(8)]
    return by_bin, piles


def _scene_image(org_id: uuid.UUID, data: bytes) -> SceneImage:
    quality = assess_quality(decode_image(data))
    if not quality.ok:
        raise RuntimeError(f"synthetic scene failed the quality gate: {quality.flags}")
    digest = hashlib.sha256(data).hexdigest()
    return SceneImage(
        key=f"images/{org_id}/{digest}.jpg",
        data=data,
        flags={
            "brightness": round(quality.brightness, 1),
            "sharpness": round(quality.sharpness, 1),
        },
    )


@dataclass
class SiteRec:
    id: uuid.UUID
    name: str
    site_type: str
    ward: str
    lat: float
    lng: float
    bins: list[int] = field(default_factory=list)


@dataclass
class BinRec:
    id: uuid.UUID
    site: int
    ward: str
    site_type: str
    qr: str
    lat: float
    lng: float
    bin_type: str
    volume: int
    vehicle: int
    visits: float
    base_rate: float


@dataclass
class UserRec:
    id: uuid.UUID
    name: str
    phone: str
    role: UserRole
    wards: list[str]


@dataclass
class ObsRec:
    id: uuid.UUID
    captured_at: datetime
    synced_at: datetime
    lat: float
    lng: float
    source: LocationSource
    bin_index: int | None
    collector: uuid.UUID
    image: SceneImage
    tap: FillBand | None
    privacy: PrivacyStatus
    context: str
    ward: str


@dataclass
class DumpReport:
    observation: ObsRec
    hotspot: int | None
    review: DumpingReview | None
    reviewed_at: datetime | None
    reviewer: uuid.UUID | None


@dataclass
class Hotspot:
    ward: str
    lat: float
    lng: float
    scenario: str
    rate: float
    start: int
    cleanup_day: int | None
    one_off: bool
    interventions: list[tuple[int, InterventionKind]] = field(default_factory=list)


@dataclass
class World:
    org_id: uuid.UUID
    now: datetime
    today: date
    dates: list[date]
    density: float
    users: list[UserRec]
    sites: list[SiteRec]
    bins: list[BinRec]
    images_by_bin: dict[tuple[str, FillBand], list[SceneImage]]
    piles: list[SceneImage]
    rows: dict[str, list[tuple[Any, ...]]] = field(default_factory=lambda: defaultdict(list))
    counts: Counter[str] = field(default_factory=Counter)


COLUMNS: dict[str, tuple[str, ...]] = {
    "sites": ("id", "org_id", "created_at", "updated_at", "name", "site_type", "ward"),
    "bins": (
        "id",
        "org_id",
        "created_at",
        "updated_at",
        "site_id",
        "qr_code",
        "location",
        "volume_liters",
        "bin_type",
    ),
    "trucks": (
        "id",
        "org_id",
        "created_at",
        "updated_at",
        "name",
        "method",
        "capacity_kg",
        "fuel_l_per_100km",
        "depot",
        "active",
    ),
    "ml_models": (
        "id",
        "org_id",
        "created_at",
        "updated_at",
        "task",
        "version",
        "metrics",
        "active",
        "labels",
    ),
    "material_prices": (
        "id",
        "org_id",
        "created_at",
        "updated_at",
        "material",
        "kes_per_kg",
        "effective_date",
        "source",
    ),
    "recycling_partners": (
        "id",
        "org_id",
        "created_at",
        "updated_at",
        "name",
        "materials_accepted",
        "min_kg_per_month",
        "indicative_price_kes_per_kg",
        "contact",
    ),
    "observations": (
        "id",
        "org_id",
        "created_at",
        "updated_at",
        "captured_at",
        "synced_at",
        "location",
        "location_source",
        "bin_id",
        "collector_id",
        "image_ref",
        "image_sha256",
        "image_quality_flags",
        "human_fill_tap",
        "privacy_status",
        "quarantine_deleted_at",
    ),
    "predictions": (
        "id",
        "org_id",
        "created_at",
        "updated_at",
        "observation_id",
        "model_id",
        "task",
        "payload",
        "review_status",
        "corrected_payload",
        "reviewed_by",
    ),
    "routes": (
        "id",
        "org_id",
        "created_at",
        "updated_at",
        "date",
        "truck_id",
        "status",
        "planned_km",
        "planned_fuel_l",
        "demand_kg",
        "bins_served",
        "started_at",
        "started_by_user_id",
        "completed_at",
        "actual_distance_km",
        "actual_fuel_l",
        "actual_weight_kg",
    ),
    "route_stops": (
        "id",
        "org_id",
        "created_at",
        "updated_at",
        "route_id",
        "bin_id",
        "seq",
        "collected",
        "skipped_at",
        "skip_reason",
    ),
    "collection_events": (
        "id",
        "org_id",
        "created_at",
        "updated_at",
        "bin_id",
        "occurred_at",
        "collector_id",
        "post_observation_id",
        "route_stop_id",
        "estimated_weight_kg",
    ),
    "dumping_sites": (
        "id",
        "org_id",
        "created_at",
        "updated_at",
        "location",
        "area",
        "first_seen",
        "last_seen",
        "event_count",
        "status",
    ),
    "dumping_candidates": (
        "id",
        "org_id",
        "created_at",
        "updated_at",
        "observation_id",
        "review",
        "reviewed_by",
        "dumping_site_id",
    ),
    "dumping_events": (
        "id",
        "org_id",
        "created_at",
        "updated_at",
        "dumping_site_id",
        "observation_id",
        "occurred_at",
    ),
    "dumping_interventions": (
        "id",
        "org_id",
        "created_at",
        "updated_at",
        "dumping_site_id",
        "kind",
        "performed_on",
        "notes",
    ),
    "volunteer_events": (
        "id",
        "org_id",
        "created_at",
        "updated_at",
        "occurred_on",
        "event_type",
        "area",
        "site_id",
        "organizer",
        "participant_count",
        "hours_total",
        "materials_kg",
        "notes",
    ),
    "bin_health_daily": (
        "id",
        "org_id",
        "created_at",
        "updated_at",
        "bin_id",
        "date",
        "fill_pct",
        "fill_velocity_pct_per_day",
        "days_to_full",
        "days_since_collection",
        "overflow_risk",
        "recommendation",
    ),
    "cleanliness_daily": (
        "id",
        "org_id",
        "created_at",
        "updated_at",
        "site_id",
        "date",
        "score",
        "components",
    ),
}


def build_users(org_id: uuid.UUID) -> list[UserRec]:
    users = [
        UserRec(
            seed_id(org_id, "user", name), name, f"+2547991{i:05d}", UserRole.COORDINATOR, wards
        )
        for i, (name, wards) in enumerate(COORDINATORS, start=1)
    ]
    users += [
        UserRec(seed_id(org_id, "user", name), name, f"+2547991{i:05d}", UserRole.COLLECTOR, wards)
        for i, (name, wards) in enumerate(COLLECTORS, start=11)
    ]
    return users


def build_registry(
    org_id: uuid.UUID, osrm: Osrm
) -> tuple[list[SiteRec], list[BinRec], list[tuple[float, float]]]:
    rng = np.random.default_rng([SEED, 1])
    site_specs: list[tuple[str, str, str, tuple[float, float]]] = []
    for ward, center, sites in WARDS:
        for name, site_type in sites:
            radius = 900 if site_type == "collection_point" else 650
            site_specs.append(
                (name, site_type, ward, random_offset(rng, center[0], center[1], radius))
            )
    anchors = osrm.snap(
        [
            [spec[3]] + [random_offset(rng, spec[3][0], spec[3][1], 120) for _ in range(2)]
            for spec in site_specs
        ],
        60,
    )
    sites = [
        SiteRec(seed_id(org_id, "site", name), name, site_type, ward, lat, lng)
        for (name, site_type, ward, _), (lat, lng) in zip(site_specs, anchors, strict=True)
    ]

    raw = [
        int(rng.integers(BINS_PER_SITE[s.site_type][0], BINS_PER_SITE[s.site_type][1] + 1))
        if BINS_PER_SITE[s.site_type][1]
        else 0
        for s in sites
    ]
    scale = TARGET_BINS / sum(raw)
    counts = [round(n * scale) for n in raw]
    order = sorted(range(len(counts)), key=lambda i: -counts[i])
    k = 0
    while sum(counts) != TARGET_BINS:
        i = order[k % len(order)]
        counts[i] += 1 if sum(counts) < TARGET_BINS else -1
        k += 1

    lane_vehicle = {v.lanes_of: i for i, v in enumerate(VEHICLES) if v.lanes_of}
    ward_vehicle = {w: i for i, v in enumerate(VEHICLES) for w in v.wards}
    bin_specs: list[tuple[int, str, int, int]] = []
    candidates: list[list[tuple[float, float]]] = []
    for si, site in enumerate(sites):
        mix = BIN_MIX.get(site.site_type, BIN_MIX["default"])
        spread = SPREAD_M.get(site.site_type, 150)
        for _ in range(counts[si]):
            bin_type = weighted(rng, mix)
            volume = BIN_TYPES[bin_type]
            vehicle = ward_vehicle[site.ward]
            if site.ward in lane_vehicle and site.site_type == "lane" and volume <= 240:
                vehicle = lane_vehicle[site.ward]
            bin_specs.append((si, bin_type, volume, vehicle))
            candidates.append(
                [random_offset(rng, site.lat, site.lng, spread, 15) for _ in range(4)]
            )
    positions = osrm.snap(candidates, 45)

    bins: list[BinRec] = []
    for bi, ((si, bin_type, volume, vehicle), (lat, lng)) in enumerate(
        zip(bin_specs, positions, strict=True)
    ):
        site = sites[si]
        bin_id = seed_id(org_id, "bin", site.name, bi)
        bins.append(
            BinRec(
                id=bin_id,
                site=si,
                ward=site.ward,
                site_type=site.site_type,
                qr=base64.urlsafe_b64encode(hashlib.sha256(bin_id.bytes).digest()).decode()[:11],
                lat=lat,
                lng=lng,
                bin_type=bin_type,
                volume=volume,
                vehicle=vehicle,
                visits=VISITS_PER_DAY[site.site_type] * float(rng.lognormal(0, 0.25)) * VISIT_SCALE,
                base_rate=FILL_RATE[site.site_type] * float(rng.lognormal(0, 0.3)),
            )
        )
        site.bins.append(bi)

    depots = osrm.snap([[v.depot] for v in VEHICLES], 200)
    return sites, bins, depots


def dow_fill(site_type: str, weekday: int, market_days: tuple[int, int], holiday: bool) -> float:
    if site_type == "market":
        mult = 1.45 if weekday in market_days else (0.5 if weekday == 6 else 0.9)
    elif site_type == "school":
        mult = 0.2 if weekday >= 5 else 1.15
    elif site_type == "church":
        mult = 2.6 if weekday == 6 else 0.75
    elif site_type in ("estate", "residential", "lane"):
        mult = 1.25 if weekday >= 5 else 0.93
    elif site_type in ("stage", "commercial", "industrial"):
        mult = 0.55 if weekday == 6 else 1.08
    else:
        mult = 1.0
    if holiday:
        mult *= 0.8 if site_type != "market" else 0.6
    return mult


def order_stops(depot: tuple[float, float], points: list[tuple[float, float]]) -> list[int]:
    coords = np.array([depot, *points], dtype=float)
    lat0 = math.radians(depot[0])
    xy = np.column_stack(
        [
            np.radians(coords[:, 1]) * math.cos(lat0) * 6_371_000,
            np.radians(coords[:, 0]) * 6_371_000,
        ]
    )
    dist = np.sqrt(((xy[:, None, :] - xy[None, :, :]) ** 2).sum(-1))
    unvisited = set(range(1, len(coords)))
    tour = [0]
    while unvisited:
        last = tour[-1]
        nxt = min(unvisited, key=lambda j: dist[last, j])
        tour.append(nxt)
        unvisited.remove(nxt)
    path = np.array([*tour, 0])
    for _ in range(25):
        improved = False
        for i in range(1, len(path) - 2):
            a, b = path[i - 1], path[i]
            c, d = path[i + 1 : -1], path[i + 2 :]
            delta = dist[a, c] + dist[b, d] - dist[a, b] - dist[c, d]
            j = int(np.argmin(delta))
            if delta[j] < -1e-6:
                k = i + 1 + j
                path[i : k + 1] = path[i : k + 1][::-1].copy()
                improved = True
        if not improved:
            break
    return [int(p) - 1 for p in path[1:-1]]


@dataclass
class RouteRec:
    id: uuid.UUID
    vehicle: int
    day: int
    status: RouteStatus
    stops: list[int]
    demand_kg: float
    started_at: datetime | None
    completed_at: datetime | None
    stop_rows: list[tuple[uuid.UUID, int, bool, datetime | None, str | None]]
    collected_kg: float
    planned_km: float = 0.0


class Simulation:
    def __init__(self, world: World, depots: list[tuple[float, float]]) -> None:
        self.w = world
        self.depots = depots
        self.rng = np.random.default_rng([SEED, 2])
        n_bins = len(world.bins)
        n_days = len(world.dates)
        self.n_days = n_days
        self.collectors_by_ward: dict[str, list[UserRec]] = defaultdict(list)
        self.coordinator_by_ward: dict[str, UserRec] = {}
        for user in world.users:
            for ward in user.wards:
                if user.role is UserRole.COLLECTOR:
                    self.collectors_by_ward[ward].append(user)
                else:
                    self.coordinator_by_ward[ward] = user
        self.crew = [next(u for u in world.users if u.name == v.crew) for v in VEHICLES]
        market_days = [(i % 3, i % 3 + 3) for i in range(len(world.sites))]
        weekdays = [d.weekday() for d in world.dates]
        holidays = [(d.month, d.day) in HOLIDAYS for d in world.dates]
        rates = np.zeros((n_bins, n_days))
        for bi, b in enumerate(world.bins):
            mults = [
                dow_fill(b.site_type, wd, market_days[b.site], hol)
                for wd, hol in zip(weekdays, holidays, strict=True)
            ]
            rates[bi] = b.base_rate * np.array(mults) * self.rng.lognormal(0, 0.22, n_days)
        for vi, vehicle in enumerate(VEHICLES):
            members = [bi for bi, b in enumerate(world.bins) if b.vehicle == vi]
            generated = sum(
                world.bins[bi].volume * float(rates[bi].mean()) * world.density for bi in members
            )
            factor = vehicle.target_load * vehicle.capacity_kg * 6 / 7 / max(generated, 1.0)
            rates[members] *= min(max(factor, 0.5), 2.2)
        self.rates = rates
        self.cum = np.zeros((n_bins, n_days + 1))
        self.cum[:, 1:] = np.cumsum(rates, axis=1)
        deposit = np.array(DEPOSIT_BY_HOUR, dtype=float)
        self.deposit_cum = np.concatenate([[0.0], np.cumsum(deposit / deposit.sum())])
        self.coll_res = self.rng.uniform(0.05, 0.75, n_bins)
        self.coll_dep = np.zeros(n_bins)
        self.last_collection: list[datetime | None] = [None] * n_bins
        self.tap_series: list[list[tuple[datetime, float]]] = [[] for _ in range(n_bins)]
        self.latest_health: dict[int, tuple[float, OverflowRisk]] = {}
        self.site_obs: list[list[tuple[datetime, bool, bool]]] = [[] for _ in world.sites]
        self.observations: list[ObsRec] = []
        self.collections: list[dict[str, Any]] = []
        self.routes: list[RouteRec] = []
        self.health_rows: list[tuple[Any, ...]] = []
        self.clean_rows: list[tuple[Any, ...]] = []
        self.obs_counter = 0
        self.rainy = set(self.rng.choice(n_days - 1, size=6, replace=False).tolist())
        self.hour_keys = np.array(list(OBS_HOURS), dtype=float)
        hour_p = np.array(list(OBS_HOURS.values()), dtype=float)
        self.hour_p = hour_p / hour_p.sum()
        self.dumping_near: dict[int, list[int]] = {}
        self.dumping_timeline: dict[int, tuple[list[datetime], list[date]]] = {}

    def day_start(self, i: int) -> datetime:
        return datetime.combine(self.w.dates[i], dtime(0), EAT).astimezone(UTC)

    def at(self, i: int, hour: float) -> datetime:
        return self.day_start(i) + timedelta(hours=hour)

    def deposit(self, bi: int, i: int, hour: float) -> float:
        h = min(max(hour, 0.0), 23.999)
        base = int(h)
        frac = self.deposit_cum[base] + (h - base) * (
            self.deposit_cum[base + 1] - self.deposit_cum[base]
        )
        return float(self.cum[bi, i] + self.rates[bi, i] * frac)

    def level(self, bi: int, i: int, hour: float, today: tuple[float, float] | None) -> float:
        if today is not None and hour >= today[0]:
            value = today[1] + self.deposit(bi, i, hour) - self.deposit(bi, i, today[0])
        else:
            value = self.coll_res[bi] + self.deposit(bi, i, hour) - self.coll_dep[bi]
        return min(float(value), 1.35)

    def estimate_kg(self, bi: int) -> float:
        b = self.w.bins[bi]
        fill = self.latest_health[bi][0] if bi in self.latest_health else 100.0
        return round(fill / 100 * b.volume * self.w.density, 2)

    def new_obs_id(self) -> uuid.UUID:
        self.obs_counter += 1
        return seed_id(self.w.org_id, "obs", self.obs_counter)

    def sync_time(self, captured: datetime) -> datetime:
        roll = self.rng.random()
        if roll < 0.72:
            delay = self.rng.uniform(0.3, 6) * 60
        elif roll < 0.95:
            delay = self.rng.uniform(10, 180) * 60
        else:
            delay = self.rng.uniform(3, 20) * 3600
        return min(captured + timedelta(seconds=float(delay)), self.w.now - timedelta(seconds=5))

    def bin_observation(
        self, bi: int, captured: datetime, level: float, collector: uuid.UUID, post: bool = False
    ) -> ObsRec:
        b = self.w.bins[bi]
        roll = self.rng.random()
        tap: FillBand | None = None
        if post:
            tap = FillBand.EMPTY
        elif self.rng.random() > 0.06:
            tap = band_for(level + self.rng.normal(0, 0.06))
        scene_band = tap or band_for(level)
        image = _pick(self.rng, self.w.images_by_bin[(SCENE_KIND[b.bin_type], scene_band)])
        if roll < 0.06 and not post:
            lat, lng = random_offset(self.rng, b.lat, b.lng, 15, 3)
            source, bin_index = LocationSource.GPS, None
        elif roll < 0.15:
            lat, lng = b.lat, b.lng
            source, bin_index = LocationSource.BIN_REGISTRY, bi
        else:
            lat, lng = random_offset(self.rng, b.lat, b.lng, 12)
            source, bin_index = LocationSource.GPS, bi
        obs = ObsRec(
            id=self.new_obs_id(),
            captured_at=captured,
            synced_at=self.sync_time(captured),
            lat=lat,
            lng=lng,
            source=source,
            bin_index=bin_index,
            collector=collector,
            image=image,
            tap=tap,
            privacy=PrivacyStatus.BLURRED if self.rng.random() < 0.025 else PrivacyStatus.CLEAN,
            context=b.site_type,
            ward=b.ward,
        )
        self.observations.append(obs)
        return obs

    def ward_collector(self, ward: str) -> UserRec:
        if self.rng.random() < 0.06:
            return self.coordinator_by_ward[ward]
        return _pick(self.rng, self.collectors_by_ward[ward])

    def plan_routes(self, i: int) -> list[RouteRec]:
        planned = []
        due_by_vehicle: dict[int, list[int]] = defaultdict(list)
        for bi, (_fill, risk) in self.latest_health.items():
            if risk is not OverflowRisk.LOW:
                due_by_vehicle[self.w.bins[bi].vehicle].append(bi)
        for vi, vehicle in enumerate(VEHICLES):
            due = sorted(
                due_by_vehicle[vi],
                key=lambda bi: (
                    self.latest_health[bi][1] is not OverflowRisk.HIGH,
                    -self.latest_health[bi][0],
                    self.rng.random(),
                ),
            )
            stops: list[int] = []
            load = 0.0
            for bi in due:
                b = self.w.bins[bi]
                demand = max(1.0, self.latest_health[bi][0] / 100 * b.volume * self.w.density)
                if load + demand > vehicle.capacity_kg or len(stops) >= vehicle.max_stops:
                    continue
                stops.append(bi)
                load += demand
            if not stops:
                continue
            ordered = order_stops(
                self.depots[vi], [(self.w.bins[bi].lat, self.w.bins[bi].lng) for bi in stops]
            )
            planned.append(
                RouteRec(
                    id=seed_id(self.w.org_id, "route", vehicle.key, i - self.n_days + 1),
                    vehicle=vi,
                    day=i,
                    status=RouteStatus.PLANNED,
                    stops=[stops[k] for k in ordered],
                    demand_kg=round(load, 1),
                    started_at=None,
                    completed_at=None,
                    stop_rows=[],
                    collected_kg=0.0,
                )
            )
        return planned

    def record_collection(
        self,
        i: int,
        bi: int,
        hour: float,
        collector: uuid.UUID,
        stop: uuid.UUID | None,
        collected_today: dict[int, tuple[float, float, int]],
    ) -> None:
        collected_today[bi] = (hour, float(self.rng.uniform(0, 0.04)), len(self.collections))
        self.collections.append(
            {
                "bin": bi,
                "at": self.at(i, hour),
                "collector": collector,
                "stop": stop,
                "kg": self.estimate_kg(bi),
                "post": None,
            }
        )

    def run_route(
        self,
        route: RouteRec,
        i: int,
        start_hour: float,
        limit: float,
        collected_today: dict[int, tuple[float, float, int]],
    ) -> None:
        vehicle = VEHICLES[route.vehicle]
        crew = self.crew[route.vehicle]
        hour = start_hour + float(self.rng.uniform(0, 0.4))
        route.started_at = self.at(i, hour)
        position = self.depots[route.vehicle]
        density = self.w.density * float(self.rng.uniform(0.9, 1.25))
        rainy = i in self.rainy
        skip_p = 0.035 * (3 if rainy else 1)
        n = len(route.stops)
        pending = 0
        for seq, bi in enumerate(route.stops):
            b = self.w.bins[bi]
            hour += (
                haversine_m((position[1], position[0]), (b.lng, b.lat))
                * 1.35
                / 1000
                / vehicle.speed_kmh
            )
            position = (b.lat, b.lng)
            stop_id = seed_id(self.w.org_id, "stop", route.id, seq)
            if hour > limit:
                route.stop_rows.append((stop_id, bi, False, None, None))
                pending += 1
                continue
            if self.rng.random() < skip_p:
                if rainy and self.rng.random() < 0.6:
                    reason: str | None = "Road flooded after the rain"
                elif seq > 0.9 * n and self.rng.random() < 0.5:
                    reason = "Vehicle full, left for the next run"
                else:
                    reason = weighted(self.rng, dict(SKIP_REASONS))
                route.stop_rows.append((stop_id, bi, False, self.at(i, hour), reason))
                hour += 1 / 60
                continue
            route.collected_kg += min(self.level(bi, i, hour, None), 1.2) * b.volume * density
            self.record_collection(i, bi, hour, crew.id, stop_id, collected_today)
            route.stop_rows.append((stop_id, bi, True, None, None))
            hour += vehicle.service_min * (1.6 if b.volume >= 1000 else 1.0) / 60
        depot = self.depots[route.vehicle]
        hour += (
            haversine_m((position[1], position[0]), (depot[1], depot[0]))
            * 1.35
            / 1000
            / vehicle.speed_kmh
        )
        hour += float(self.rng.uniform(0.1, 0.4))
        if pending == 0 and hour <= limit:
            route.completed_at = self.at(i, hour)
            route.status = RouteStatus.DONE
        else:
            route.status = RouteStatus.ACTIVE

    def run(self) -> None:
        w = self.w
        last = self.n_days - 1
        route_start = self.n_days - ROUTE_DAYS - 1
        now_hours = (w.now - self.day_start(last)).total_seconds() / 3600
        for i, day in enumerate(w.dates):
            weekday = day.weekday()
            holiday = (day.month, day.day) in HOLIDAYS
            is_today = i == last
            limit = now_hours - 0.05 if is_today else 24.0
            collected_today: dict[int, tuple[float, float, int]] = {}
            if i < route_start:
                if not holiday and weekday < 6:
                    for bi, b in enumerate(w.bins):
                        slot = b.site % 6
                        slots = {slot, (slot + 3) % 6} if b.site_type == "market" else {slot}
                        if weekday not in slots:
                            continue
                        hour = VEHICLES[b.vehicle].start_hour + float(self.rng.uniform(0.3, 6.5))
                        self.record_collection(
                            i, bi, hour, self.crew[b.vehicle].id, None, collected_today
                        )
            else:
                if weekday < 6 and not holiday:
                    for route in self.plan_routes(i):
                        key = VEHICLES[route.vehicle].key
                        start = VEHICLES[route.vehicle].start_hour
                        if not is_today:
                            self.run_route(route, i, start, limit, collected_today)
                        elif key == "cart-mathare" and now_hours >= 11:
                            self.run_route(route, i, start, limit, collected_today)
                        elif key == "tuktuk" and now_hours >= 8:
                            self.run_route(
                                route, i, max(start, now_hours - 1.6), limit, collected_today
                            )
                        self.routes.append(route)
                for bi, b in enumerate(w.bins):
                    if bi in collected_today or self.level(bi, i, 11.0, None) <= 1.1:
                        continue
                    if self.rng.random() >= 0.07:
                        continue
                    hour = float(self.rng.uniform(10, 15))
                    if hour <= limit:
                        collector = _pick(self.rng, self.collectors_by_ward[b.ward])
                        self.record_collection(i, bi, hour, collector.id, None, collected_today)
            marks = [len(rows) for rows in self.site_obs]
            self.observe_day(i, weekday, holiday, limit, collected_today)
            for si, mark in enumerate(marks):
                if len(self.site_obs[si]) > mark + 1:
                    self.site_obs[si][mark:] = sorted(self.site_obs[si][mark:])
            for bi, (hour, residual, _index) in collected_today.items():
                self.coll_res[bi] = residual
                self.coll_dep[bi] = self.deposit(bi, i, hour)
                self.last_collection[bi] = self.at(i, hour)
            if not is_today:
                as_of = datetime.combine(day, dtime(23, 30), UTC)
                self.score_bins(i, as_of)
                self.score_sites(i, as_of)

    def observe_day(
        self,
        i: int,
        weekday: int,
        holiday: bool,
        limit: float,
        collected_today: dict[int, tuple[float, float, int]],
    ) -> None:
        mult = OBS_DOW[weekday] * (0.45 if holiday else 1.0)
        counts = self.rng.poisson(np.array([b.visits for b in self.w.bins]) * mult)
        for bi, b in enumerate(self.w.bins):
            hours = [
                float(h) + float(self.rng.uniform(0, 1))
                for h in self.rng.choice(self.hour_keys, size=int(counts[bi]), p=self.hour_p)
            ]
            visits: list[tuple[float, int | None]] = [(h, None) for h in hours]
            today = collected_today.get(bi)
            if today is not None and self.rng.random() < 0.18:
                visits.append((today[0] + float(self.rng.uniform(1, 4)) / 60, today[2]))
            visits.sort(key=lambda v: v[0])
            state = (today[0], today[1]) if today is not None else None
            for hour, post_of in visits:
                if hour > limit:
                    continue
                captured = self.at(i, hour)
                level = self.level(bi, i, hour, state)
                if post_of is not None:
                    collector = self.collections[post_of]["collector"]
                else:
                    collector = self.ward_collector(b.ward).id
                obs = self.bin_observation(bi, captured, level, collector, post_of is not None)
                if post_of is not None:
                    self.collections[post_of]["post"] = obs.id
                if obs.bin_index is not None:
                    if obs.tap is not None:
                        self.tap_series[bi].append((captured, BAND_PCT[obs.tap]))
                    self.site_obs[b.site].append(
                        (captured, obs.tap is not None, obs.tap in OVERFLOW_BANDS)
                    )

    def score_bins(self, i: int, as_of: datetime) -> None:
        cutoff = as_of - timedelta(days=LOOKBACK_DAYS)
        day = self.w.dates[i]
        for bi, b in enumerate(self.w.bins):
            last = self.last_collection[bi]
            picked: list[tuple[datetime, float]] = []
            for captured, pct in reversed(self.tap_series[bi]):
                if captured < cutoff or (last is not None and captured <= last):
                    break
                picked.append((captured, pct))
                if len(picked) == MAX_OBSERVATIONS:
                    break
            health = compute_health(picked, last, as_of)
            if health is None:
                continue
            self.latest_health[bi] = (health.fill_pct, health.risk)
            self.health_rows.append(
                (
                    seed_id(self.w.org_id, "health", b.id, day),
                    self.w.org_id,
                    as_of,
                    as_of,
                    b.id,
                    day,
                    health.fill_pct,
                    health.velocity_pct_per_day,
                    health.days_to_full,
                    health.days_since_collection,
                    health.risk.value,
                    health.recommendation,
                )
            )

    def score_sites(self, i: int, as_of: datetime) -> None:
        start = as_of - timedelta(days=WINDOW_DAYS)
        day = self.w.dates[i]
        for si, site in enumerate(self.w.sites):
            values: dict[str, float] = {}
            observations = 0
            if site.bins:
                rows = self.site_obs[si]
                times = [r[0] for r in rows]
                lo = bisect_left(times, start)
                window = rows[lo:]
                observations = len(window)
                taps = [r for r in window if r[1]]
                if taps:
                    values["overflow"] = 100 * (1 - sum(1 for r in taps if r[2]) / len(taps))
                risks = {
                    bi: self.latest_health[bi][1] for bi in site.bins if bi in self.latest_health
                }
                if risks:
                    high = [bi for bi, r in risks.items() if r is OverflowRisk.HIGH]
                    collected = sum(
                        1
                        for bi in high
                        if (lc := self.last_collection[bi]) is not None and lc >= start
                    )
                    values["reliability"] = 100.0 if not high else 100 * collected / len(high)
                penalty = 0.0
                for spot in self.dumping_near.get(si, []):
                    status, last_seen = self.dumping_state(spot, as_of)
                    if status is None or status is DumpingStatus.CLEANED or last_seen is None:
                        continue
                    days = (as_of - last_seen).total_seconds() / 86400
                    penalty += DUMPING_PENALTY_PER_SITE * 0.5 ** (max(0.0, days) / HALF_LIFE_DAYS)
                values["dumping"] = max(0.0, 100 - penalty)
            result = cleanliness_index(values, observations)
            self.clean_rows.append(
                (
                    seed_id(self.w.org_id, "cleanliness", site.id, day),
                    self.w.org_id,
                    as_of,
                    as_of,
                    site.id,
                    day,
                    result.score,
                    Jsonb({c.name: c.value for c in result.components}),
                )
            )

    def dumping_state(
        self, spot: int, as_of: datetime
    ) -> tuple[DumpingStatus | None, datetime | None]:
        events, cleanups = self.dumping_timeline[spot]
        seen = events[: bisect_right(events, as_of)]
        if not seen:
            return None, None
        done = [c for c in cleanups if c <= as_of.date()]
        if not done:
            return DumpingStatus.ACTIVE, seen[-1]
        if is_recurring(done, [e.date() for e in seen]):
            return DumpingStatus.RECURRING, seen[-1]
        return DumpingStatus.CLEANED, seen[-1]


def build_dumping(
    world: World, sim: Simulation, osrm: Osrm
) -> tuple[list[Hotspot], list[DumpReport]]:
    rng = np.random.default_rng([SEED, 3])
    n_days = len(world.dates)
    specs: list[tuple[str, tuple[float, float], str, bool]] = []
    scenarios = ["recurring"] * 10 + ["cleaned"] * 6 + ["active"] * 10
    rng.shuffle(scenarios)
    k = 0
    for ward, center, _sites in WARDS:
        per_ward = (
            3 if ward in ("Korogocho", "Mathare", "Dandora Area I", "Kariobangi North") else 1
        )
        if ward in ("Dandora Area III", "Huruma", "Umoja", "Lucky Summer"):
            per_ward = 2
        for _ in range(per_ward):
            if k >= len(scenarios):
                break
            specs.append(
                (ward, random_offset(rng, center[0], center[1], 700, 250), scenarios[k], False)
            )
            k += 1
    for i in range(n_days):
        for ward, center, _sites in WARDS:
            if rng.random() < 0.03:
                specs.append(
                    (ward, random_offset(rng, center[0], center[1], 900, 300), f"oneoff:{i}", True)
                )
    snapped = osrm.snap([[s[1]] for s in specs], 300)
    hotspots: list[Hotspot] = []
    for (ward, _point, scenario, one_off), (lat, lng) in zip(specs, snapped, strict=True):
        lat, lng = random_offset(rng, lat, lng, 20, 8)
        if one_off:
            day = int(scenario.split(":")[1])
            hotspots.append(Hotspot(ward, lat, lng, "oneoff", 0.0, day, None, True))
            continue
        start = int(rng.integers(0, 35))
        cleanup: int | None = None
        if scenario == "recurring":
            cleanup = int(rng.integers(n_days - 55, n_days - 25))
        elif scenario == "cleaned":
            cleanup = int(rng.integers(n_days - 20, n_days - 6))
        spot = Hotspot(
            ward, lat, lng, scenario, float(rng.uniform(0.12, 0.55)), start, cleanup, False
        )
        if cleanup is not None:
            spot.interventions.append((cleanup, InterventionKind.CLEANUP))
            if scenario == "recurring" and rng.random() < 0.7:
                spot.interventions.append(
                    (cleanup + int(rng.integers(1, 6)), InterventionKind.SIGNAGE)
                )
            if scenario == "cleaned" and rng.random() < 0.6:
                spot.interventions.append(
                    (cleanup + int(rng.integers(0, 3)), InterventionKind.BIN_ADDED)
                )
        if rng.random() < 0.35:
            spot.interventions.append(
                (int(rng.integers(start + 3, n_days - 2)), InterventionKind.ENGAGEMENT)
            )
        hotspots.append(spot)

    reports: list[DumpReport] = []
    last = n_days - 1
    now_hours = (world.now - sim.day_start(last)).total_seconds() / 3600
    hour_keys = np.array(list(OBS_HOURS), dtype=float)
    hour_p = np.array(list(OBS_HOURS.values()), dtype=float)
    hour_p /= hour_p.sum()
    report_dow = [1.3, 1.1, 1.0, 1.0, 0.95, 0.8, 0.4]
    for hi, spot in enumerate(hotspots):
        for i in range(spot.start, n_days):
            if spot.one_off:
                n = 1 if i == spot.start else 0
            else:
                rate = spot.rate * report_dow[world.dates[i].weekday()]
                if spot.cleanup_day is not None and i >= spot.cleanup_day:
                    if spot.scenario == "cleaned":
                        rate = 0.0
                    elif i < spot.cleanup_day + 5:
                        rate = 0.0
                    else:
                        rate *= 0.7
                n = int(rng.poisson(rate))
            for r in range(n):
                hour = float(rng.choice(hour_keys, p=hour_p)) + float(rng.uniform(0, 1))
                if i == last and hour > now_hours - 0.05:
                    continue
                collector = _pick(rng, sim.collectors_by_ward[spot.ward])
                reports.append(_dump_report(world, sim, rng, spot, hi, i, hour, collector, r > 0))
                if rng.random() < 0.12:
                    others = [c for c in sim.collectors_by_ward[spot.ward] if c.id != collector.id]
                    dup_hour = hour + float(rng.uniform(0.5, 5))
                    if others and not (i == last and dup_hour > now_hours - 0.05):
                        reports.append(
                            _dump_report(
                                world, sim, rng, spot, hi, i, dup_hour, _pick(rng, others), True
                            )
                        )
    return hotspots, reports


def _dump_report(
    world: World,
    sim: Simulation,
    rng: np.random.Generator,
    spot: Hotspot,
    hotspot_index: int,
    i: int,
    hour: float,
    collector: UserRec,
    duplicate: bool,
) -> DumpReport:
    captured = sim.at(i, hour)
    lat, lng = random_offset(rng, spot.lat, spot.lng, 22)
    obs = ObsRec(
        id=sim.new_obs_id(),
        captured_at=captured,
        synced_at=sim.sync_time(captured),
        lat=lat,
        lng=lng,
        source=LocationSource.GPS,
        bin_index=None,
        collector=collector.id,
        image=_pick(rng, world.piles),
        tap=None,
        privacy=PrivacyStatus.BLURRED if rng.random() < 0.05 else PrivacyStatus.CLEAN,
        context="pile",
        ward=spot.ward,
    )
    sim.observations.append(obs)
    reviewed_at = obs.synced_at + timedelta(hours=float(rng.uniform(1.5, 30)))
    if reviewed_at > world.now:
        return DumpReport(obs, hotspot_index, None, None, None)
    if duplicate:
        review = DumpingReview.DUPLICATE
    elif spot.one_off:
        review = DumpingReview.CONFIRMED if rng.random() < 0.45 else DumpingReview.REJECTED
    else:
        review = DumpingReview.CONFIRMED
    return DumpReport(
        obs, hotspot_index, review, reviewed_at, sim.coordinator_by_ward[spot.ward].id
    )


def build_world(org_id: uuid.UUID, now: datetime, density: float, osrm: Osrm) -> World:
    timings: dict[str, float] = {}
    started = time.monotonic()
    images_by_bin, piles = build_images(org_id)
    timings["images"] = time.monotonic() - started
    sites, bins, depots = build_registry(org_id, osrm)
    timings["registry"] = time.monotonic() - started
    today = now.date()
    world = World(
        org_id=org_id,
        now=now,
        today=today,
        dates=[today - timedelta(days=HISTORY_DAYS - 1 - i) for i in range(HISTORY_DAYS)],
        density=density,
        users=build_users(org_id),
        sites=sites,
        bins=bins,
        images_by_bin=images_by_bin,
        piles=piles,
    )
    sim = Simulation(world, depots)
    hotspots, reports = build_dumping(world, sim, osrm)
    timeline_events: dict[int, list[datetime]] = defaultdict(list)
    for report in reports:
        if report.review is DumpingReview.CONFIRMED and report.hotspot is not None:
            timeline_events[report.hotspot].append(report.observation.captured_at)
    sim.dumping_timeline = {
        hi: (
            sorted(timeline_events.get(hi, [])),
            [world.dates[d] for d, kind in spot.interventions if kind is InterventionKind.CLEANUP],
        )
        for hi, spot in enumerate(hotspots)
    }
    for si, site in enumerate(sites):
        if not site.bins:
            continue
        clat = sum(bins[bi].lat for bi in site.bins) / len(site.bins)
        clng = sum(bins[bi].lng for bi in site.bins) / len(site.bins)
        sim.dumping_near[si] = [
            hi
            for hi, spot in enumerate(hotspots)
            if haversine_m((clng, clat), (spot.lng, spot.lat)) <= DUMPING_RADIUS_M
        ]
    timings["dumping"] = time.monotonic() - started
    sim.run()
    timings["simulation"] = time.monotonic() - started
    with ThreadPoolExecutor(max_workers=8) as pool:
        kms = list(
            pool.map(
                osrm.route_km,
                [
                    [
                        depots[r.vehicle],
                        *((bins[bi].lat, bins[bi].lng) for bi in r.stops),
                        depots[r.vehicle],
                    ]
                    for r in sim.routes
                ],
            )
        )
    for route, km in zip(sim.routes, kms, strict=True):
        route.planned_km = km
    timings["routes"] = time.monotonic() - started
    emit_rows(world, sim, depots, hotspots, reports)
    timings["rows"] = time.monotonic() - started
    for key, value in timings.items():
        print(f"  build {key:12} {value:6.1f}s")
    return world


def emit_rows(
    world: World,
    sim: Simulation,
    depots: list[tuple[float, float]],
    hotspots: list[Hotspot],
    reports: list[DumpReport],
) -> None:
    org = world.org_id
    now = world.now
    rows = world.rows
    rng = np.random.default_rng([SEED, 4])
    registry_at = now - timedelta(days=HISTORY_DAYS + 20)

    for si, site in enumerate(world.sites):
        at = registry_at + timedelta(minutes=si)
        rows["sites"].append((site.id, org, at, at, site.name, site.site_type, site.ward))
    for bi, b in enumerate(world.bins):
        at = registry_at + timedelta(hours=2, seconds=bi * 7)
        rows["bins"].append(
            (
                b.id,
                org,
                at,
                at,
                world.sites[b.site].id,
                b.qr,
                ewkt(b.lat, b.lng),
                b.volume,
                b.bin_type,
            )
        )
    fleet_at = now - timedelta(days=ROUTE_DAYS + 12)
    truck_ids = [seed_id(org, "truck", v.key) for v in VEHICLES]
    for vi, v in enumerate(VEHICLES):
        rows["trucks"].append(
            (
                truck_ids[vi],
                org,
                fleet_at,
                fleet_at,
                v.name,
                v.method.value,
                v.capacity_kg,
                v.fuel_l_per_100km,
                ewkt(*depots[vi]),
                True,
            )
        )
    model_id = seed_id(org, "model", MODEL_VERSION)
    model_at = now - timedelta(days=HISTORY_DAYS + 5)
    rows["ml_models"].append(
        (
            model_id,
            org,
            model_at,
            model_at,
            PredictionTask.CLASSIFY.value,
            MODEL_VERSION,
            Jsonb({"macro_f1": 0.79, "accuracy": 0.84, "eval_images": 1840}),
            False,
            Jsonb(MATERIALS),
        )
    )
    first_of_month = now.date().replace(day=1)
    earlier = (first_of_month - timedelta(days=150)).replace(day=1)
    recent = (first_of_month - timedelta(days=40)).replace(day=1)
    for material, old_price, new_price, source in PRICES:
        for era, effective, price in (
            ("earlier", earlier, old_price),
            ("recent", recent, new_price),
        ):
            at = datetime.combine(effective, dtime(9), UTC)
            rows["material_prices"].append(
                (
                    seed_id(org, "price", material, era),
                    org,
                    at,
                    at,
                    material,
                    price,
                    effective,
                    source,
                )
            )
    for name, materials, min_kg, price, contact in PARTNERS:
        rows["recycling_partners"].append(
            (
                seed_id(org, "partner", name),
                org,
                registry_at,
                registry_at,
                name,
                Jsonb(materials),
                min_kg,
                price,
                contact,
            )
        )

    for obs in sim.observations:
        quarantine_cleared = (
            obs.synced_at + timedelta(hours=float(rng.uniform(60, 71)))
            if obs.privacy is PrivacyStatus.BLURRED
            else None
        )
        if quarantine_cleared is not None and quarantine_cleared > now:
            quarantine_cleared = None
        rows["observations"].append(
            (
                obs.id,
                org,
                obs.synced_at,
                obs.synced_at,
                obs.captured_at,
                obs.synced_at,
                ewkt(obs.lat, obs.lng),
                obs.source.value,
                world.bins[obs.bin_index].id if obs.bin_index is not None else None,
                obs.collector,
                obs.image.key,
                marker_sha(obs.id),
                Jsonb(obs.image.flags),
                obs.tap.value if obs.tap is not None else None,
                obs.privacy.value,
                quarantine_cleared,
            )
        )

    reviewer_by_ward = {
        ward: u.id for u in world.users if u.role is UserRole.COORDINATOR for ward in u.wards
    }
    span = (now - datetime.combine(world.dates[0], dtime(0), UTC)).total_seconds()
    for obs in sim.observations:
        if obs.context == "pile":
            chance = 0.9
        elif obs.tap in (FillBand.HALF, FillBand.HIGH, FillBand.OVERFLOWING):
            chance = 0.34
        elif obs.tap is FillBand.EMPTY and obs.bin_index is not None:
            chance = 0.0
        else:
            chance = 0.05
        if rng.random() >= chance:
            continue
        progress = (
            obs.captured_at - datetime.combine(world.dates[0], dtime(0), UTC)
        ).total_seconds() / span
        mix = dict(
            MATERIAL_MIX[
                MATERIAL_GROUP.get(obs.context, "pile" if obs.context == "pile" else "household")
            ]
        )
        mix["plastic"] = mix.get("plastic", 0) * (0.9 + 0.25 * progress)
        truth = weighted(rng, mix)
        logits = rng.normal(0, 0.8, len(MATERIALS))
        target = truth if rng.random() < ACCURACY[truth] else _pick(rng, CONFUSION[truth])
        logits[MATERIALS.index(target)] += (
            float(rng.normal(3.1, 1.0)) if target == truth else float(rng.normal(1.6, 0.6))
        )
        if target != truth:
            logits[MATERIALS.index(truth)] += float(rng.uniform(0.6, 1.3))
        probs = np.exp(logits - logits.max())
        probs /= probs.sum()
        best = int(np.argmax(probs))
        label = MATERIALS[best]
        confidence = round(float(probs[best]), 4)
        scores = {m: round(float(p), 4) for m, p in zip(MATERIALS, probs, strict=True)}
        created = obs.synced_at + timedelta(seconds=float(rng.uniform(3, 40)))
        if created > now:
            created = now
        delay_h = float(rng.uniform(0.5, 70)) * (0.35 + confidence)
        reviewed_at = created + timedelta(hours=delay_h)
        straggler = rng.random() < 0.012
        if reviewed_at > now or straggler:
            status, corrected, reviewer, updated = ReviewStatus.UNREVIEWED, None, None, created
        elif label == truth:
            status, corrected, reviewer, updated = (
                ReviewStatus.CONFIRMED,
                None,
                reviewer_by_ward[obs.ward],
                reviewed_at,
            )
        else:
            status, corrected, reviewer, updated = (
                ReviewStatus.CORRECTED,
                Jsonb({"material": truth}),
                reviewer_by_ward[obs.ward],
                reviewed_at,
            )
        rows["predictions"].append(
            (
                seed_id(org, "prediction", obs.id),
                org,
                created,
                updated,
                obs.id,
                model_id,
                PredictionTask.CLASSIFY.value,
                Jsonb({"material": label, "confidence": confidence, "scores": scores}),
                status.value,
                corrected,
                reviewer,
            )
        )

    for route in sim.routes:
        vehicle = VEHICLES[route.vehicle]
        day = world.dates[route.day]
        planned_at = min(datetime.combine(day, dtime(2, 45), UTC), now - timedelta(minutes=5))
        planned_at += timedelta(seconds=route.vehicle * 4)
        actual_km = actual_fuel = actual_kg = None
        if route.status is RouteStatus.DONE:
            actual_km = round(route.planned_km * float(rng.uniform(1.03, 1.16)), 2)
            actual_fuel = round(
                actual_km * vehicle.fuel_l_per_100km / 100 * float(rng.uniform(1.0, 1.18)), 2
            )
            actual_kg = round(route.collected_kg, 1)
        updated = route.completed_at or route.started_at or planned_at
        rows["routes"].append(
            (
                route.id,
                org,
                planned_at,
                updated,
                day,
                truck_ids[route.vehicle],
                route.status.value,
                route.planned_km,
                round(route.planned_km * vehicle.fuel_l_per_100km / 100, 2),
                route.demand_kg,
                len(route.stops),
                route.started_at,
                sim.crew[route.vehicle].id if route.started_at else None,
                route.completed_at,
                actual_km,
                actual_fuel,
                actual_kg,
            )
        )
        stop_rows = route.stop_rows or [
            (seed_id(org, "stop", route.id, seq), bi, False, None, None)
            for seq, bi in enumerate(route.stops)
        ]
        for seq, (stop_id, bi, collected, skipped_at, reason) in enumerate(stop_rows):
            touched = skipped_at or planned_at
            rows["route_stops"].append(
                (
                    stop_id,
                    org,
                    planned_at,
                    touched,
                    route.id,
                    world.bins[bi].id,
                    seq,
                    collected,
                    skipped_at,
                    reason,
                )
            )

    for n, c in enumerate(sim.collections):
        at = c["at"]
        rows["collection_events"].append(
            (
                seed_id(org, "collection", n),
                org,
                at,
                at,
                world.bins[c["bin"]].id,
                at,
                c["collector"],
                c["post"],
                c["stop"],
                c["kg"],
            )
        )

    confirmed: dict[int, list[DumpReport]] = defaultdict(list)
    for report in reports:
        if report.review is DumpingReview.CONFIRMED and report.hotspot is not None:
            confirmed[report.hotspot].append(report)
    site_ids: dict[int, uuid.UUID] = {}
    for hi, events in confirmed.items():
        spot = hotspots[hi]
        events.sort(key=lambda r: r.observation.captured_at)
        site_id = seed_id(org, "dumping-site", hi)
        site_ids[hi] = site_id
        first = events[0]
        cleanups = [
            world.dates[d] for d, kind in spot.interventions if kind is InterventionKind.CLEANUP
        ]
        cleanups = [d for d in cleanups if datetime.combine(d, dtime(12), UTC) <= now]
        event_dates = [r.observation.captured_at.date() for r in events]
        if not cleanups:
            status = DumpingStatus.ACTIVE
        elif is_recurring(cleanups, event_dates):
            status = DumpingStatus.RECURRING
        else:
            status = DumpingStatus.CLEANED
        rows["dumping_sites"].append(
            (
                site_id,
                org,
                first.reviewed_at,
                max(r.reviewed_at for r in events if r.reviewed_at is not None),
                ewkt(first.observation.lat, first.observation.lng),
                spot.ward,
                first.observation.captured_at,
                events[-1].observation.captured_at,
                len(events),
                status.value,
            )
        )
        for d, kind in spot.interventions:
            performed = world.dates[min(d, len(world.dates) - 1)]
            if performed < first.observation.captured_at.date():
                continue
            at = datetime.combine(performed, dtime(15), UTC)
            if at > now:
                continue
            rows["dumping_interventions"].append(
                (
                    seed_id(org, "intervention", hi, d, kind.value),
                    org,
                    at,
                    at,
                    site_id,
                    kind.value,
                    performed,
                    INTERVENTION_NOTES[kind],
                )
            )
    for report in reports:
        if report.review is None:
            continue
        obs = report.observation
        site_id_for = (
            site_ids.get(report.hotspot)
            if report.review is DumpingReview.CONFIRMED and report.hotspot is not None
            else None
        )
        rows["dumping_candidates"].append(
            (
                seed_id(org, "candidate", obs.id),
                org,
                report.reviewed_at,
                report.reviewed_at,
                obs.id,
                report.review.value,
                report.reviewer,
                site_id_for,
            )
        )
        if site_id_for is not None:
            rows["dumping_events"].append(
                (
                    seed_id(org, "dumping-event", obs.id),
                    org,
                    report.reviewed_at,
                    report.reviewed_at,
                    site_id_for,
                    obs.id,
                    obs.captured_at,
                )
            )
    for obs in sim.observations:
        if (
            obs.context == "pile"
            or obs.bin_index is not None
            or obs.source is not LocationSource.GPS
        ):
            continue
        reviewed_at = obs.synced_at + timedelta(hours=float(rng.uniform(2, 52)))
        if reviewed_at > now or rng.random() < 0.015:
            continue
        rows["dumping_candidates"].append(
            (
                seed_id(org, "candidate", obs.id),
                org,
                reviewed_at,
                reviewed_at,
                obs.id,
                DumpingReview.REJECTED.value,
                reviewer_by_ward[obs.ward],
                None,
            )
        )

    vrng = np.random.default_rng([SEED, 5])
    sites_by_ward: dict[str, list[SiteRec]] = defaultdict(list)
    for site in world.sites:
        sites_by_ward[site.ward].append(site)
    organizer_wards = list(ORGANIZERS)
    for n in range(48):
        days_ago = int(vrng.integers(1, 365))
        ward = _pick(vrng, organizer_wards)
        kind = weighted(
            vrng, {EventType.CLEANUP: 0.55, EventType.EDUCATION: 0.25, EventType.SORTING: 0.2}
        )
        people = int(vrng.integers(12, 81))
        hours = round(people * float(vrng.uniform(2, 4)), 1)
        materials: dict[str, float] = {}
        if kind is not EventType.EDUCATION:
            for material, lo, hi in (
                ("plastic", 20, 150),
                ("organic", 10, 90),
                ("paper", 5, 40),
                ("glass", 0, 25),
                ("metal", 0, 20),
                ("textile", 0, 15),
            ):
                kg = round(
                    float(vrng.uniform(lo, hi)) * (1.4 if kind is EventType.SORTING else 1.0), 1
                )
                if kg >= 1:
                    materials[material] = kg
        occurred = now.date() - timedelta(days=days_ago)
        at = datetime.combine(occurred, dtime(16), UTC)
        site = _pick(vrng, sites_by_ward[ward]) if vrng.random() < 0.6 else None
        rows["volunteer_events"].append(
            (
                seed_id(org, "volunteer", n),
                org,
                at,
                at,
                occurred,
                kind.value,
                ward,
                site.id if site else None,
                ORGANIZERS[ward],
                people,
                hours,
                Jsonb(materials),
                _pick(vrng, VOLUNTEER_NOTES[kind]),
            )
        )

    rows["bin_health_daily"] = sim.health_rows
    rows["cleanliness_daily"] = sim.clean_rows


SEEDED_ROOTS = (
    "seed_users",
    "seed_sites",
    "seed_trucks",
    "seed_models",
    "seed_prices",
    "seed_partners",
    "seed_volunteer",
    "seed_dumping_sites",
)


def root_ids(org_id: uuid.UUID) -> dict[str, list[uuid.UUID]]:
    return {
        "seed_users": [u.id for u in build_users(org_id)],
        "seed_sites": [
            seed_id(org_id, "site", name) for _w, _c, sites in WARDS for name, _t in sites
        ],
        "seed_trucks": [seed_id(org_id, "truck", v.key) for v in VEHICLES],
        "seed_models": [seed_id(org_id, "model", MODEL_VERSION)],
        "seed_prices": [
            seed_id(org_id, "price", material, era)
            for material, *_ in PRICES
            for era in ("earlier", "recent")
        ],
        "seed_partners": [seed_id(org_id, "partner", name) for name, *_ in PARTNERS],
        "seed_volunteer": [seed_id(org_id, "volunteer", n) for n in range(48)],
        "seed_dumping_sites": [seed_id(org_id, "dumping-site", n) for n in range(1000)],
    }


PURGE_STATEMENTS = [
    (
        "predictions",
        "DELETE FROM predictions WHERE observation_id IN (SELECT id FROM seed_obs) OR model_id IN (SELECT id FROM seed_models)",
    ),
    (
        "dumping_events",
        "DELETE FROM dumping_events WHERE observation_id IN (SELECT id FROM seed_obs) OR dumping_site_id IN (SELECT id FROM seed_dumping_sites)",
    ),
    (
        None,
        "UPDATE dumping_candidates SET dumping_site_id = NULL WHERE dumping_site_id IN (SELECT id FROM seed_dumping_sites) AND observation_id NOT IN (SELECT id FROM seed_obs)",
    ),
    (
        "dumping_candidates",
        "DELETE FROM dumping_candidates WHERE observation_id IN (SELECT id FROM seed_obs)",
    ),
    (
        "dumping_interventions",
        "DELETE FROM dumping_interventions WHERE dumping_site_id IN (SELECT id FROM seed_dumping_sites)",
    ),
    ("dumping_sites", "DELETE FROM dumping_sites WHERE id IN (SELECT id FROM seed_dumping_sites)"),
    (
        None,
        "UPDATE collection_events SET route_stop_id = NULL WHERE route_stop_id IN (SELECT id FROM seed_stops) AND bin_id NOT IN (SELECT id FROM seed_bins)",
    ),
    (
        None,
        "UPDATE collection_events SET post_observation_id = NULL WHERE post_observation_id IN (SELECT id FROM seed_obs) AND bin_id NOT IN (SELECT id FROM seed_bins)",
    ),
    (
        "collection_events",
        "DELETE FROM collection_events WHERE bin_id IN (SELECT id FROM seed_bins)",
    ),
    ("route_stops", "DELETE FROM route_stops WHERE id IN (SELECT id FROM seed_stops)"),
    ("routes", "DELETE FROM routes WHERE truck_id IN (SELECT id FROM seed_trucks)"),
    ("trucks", "DELETE FROM trucks WHERE id IN (SELECT id FROM seed_trucks)"),
    ("bin_health_daily", "DELETE FROM bin_health_daily WHERE bin_id IN (SELECT id FROM seed_bins)"),
    ("observations", "DELETE FROM observations WHERE id IN (SELECT id FROM seed_obs)"),
    ("bins", "DELETE FROM bins WHERE id IN (SELECT id FROM seed_bins)"),
    (
        "cleanliness_daily",
        "DELETE FROM cleanliness_daily WHERE site_id IN (SELECT id FROM seed_sites)",
    ),
    (
        None,
        "UPDATE volunteer_events SET site_id = NULL WHERE site_id IN (SELECT id FROM seed_sites) AND id NOT IN (SELECT id FROM seed_volunteer)",
    ),
    (
        "volunteer_events",
        "DELETE FROM volunteer_events WHERE id IN (SELECT id FROM seed_volunteer)",
    ),
    ("sites", "DELETE FROM sites WHERE id IN (SELECT id FROM seed_sites)"),
    ("material_prices", "DELETE FROM material_prices WHERE id IN (SELECT id FROM seed_prices)"),
    (
        "recycling_partners",
        "DELETE FROM recycling_partners WHERE id IN (SELECT id FROM seed_partners)",
    ),
    ("ml_models", "DELETE FROM ml_models WHERE id IN (SELECT id FROM seed_models)"),
    (
        "users",
        "DELETE FROM users u WHERE u.id IN (SELECT id FROM seed_users)"
        " AND NOT EXISTS (SELECT 1 FROM audit_log a WHERE a.actor_user_id = u.id)"
        " AND NOT EXISTS (SELECT 1 FROM observations o WHERE o.collector_id = u.id)"
        " AND NOT EXISTS (SELECT 1 FROM collection_events c WHERE c.collector_id = u.id)"
        " AND NOT EXISTS (SELECT 1 FROM predictions p WHERE p.reviewed_by = u.id)"
        " AND NOT EXISTS (SELECT 1 FROM routes r WHERE r.started_by_user_id = u.id)"
        " AND NOT EXISTS (SELECT 1 FROM dumping_candidates d WHERE d.reviewed_by = u.id)",
    ),
    (
        "users (retired)",
        "UPDATE users SET deleted_at = now(), token_version = token_version + 1 WHERE id IN (SELECT id FROM seed_users) AND deleted_at IS NULL",
    ),
]


def purge(cur: psycopg.Cursor[Any], org_id: uuid.UUID) -> tuple[dict[str, int], set[str]]:
    roots = root_ids(org_id)
    for name in SEEDED_ROOTS:
        cur.execute(f"CREATE TEMP TABLE {name} (id uuid PRIMARY KEY) ON COMMIT DROP")
        if roots[name]:
            with cur.copy(f"COPY {name} (id) FROM STDIN") as copy:
                for value in roots[name]:
                    copy.write_row((value,))
    cur.execute("CREATE TEMP TABLE seed_bins (id uuid PRIMARY KEY) ON COMMIT DROP")
    cur.execute(
        "INSERT INTO seed_bins SELECT id FROM bins WHERE org_id = %(org)s AND site_id IN (SELECT id FROM seed_sites)",
        {"org": org_id},
    )
    cur.execute(
        "CREATE TEMP TABLE seed_obs (id uuid PRIMARY KEY, image_ref text, marked bool) ON COMMIT DROP"
    )
    cur.execute(
        "INSERT INTO seed_obs SELECT id, image_ref,"
        " image_sha256 = encode(sha256(convert_to(%(marker)s || id::text, 'UTF8')), 'hex')"
        " FROM observations WHERE org_id = %(org)s"
        " AND (image_sha256 = encode(sha256(convert_to(%(marker)s || id::text, 'UTF8')), 'hex')"
        " OR bin_id IN (SELECT id FROM seed_bins))",
        {"org": org_id, "marker": f"{MARKER}:"},
    )
    cur.execute("CREATE TEMP TABLE seed_stops (id uuid PRIMARY KEY) ON COMMIT DROP")
    cur.execute(
        "INSERT INTO seed_stops SELECT id FROM route_stops WHERE route_id IN"
        " (SELECT id FROM routes WHERE truck_id IN (SELECT id FROM seed_trucks))"
        " OR bin_id IN (SELECT id FROM seed_bins)"
    )
    cur.execute("ANALYZE seed_obs; ANALYZE seed_bins; ANALYZE seed_stops")
    cur.execute("SELECT DISTINCT image_ref FROM seed_obs WHERE marked")
    image_keys = {row[0] for row in cur.fetchall()}
    counts: dict[str, int] = {}
    for table, statement in PURGE_STATEMENTS:
        cur.execute(statement)
        if table is not None:
            counts[table] = cur.rowcount
    if image_keys:
        cur.execute(
            "SELECT DISTINCT image_ref FROM observations WHERE image_ref = ANY(%s)",
            (list(image_keys),),
        )
        image_keys -= {row[0] for row in cur.fetchall()}
    return counts, image_keys


def copy_rows(cur: psycopg.Cursor[Any], table: str, rows: list[tuple[Any, ...]]) -> None:
    columns = COLUMNS[table]
    with cur.copy(f"COPY {table} ({', '.join(columns)}) FROM STDIN") as copy:
        for row in rows:
            copy.write_row(row)


def upsert_users(cur: psycopg.Cursor[Any], world: World) -> None:
    joined = world.now - timedelta(days=HISTORY_DAYS + 30)
    cur.executemany(
        "INSERT INTO users (id, org_id, created_at, updated_at, name, phone, role)"
        " VALUES (%s, %s, %s, %s, %s, %s, %s)"
        " ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, phone = EXCLUDED.phone,"
        " role = EXCLUDED.role, deleted_at = NULL, updated_at = now()",
        [(u.id, world.org_id, joined, joined, u.name, u.phone, u.role.value) for u in world.users],
    )


def resolve_org(cur: psycopg.Cursor[Any], explicit: str | None) -> tuple[uuid.UUID, str]:
    if explicit:
        cur.execute("SELECT id, name FROM organizations WHERE id = %s", (explicit,))
    else:
        if not settings.admin_phone:
            raise SystemExit("OWI_ADMIN_PHONE is unset; pass --org <uuid>")
        cur.execute(
            "SELECT o.id, o.name FROM users u JOIN organizations o ON o.id = u.org_id"
            " WHERE u.phone = %s AND u.deleted_at IS NULL",
            (settings.admin_phone,),
        )
    row = cur.fetchone()
    if row is None:
        raise SystemExit("organization not found")
    return row[0], row[1]


def org_density(cur: psycopg.Cursor[Any], org_id: uuid.UUID) -> float:
    cur.execute("SELECT waste_density_kg_per_l FROM org_settings WHERE org_id = %s", (org_id,))
    row = cur.fetchone()
    return float(row[0]) if row and row[0] is not None else settings.waste_density_kg_per_l


def check_phones(cur: psycopg.Cursor[Any], org_id: uuid.UUID) -> None:
    users = build_users(org_id)
    cur.execute(
        "SELECT phone FROM users WHERE phone = ANY(%s) AND NOT (id = ANY(%s))",
        ([u.phone for u in users], [u.id for u in users]),
    )
    taken = [row[0] for row in cur.fetchall()]
    if taken:
        raise SystemExit(f"seed phone numbers already belong to other users: {taken}")


SEEDED_OBS = (
    "image_sha256 = encode(sha256(convert_to(%(marker)s || {alias}id::text, 'UTF8')), 'hex')"
)
COUNT_QUERIES = {
    "users": "SELECT count(*) FROM users WHERE id = ANY(%(users)s) AND deleted_at IS NULL",
    "sites": "SELECT count(*) FROM sites WHERE id = ANY(%(sites)s)",
    "sites without bins": "SELECT count(*) FROM sites s WHERE s.id = ANY(%(sites)s)"
    " AND NOT EXISTS (SELECT 1 FROM bins b WHERE b.site_id = s.id)",
    "bins": "SELECT count(*) FROM bins WHERE site_id = ANY(%(sites)s)",
    "observations": "SELECT count(*) FROM observations WHERE org_id = %(org)s AND "
    + SEEDED_OBS.format(alias=""),
    "observations gps-only": "SELECT count(*) FROM observations WHERE org_id = %(org)s"
    " AND bin_id IS NULL AND " + SEEDED_OBS.format(alias=""),
    "predictions": "SELECT count(*) FROM predictions WHERE model_id = ANY(%(models)s)",
    "predictions unreviewed": "SELECT count(*) FROM predictions"
    " WHERE model_id = ANY(%(models)s) AND review_status = 'unreviewed'",
    "collection_events": "SELECT count(*) FROM collection_events c JOIN bins b ON b.id = c.bin_id"
    " WHERE b.site_id = ANY(%(sites)s)",
    "trucks": "SELECT count(*) FROM trucks WHERE id = ANY(%(trucks)s)",
    "routes": "SELECT count(*) FROM routes WHERE truck_id = ANY(%(trucks)s)",
    "route_stops": "SELECT count(*) FROM route_stops s JOIN routes r ON r.id = s.route_id"
    " WHERE r.truck_id = ANY(%(trucks)s)",
    "bin_health_daily": "SELECT count(*) FROM bin_health_daily h JOIN bins b ON b.id = h.bin_id"
    " WHERE b.site_id = ANY(%(sites)s)",
    "cleanliness_daily": "SELECT count(*) FROM cleanliness_daily WHERE site_id = ANY(%(sites)s)",
    "dumping_sites": "SELECT count(*) FROM dumping_sites WHERE id = ANY(%(dumping)s)",
    "dumping_candidates": "SELECT count(*) FROM dumping_candidates d"
    " JOIN observations o ON o.id = d.observation_id WHERE o.org_id = %(org)s AND "
    + SEEDED_OBS.format(alias="o."),
    "dumping_events": "SELECT count(*) FROM dumping_events WHERE dumping_site_id = ANY(%(dumping)s)",
    "dumping_interventions": "SELECT count(*) FROM dumping_interventions"
    " WHERE dumping_site_id = ANY(%(dumping)s)",
    "volunteer_events": "SELECT count(*) FROM volunteer_events WHERE id = ANY(%(volunteer)s)",
    "material_prices": "SELECT count(*) FROM material_prices WHERE id = ANY(%(prices)s)",
    "recycling_partners": "SELECT count(*) FROM recycling_partners WHERE id = ANY(%(partners)s)",
    "ml_models": "SELECT count(*) FROM ml_models WHERE id = ANY(%(models)s)",
}


def report_counts(cur: psycopg.Cursor[Any], org_id: uuid.UUID) -> None:
    roots = root_ids(org_id)
    params = {
        "org": org_id,
        "marker": f"{MARKER}:",
        "users": roots["seed_users"],
        "sites": roots["seed_sites"],
        "models": roots["seed_models"],
        "trucks": roots["seed_trucks"],
        "volunteer": roots["seed_volunteer"],
        "partners": roots["seed_partners"],
        "prices": roots["seed_prices"],
        "dumping": roots["seed_dumping_sites"],
    }
    for label, sql in COUNT_QUERIES.items():
        cur.execute(sql, params)
        row = cur.fetchone()
        print(f"  {label:24} {row[0] if row else 0}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Heavy demo dataset for the admin's organization")
    parser.add_argument(
        "--purge", action="store_true", help="remove exactly the seeded rows and images"
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="build the dataset and print counts only"
    )
    parser.add_argument(
        "--org", help="target organization id (default: the OWI_ADMIN_PHONE user's org)"
    )
    args = parser.parse_args()
    started = time.monotonic()
    dsn = settings.database_url.replace("postgresql+psycopg://", "postgresql://")
    store = get_store(settings)
    with psycopg.connect(dsn, autocommit=True) as conn, conn.cursor() as cur:
        org_id, org_name = resolve_org(cur, args.org)
        print(f"organization: {org_name} ({org_id})")
        if args.purge:
            with conn.transaction():
                counts, image_keys = purge(cur, org_id)
            image_keys |= {img.key for img in _all_images(org_id)}
            cur.execute(
                "SELECT DISTINCT image_ref FROM observations WHERE image_ref = ANY(%s)",
                (list(image_keys),),
            )
            image_keys -= {row[0] for row in cur.fetchall()}
            for key in sorted(image_keys):
                store.delete(key)
            for table, n in counts.items():
                print(f"  purged {table:24} {n}")
            print(f"  purged images            {len(image_keys)}")
            print(f"done in {time.monotonic() - started:.1f}s")
            return

        if not settings.osrm_url:
            raise SystemExit("OWI_OSRM_URL is unset; bins must be snapped to roads with OSRM")
        check_phones(cur, org_id)
        now = datetime.now(UTC)
        world = build_world(org_id, now, org_density(cur, org_id), Osrm(settings.osrm_url))
        if args.dry_run:
            for table, rows in world.rows.items():
                print(f"  {table:24} {len(rows)}")
            return
        images = _unique_images(world)
        for image in images:
            store.put(image.key, image.data, "image/jpeg")
        print(f"  uploaded {len(images)} images ({time.monotonic() - started:.1f}s)")
        with conn.transaction():
            counts, stale_images = purge(cur, org_id)
            print(
                f"  cleared previous seed: {sum(counts.values())} rows ({time.monotonic() - started:.1f}s)"
            )
            upsert_users(cur, world)
            for table in COLUMNS:
                copy_rows(cur, table, world.rows.get(table, []))
            print(
                f"  inserted {sum(len(r) for r in world.rows.values())} rows ({time.monotonic() - started:.1f}s)"
            )
        for key in stale_images - {image.key for image in images}:
            store.delete(key)
        cur.execute(f"ANALYZE {', '.join(COLUMNS)}, users")

    with SessionLocal() as session:
        scored = refresh_bin_health(session)
        areas = refresh_cleanliness(session)
    print(
        f"  refresh: {scored} bins scored, {areas} areas scored ({time.monotonic() - started:.1f}s)"
    )
    with psycopg.connect(dsn, autocommit=True) as conn, conn.cursor() as cur:
        report_counts(cur, org_id)
    print(f"done in {time.monotonic() - started:.1f}s")


def _unique_images(world: World) -> list[SceneImage]:
    seen: dict[str, SceneImage] = {}
    for variants in world.images_by_bin.values():
        for image in variants:
            seen[image.key] = image
    for image in world.piles:
        seen[image.key] = image
    return list(seen.values())


def _all_images(org_id: uuid.UUID) -> list[SceneImage]:
    by_bin, piles = build_images(org_id)
    return [img for variants in by_bin.values() for img in variants] + piles


if __name__ == "__main__":
    main()
