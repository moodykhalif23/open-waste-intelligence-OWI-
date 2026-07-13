import pytest

from owi_api.analytics.routing import (
    DistanceMatrix,
    GeoPoint,
    HaversineMatrix,
    Stop,
    TruckSpec,
    haversine_m,
    solve_routes,
)

# Nairobi CBD → Westlands, ~4 km apart.
NAIROBI_CBD: GeoPoint = (36.8219, -1.2921)
WESTLANDS: GeoPoint = (36.8065, -1.2657)


def test_haversine_known_distance() -> None:
    assert haversine_m(NAIROBI_CBD, NAIROBI_CBD) == 0
    d = haversine_m(NAIROBI_CBD, WESTLANDS)
    assert 3000 < d < 4000  # ~3.4 km


def test_haversine_matrix_is_symmetric() -> None:
    m = HaversineMatrix().distances([NAIROBI_CBD, WESTLANDS])
    assert m[0][0] == 0 and m[1][1] == 0
    assert m[0][1] == m[1][0] > 0


def _stops() -> list[Stop]:
    return [
        Stop("a", (36.82, -1.29), 100),
        Stop("b", (36.81, -1.28), 120),
        Stop("c", (36.83, -1.30), 90),
        Stop("d", (36.80, -1.27), 110),
    ]


def test_all_stops_served_within_capacity() -> None:
    depot = (36.8219, -1.2921)
    trucks = [TruckSpec("t1", 300), TruckSpec("t2", 300)]
    plan = solve_routes(depot, _stops(), trucks, HaversineMatrix(), time_limit_s=2)

    served = sorted(b for r in plan.routes for b in r.stop_bin_ids)
    assert served == ["a", "b", "c", "d"]
    for route in plan.routes:
        assert route.demand_kg <= 300
    assert plan.total_km > 0


def test_capacity_forces_split_across_trucks() -> None:
    depot = (36.8219, -1.2921)
    # Total demand 420 kg; no single 250 kg truck can take it all.
    trucks = [TruckSpec("t1", 250), TruckSpec("t2", 250)]
    plan = solve_routes(depot, _stops(), trucks, HaversineMatrix(), time_limit_s=2)
    used = [r for r in plan.routes if r.stop_bin_ids]
    assert len(used) == 2


def test_infeasible_demand_rejected() -> None:
    depot = (36.8219, -1.2921)
    trucks = [TruckSpec("t1", 100)]
    with pytest.raises(ValueError, match="exceeds fleet capacity"):
        solve_routes(depot, _stops(), trucks, HaversineMatrix(), time_limit_s=2)


def test_no_stops_returns_empty_routes() -> None:
    plan = solve_routes((36.8, -1.3), [], [TruckSpec("t1", 300)], HaversineMatrix())
    assert plan.routes[0].stop_bin_ids == []
    assert plan.total_km == 0


class FixedMatrix:
    def distances(self, points: list[GeoPoint]) -> list[list[int]]:
        n = len(points)
        return [[0 if i == j else 1000 for j in range(n)] for i in range(n)]


def test_accepts_any_distance_matrix() -> None:
    matrix: DistanceMatrix = FixedMatrix()
    plan = solve_routes(
        (0.0, 0.0), [Stop("a", (1.0, 1.0), 10)], [TruckSpec("t1", 100)], matrix, time_limit_s=1
    )
    assert plan.routes[0].stop_bin_ids == ["a"]
    assert plan.routes[0].distance_m == 2000  # depot→a→depot at 1000 each
