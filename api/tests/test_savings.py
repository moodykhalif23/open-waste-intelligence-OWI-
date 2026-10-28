import uuid
from types import SimpleNamespace
from typing import Any

import pytest
from fastapi import HTTPException

from owi_api.analytics.savings import Scenario, compute_savings
from owi_api.models.enums import CollectionMethod, UserRole
from owi_api.routers import routes
from owi_api.security import TokenClaims


def test_need_driven_beats_full_sweep_on_km_per_tonne() -> None:
    # Full sweep: 100 km for 2 t (much of it near-empty) → 50 km/t.
    # Need-driven: 40 km for 1.5 t (only full bins) → ~26.7 km/t.
    report = compute_savings(
        Scenario(km=100, kg=2000, fuel_l=25),
        Scenario(km=40, kg=1500, fuel_l=10),
    )
    assert report.baseline_km_per_tonne == 50.0
    assert report.optimized_km_per_tonne == 26.67
    assert report.km_per_tonne_reduction_pct == 46.7
    assert report.fuel_l_saved == 15.0
    assert report.kes_saved is None


def test_kes_saved_when_price_supplied() -> None:
    report = compute_savings(
        Scenario(km=100, kg=2000, fuel_l=25),
        Scenario(km=40, kg=1500, fuel_l=10),
        fuel_price_kes_per_l=200,
    )
    assert report.kes_saved == 3000.0


def test_zero_tonnes_yields_no_ratio() -> None:
    report = compute_savings(Scenario(0, 0, 0), Scenario(0, 0, 0))
    assert report.baseline_km_per_tonne is None
    assert report.km_per_tonne_reduction_pct is None


def test_unsolvable_savings_plan_is_a_422_not_a_crash(monkeypatch: pytest.MonkeyPatch) -> None:
    truck = SimpleNamespace(method=CollectionMethod.TRUCK, fuel_l_per_100km=25.0)

    def unsolvable(*_args: Any) -> Scenario:
        raise ValueError("no feasible route plan found")

    monkeypatch.setattr(routes, "_active_trucks", lambda _s, _o: [truck])
    monkeypatch.setattr(routes, "_depot", lambda _s, _t: (36.82, -1.29))
    monkeypatch.setattr(routes, "_collect_today_bins", lambda _s, _o: [])
    monkeypatch.setattr(routes, "_bin_demand", lambda _s, _o, _ids: [])
    monkeypatch.setattr(routes, "_scenario", unsolvable)
    claims = TokenClaims(uuid.uuid4(), uuid.uuid4(), UserRole.ADMIN, 0)
    session: Any = SimpleNamespace(scalars=lambda _statement: [])
    with pytest.raises(HTTPException) as caught:
        routes.routes_savings(claims, session)
    assert caught.value.status_code == 422
    assert caught.value.detail == "no feasible route plan found"
