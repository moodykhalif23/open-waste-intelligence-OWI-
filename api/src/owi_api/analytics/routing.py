import math
from dataclasses import dataclass
from typing import Protocol

from ortools.constraint_solver import pywrapcp, routing_enums_pb2

# (lng, lat) to match PostGIS POINT(lng lat) ordering everywhere else in the codebase.
GeoPoint = tuple[float, float]
EARTH_RADIUS_M = 6_371_000


def haversine_m(a: GeoPoint, b: GeoPoint) -> float:
    lng1, lat1, lng2, lat2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    dlat, dlng = lat2 - lat1, lng2 - lng1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(h))


class DistanceMatrix(Protocol):
    def distances(self, points: list[GeoPoint]) -> list[list[int]]:
        """Pairwise distances in metres; row i / col j = travel from point i to j."""
        ...


class HaversineMatrix:
    """Straight-line distances — zero infra, the default until OSRM road data is loaded."""

    def distances(self, points: list[GeoPoint]) -> list[list[int]]:
        return [[round(haversine_m(a, b)) for b in points] for a in points]


@dataclass(frozen=True)
class Stop:
    bin_id: str
    point: GeoPoint
    demand_kg: float


@dataclass(frozen=True)
class TruckSpec:
    truck_id: str
    capacity_kg: float


@dataclass(frozen=True)
class TruckRoute:
    truck_id: str
    stop_bin_ids: list[str]
    distance_m: int
    demand_kg: float


@dataclass(frozen=True)
class RoutePlan:
    routes: list[TruckRoute]

    @property
    def total_km(self) -> float:
        return round(sum(r.distance_m for r in self.routes) / 1000, 2)


def solve_routes(
    depot: GeoPoint,
    stops: list[Stop],
    trucks: list[TruckSpec],
    matrix: DistanceMatrix,
    time_limit_s: int = 5,
) -> RoutePlan:
    """Capacitated VRP: cheapest set of routes that collects every stop within truck capacity."""
    if not stops:
        return RoutePlan([TruckRoute(t.truck_id, [], 0, 0.0) for t in trucks])
    if not trucks:
        raise ValueError("no trucks available to plan a route")

    total_demand = sum(s.demand_kg for s in stops)
    total_capacity = sum(t.capacity_kg for t in trucks)
    if total_demand > total_capacity:
        raise ValueError(
            f"demand {total_demand:.0f} kg exceeds fleet capacity {total_capacity:.0f} kg"
        )

    points = [depot, *(s.point for s in stops)]
    dist = matrix.distances(points)
    demands = [0, *(round(s.demand_kg) for s in stops)]
    capacities = [round(t.capacity_kg) for t in trucks]

    manager = pywrapcp.RoutingIndexManager(len(points), len(trucks), 0)
    routing = pywrapcp.RoutingModel(manager)

    def distance_cb(i: int, j: int) -> int:
        return int(dist[manager.IndexToNode(i)][manager.IndexToNode(j)])

    transit = routing.RegisterTransitCallback(distance_cb)
    routing.SetArcCostEvaluatorOfAllVehicles(transit)

    def demand_cb(i: int) -> int:
        return int(demands[manager.IndexToNode(i)])

    demand_idx = routing.RegisterUnaryTransitCallback(demand_cb)
    routing.AddDimensionWithVehicleCapacity(demand_idx, 0, capacities, True, "Capacity")

    params = pywrapcp.DefaultRoutingSearchParameters()
    params.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    params.local_search_metaheuristic = (
        routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    )
    params.time_limit.FromSeconds(time_limit_s)

    solution = routing.SolveWithParameters(params)
    if solution is None:
        raise ValueError("no feasible route plan found")

    routes: list[TruckRoute] = []
    for v, truck in enumerate(trucks):
        index = routing.Start(v)
        bin_ids: list[str] = []
        demand = 0.0
        distance = 0
        while not routing.IsEnd(index):
            node = manager.IndexToNode(index)
            if node != 0:
                bin_ids.append(stops[node - 1].bin_id)
                demand += stops[node - 1].demand_kg
            nxt = solution.Value(routing.NextVar(index))
            distance += routing.GetArcCostForVehicle(index, nxt, v)
            index = nxt
        routes.append(TruckRoute(truck.truck_id, bin_ids, distance, round(demand, 1)))
    return RoutePlan(routes)
