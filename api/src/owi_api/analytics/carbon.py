import csv
from dataclasses import dataclass
from functools import lru_cache
from importlib.resources import files

# Bump when factors or method change; every result carries this so numbers stay reproducible.
METHOD_VERSION = "carbon-v1"
# The value chains photo composition x tonnage x factors, so report a band, never a point.
UNCERTAINTY = 0.30
LANDFILL_DENSITY_KG_PER_M3 = 600.0
# Communication equivalents (secondary, always shown with ≈).
CO2E_PER_TREE_YEAR_KG = 21.77  # US EPA — one urban tree, 1 year
CO2E_PER_CAR_KM_KG = 0.192  # US EPA — average passenger vehicle


@dataclass(frozen=True)
class MaterialCarbon:
    material: str
    kg: float
    co2e_kg: float


@dataclass(frozen=True)
class CarbonReport:
    method_version: str
    co2e_avoided_kg: float
    co2e_low_kg: float
    co2e_high_kg: float
    landfill_m3_saved: float
    plastic_diverted_kg: float
    trees_equivalent: float
    car_km_equivalent: float
    materials: list[MaterialCarbon]


@lru_cache(maxsize=1)
def load_factors() -> dict[str, float]:
    text = files("owi_api.data").joinpath("carbon-factors-v1.csv").read_text(encoding="utf-8")
    return {
        row["material"]: float(row["co2e_kg_per_kg"]) for row in csv.DictReader(text.splitlines())
    }


def carbon_report(kg_by_material: dict[str, float], factors: dict[str, float]) -> CarbonReport:
    """CO2e avoided from recycled weights x cited factors - informational, never offsets."""
    materials: list[MaterialCarbon] = []
    total_co2e = 0.0
    total_kg = 0.0
    for material, kg in sorted(kg_by_material.items(), key=lambda kv: -kv[1]):
        co2e = round(kg * factors.get(material, 0.0), 1)
        total_co2e += co2e
        total_kg += kg
        materials.append(MaterialCarbon(material, round(kg, 1), co2e))
    return CarbonReport(
        method_version=METHOD_VERSION,
        co2e_avoided_kg=round(total_co2e, 1),
        co2e_low_kg=round(total_co2e * (1 - UNCERTAINTY), 1),
        co2e_high_kg=round(total_co2e * (1 + UNCERTAINTY), 1),
        landfill_m3_saved=round(total_kg / LANDFILL_DENSITY_KG_PER_M3, 2),
        plastic_diverted_kg=round(kg_by_material.get("plastic", 0.0), 1),
        trees_equivalent=round(total_co2e / CO2E_PER_TREE_YEAR_KG, 1),
        car_km_equivalent=round(total_co2e / CO2E_PER_CAR_KM_KG),
        materials=materials,
    )
