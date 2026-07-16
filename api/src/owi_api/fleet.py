"""Collection-method catalog: adding a method here is all the backend needs."""

from collections.abc import Iterable
from dataclasses import dataclass

from owi_api.models.enums import CollectionMethod


@dataclass(frozen=True)
class MethodSpec:
    motorized: bool
    default_capacity_kg: float
    default_fuel_l_per_100km: float


METHOD_SPECS: dict[CollectionMethod, MethodSpec] = {
    CollectionMethod.TRUCK: MethodSpec(True, 2000.0, 25.0),
    CollectionMethod.TRICYCLE: MethodSpec(True, 800.0, 6.0),
    CollectionMethod.MOTORBIKE: MethodSpec(True, 150.0, 3.5),
    CollectionMethod.BICYCLE: MethodSpec(False, 80.0, 0.0),
    CollectionMethod.HANDCART: MethodSpec(False, 120.0, 0.0),
    CollectionMethod.ON_FOOT: MethodSpec(False, 40.0, 0.0),
}


def resolve_capacity(method: CollectionMethod, capacity_kg: float | None) -> float:
    return METHOD_SPECS[method].default_capacity_kg if capacity_kg is None else capacity_kg


def resolve_fuel(method: CollectionMethod, fuel_l_per_100km: float | None) -> float:
    # Non-motorized methods never burn fuel, whatever the request claims.
    spec = METHOD_SPECS[method]
    if not spec.motorized:
        return 0.0
    return spec.default_fuel_l_per_100km if fuel_l_per_100km is None else fuel_l_per_100km


def fleet_fuel_rate(vehicles: Iterable[tuple[CollectionMethod, float]]) -> float:
    """Mean L/100km over motorized vehicles only — an all-manual fleet burns nothing."""
    rates = [fuel for method, fuel in vehicles if METHOD_SPECS[method].motorized]
    return sum(rates) / len(rates) if rates else 0.0
