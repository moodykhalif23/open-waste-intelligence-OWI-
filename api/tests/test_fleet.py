from owi_api.fleet import METHOD_SPECS, fleet_fuel_rate, resolve_capacity, resolve_fuel
from owi_api.models.enums import CollectionMethod


def test_every_method_has_a_spec() -> None:
    assert set(METHOD_SPECS) == set(CollectionMethod)


def test_manual_methods_never_burn_fuel() -> None:
    assert resolve_fuel(CollectionMethod.HANDCART, 12.0) == 0.0
    assert resolve_fuel(CollectionMethod.ON_FOOT, None) == 0.0
    assert resolve_fuel(CollectionMethod.BICYCLE, None) == 0.0


def test_motorized_fuel_default_and_override() -> None:
    assert resolve_fuel(CollectionMethod.TRUCK, None) == 25.0
    assert resolve_fuel(CollectionMethod.TRUCK, 18.0) == 18.0
    assert resolve_fuel(CollectionMethod.TRICYCLE, None) == 6.0


def test_capacity_default_and_override() -> None:
    assert resolve_capacity(CollectionMethod.HANDCART, None) == 120.0
    assert resolve_capacity(CollectionMethod.HANDCART, 200.0) == 200.0


def test_fleet_fuel_rate_averages_motorized_only() -> None:
    mixed = [
        (CollectionMethod.TRUCK, 30.0),
        (CollectionMethod.TRICYCLE, 6.0),
        (CollectionMethod.HANDCART, 0.0),
    ]
    assert fleet_fuel_rate(mixed) == 18.0


def test_fleet_fuel_rate_zero_for_all_manual_fleet() -> None:
    manual = [(CollectionMethod.HANDCART, 0.0), (CollectionMethod.ON_FOOT, 0.0)]
    assert fleet_fuel_rate(manual) == 0.0
