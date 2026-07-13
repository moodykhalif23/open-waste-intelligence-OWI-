import uuid
from datetime import UTC, date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from owi_api.analytics.osrm import get_distance_matrix
from owi_api.analytics.refresh import refresh_bin
from owi_api.analytics.routing import DistanceMatrix, GeoPoint, Stop, TruckSpec, solve_routes
from owi_api.analytics.savings import Scenario, compute_savings
from owi_api.config import settings
from owi_api.db import get_session
from owi_api.models.enums import OverflowRisk, RouteStatus, UserRole
from owi_api.models.operations import BinHealthDaily, CollectionEvent
from owi_api.models.registry import Bin
from owi_api.models.route import Route, RouteStop, Truck
from owi_api.routers.auth import get_current_user, require_roles
from owi_api.security import TokenClaims

router = APIRouter(prefix="/api/v1", tags=["routes"])

PLANNERS = (UserRole.ADMIN, UserRole.COORDINATOR)
STAFF = (*PLANNERS, UserRole.COLLECTOR, UserRole.VIEWER)


class TruckIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    capacity_kg: float = Field(gt=0)
    fuel_l_per_100km: float = Field(default=25.0, gt=0)
    depot_lat: float = Field(ge=-90, le=90)
    depot_lng: float = Field(ge=-180, le=180)


class TruckOut(BaseModel):
    id: uuid.UUID
    name: str
    capacity_kg: float
    fuel_l_per_100km: float


class StopOut(BaseModel):
    id: uuid.UUID
    seq: int
    bin_id: uuid.UUID
    qr_code: str
    lat: float
    lng: float
    collected: bool


class RouteOut(BaseModel):
    id: uuid.UUID
    truck_id: uuid.UUID
    truck_name: str
    date: date
    status: RouteStatus
    planned_km: float
    planned_fuel_l: float
    demand_kg: float
    bins_served: int
    stops: list[StopOut]


class OptimizeIn(BaseModel):
    # Omit bin_ids to auto-select every bin currently recommended for collection.
    bin_ids: list[uuid.UUID] | None = None


class ReplanIn(BaseModel):
    add_bin_ids: list[uuid.UUID] | None = None
    disable_truck_ids: list[uuid.UUID] | None = None


class ScenarioOut(BaseModel):
    km: float
    tonnes: float
    fuel_l: float
    bins: int


class SavingsOut(BaseModel):
    baseline: ScenarioOut
    optimized: ScenarioOut
    baseline_km_per_tonne: float | None
    optimized_km_per_tonne: float | None
    km_per_tonne_reduction_pct: float | None
    fuel_l_saved: float
    kes_saved: float | None


@router.post("/trucks", response_model=TruckOut, status_code=201)
def create_truck(
    body: TruckIn,
    requester: Annotated[TokenClaims, require_roles(*PLANNERS)],
    session: Annotated[Session, Depends(get_session)],
) -> TruckOut:
    truck = Truck(
        org_id=requester.org_id,
        name=body.name,
        capacity_kg=body.capacity_kg,
        fuel_l_per_100km=body.fuel_l_per_100km,
        depot=f"SRID=4326;POINT({body.depot_lng} {body.depot_lat})",
    )
    session.add(truck)
    session.commit()
    return TruckOut(
        id=truck.id,
        name=truck.name,
        capacity_kg=truck.capacity_kg,
        fuel_l_per_100km=truck.fuel_l_per_100km,
    )


@router.get("/trucks", response_model=list[TruckOut])
def list_trucks(
    requester: Annotated[TokenClaims, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_session)],
) -> list[TruckOut]:
    trucks = session.scalars(
        select(Truck).where(
            Truck.org_id == requester.org_id, Truck.deleted_at.is_(None), Truck.active.is_(True)
        )
    )
    return [
        TruckOut(
            id=t.id, name=t.name, capacity_kg=t.capacity_kg, fuel_l_per_100km=t.fuel_l_per_100km
        )
        for t in trucks
    ]


def _bin_demand(session: Session, org_id: uuid.UUID, bin_ids: list[uuid.UUID]) -> list[Stop]:
    rows = session.execute(
        select(Bin, func.ST_Y(Bin.location), func.ST_X(Bin.location)).where(
            Bin.id.in_(bin_ids), Bin.org_id == org_id, Bin.deleted_at.is_(None)
        )
    ).all()
    latest_fill = {
        r.bin_id: r.fill_pct
        for r in session.execute(
            select(BinHealthDaily.bin_id, BinHealthDaily.fill_pct)
            .where(BinHealthDaily.bin_id.in_(bin_ids))
            .order_by(BinHealthDaily.bin_id, BinHealthDaily.date.desc())
            .distinct(BinHealthDaily.bin_id)
        ).all()
    }
    stops = []
    for bin_, lat, lng in rows:
        fill = latest_fill.get(bin_.id, 100.0)  # unknown fill → assume full, so it isn't skipped
        demand = fill / 100 * bin_.volume_liters * settings.waste_density_kg_per_l
        stops.append(Stop(str(bin_.id), (lng, lat), max(1.0, demand)))
    return stops


def _route_out(session: Session, route: Route, truck_name: str) -> RouteOut:
    stop_rows = session.scalars(
        select(RouteStop).where(RouteStop.route_id == route.id).order_by(RouteStop.seq)
    ).all()
    stops_out: list[StopOut] = []
    for stop in stop_rows:
        qr, lat, lng = session.execute(
            select(Bin.qr_code, func.ST_Y(Bin.location), func.ST_X(Bin.location)).where(
                Bin.id == stop.bin_id
            )
        ).one()
        stops_out.append(
            StopOut(
                id=stop.id,
                seq=stop.seq,
                bin_id=stop.bin_id,
                qr_code=qr,
                lat=lat,
                lng=lng,
                collected=stop.collected,
            )
        )
    return RouteOut(
        id=route.id,
        truck_id=route.truck_id,
        truck_name=truck_name,
        date=route.date,
        status=route.status,
        planned_km=route.planned_km,
        planned_fuel_l=route.planned_fuel_l,
        demand_kg=route.demand_kg,
        bins_served=route.bins_served,
        stops=stops_out,
    )


@router.get("/routes", response_model=list[RouteOut])
def list_routes(
    requester: Annotated[TokenClaims, require_roles(*STAFF)],
    session: Annotated[Session, Depends(get_session)],
    on: date | None = None,
) -> list[RouteOut]:
    day = on or datetime.now(UTC).date()
    rows = session.execute(
        select(Route, Truck.name)
        .join(Truck, Truck.id == Route.truck_id)
        .where(
            Route.org_id == requester.org_id,
            Route.deleted_at.is_(None),
            Route.date == day,
        )
    ).all()
    return [_route_out(session, route, name) for route, name in rows]


def _scenario(
    stops: list[Stop], n_trucks: int, depot: GeoPoint, matrix: DistanceMatrix, fuel_rate: float
) -> Scenario:
    if not stops:
        return Scenario(km=0.0, kg=0.0, fuel_l=0.0)
    # Savings is a distance-per-tonne analysis, so give every truck ample capacity
    # (real capacity planning lives in /routes/optimize); we just want minimal sweep distance.
    total = sum(s.demand_kg for s in stops)
    specs = [TruckSpec(str(i), total) for i in range(n_trucks)]
    plan = solve_routes(depot, stops, specs, matrix, time_limit_s=settings.route_time_limit_s)
    km = plan.total_km
    return Scenario(km=km, kg=total, fuel_l=round(km * fuel_rate / 100, 2))


@router.get("/routes/savings", response_model=SavingsOut)
def routes_savings(
    requester: Annotated[TokenClaims, require_roles(*PLANNERS)],
    session: Annotated[Session, Depends(get_session)],
) -> SavingsOut:
    trucks = list(
        session.scalars(
            select(Truck).where(
                Truck.org_id == requester.org_id,
                Truck.deleted_at.is_(None),
                Truck.active.is_(True),
            )
        )
    )
    if not trucks:
        raise HTTPException(status_code=400, detail="no active trucks — add one first")

    fuel_rate = sum(t.fuel_l_per_100km for t in trucks) / len(trucks)
    depot_row = session.execute(
        select(func.ST_Y(Truck.depot), func.ST_X(Truck.depot)).where(Truck.id == trucks[0].id)
    ).one()
    depot = (depot_row[1], depot_row[0])
    matrix = get_distance_matrix(settings.osrm_url or None)

    all_bins = list(
        session.scalars(
            select(Bin.id).where(Bin.org_id == requester.org_id, Bin.deleted_at.is_(None))
        )
    )
    today_bins = list(
        session.scalars(
            select(BinHealthDaily.bin_id)
            .where(
                BinHealthDaily.org_id == requester.org_id,
                BinHealthDaily.overflow_risk != OverflowRisk.LOW,
            )
            .order_by(BinHealthDaily.bin_id, BinHealthDaily.date.desc())
            .distinct(BinHealthDaily.bin_id)
        )
    )

    baseline = _scenario(
        _bin_demand(session, requester.org_id, all_bins), len(trucks), depot, matrix, fuel_rate
    )
    optimized = _scenario(
        _bin_demand(session, requester.org_id, today_bins), len(trucks), depot, matrix, fuel_rate
    )
    report = compute_savings(baseline, optimized, settings.fuel_price_kes_per_l)

    return SavingsOut(
        baseline=ScenarioOut(
            km=baseline.km,
            tonnes=round(baseline.kg / 1000, 3),
            fuel_l=baseline.fuel_l,
            bins=len(all_bins),
        ),
        optimized=ScenarioOut(
            km=optimized.km,
            tonnes=round(optimized.kg / 1000, 3),
            fuel_l=optimized.fuel_l,
            bins=len(today_bins),
        ),
        baseline_km_per_tonne=report.baseline_km_per_tonne,
        optimized_km_per_tonne=report.optimized_km_per_tonne,
        km_per_tonne_reduction_pct=report.km_per_tonne_reduction_pct,
        fuel_l_saved=report.fuel_l_saved,
        kes_saved=report.kes_saved,
    )


@router.post("/routes/stops/{stop_id}/collect", status_code=204)
def collect_stop(
    stop_id: uuid.UUID,
    claims: Annotated[TokenClaims, require_roles(*STAFF)],
    session: Annotated[Session, Depends(get_session)],
) -> None:
    """Driver marks a stop done: records the collection, resets bin health, ticks the stop."""
    stop = session.get(RouteStop, stop_id)
    if stop is None or stop.org_id != claims.org_id:
        raise HTTPException(status_code=404, detail="stop not found")
    if stop.collected:
        return
    session.add(
        CollectionEvent(
            org_id=claims.org_id,
            bin_id=stop.bin_id,
            occurred_at=datetime.now(UTC),
            collector_id=claims.user_id if claims.role is UserRole.COLLECTOR else None,
        )
    )
    stop.collected = True
    session.commit()
    refresh_bin(session, stop.bin_id)


def _active_trucks(session: Session, org_id: uuid.UUID) -> list[Truck]:
    return list(
        session.scalars(
            select(Truck).where(
                Truck.org_id == org_id, Truck.deleted_at.is_(None), Truck.active.is_(True)
            )
        )
    )


def _collect_today_bins(session: Session, org_id: uuid.UUID) -> list[uuid.UUID]:
    return list(
        session.scalars(
            select(BinHealthDaily.bin_id)
            .where(
                BinHealthDaily.org_id == org_id,
                BinHealthDaily.overflow_risk != OverflowRisk.LOW,
            )
            .order_by(BinHealthDaily.bin_id, BinHealthDaily.date.desc())
            .distinct(BinHealthDaily.bin_id)
        )
    )


def _plan_and_persist(
    session: Session, org_id: uuid.UUID, bin_ids: list[uuid.UUID], trucks: list[Truck]
) -> list[RouteOut]:
    stops = _bin_demand(session, org_id, bin_ids)
    depot_row = session.execute(
        select(func.ST_Y(Truck.depot), func.ST_X(Truck.depot)).where(Truck.id == trucks[0].id)
    ).one()
    depot = (depot_row[1], depot_row[0])
    specs = [TruckSpec(str(t.id), t.capacity_kg) for t in trucks]

    try:
        plan = solve_routes(
            depot,
            stops,
            specs,
            get_distance_matrix(settings.osrm_url or None),
            time_limit_s=settings.route_time_limit_s,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    today = datetime.now(UTC).date()
    by_truck = {t.id: t for t in trucks}
    out: list[RouteOut] = []
    for tr in plan.routes:
        truck = by_truck[uuid.UUID(tr.truck_id)]
        km = round(tr.distance_m / 1000, 2)
        route = Route(
            org_id=org_id,
            date=today,
            truck_id=truck.id,
            status=RouteStatus.PLANNED,
            planned_km=km,
            planned_fuel_l=round(km * truck.fuel_l_per_100km / 100, 2),
            demand_kg=tr.demand_kg,
            bins_served=len(tr.stop_bin_ids),
        )
        session.add(route)
        session.flush()
        for seq, bid in enumerate(tr.stop_bin_ids):
            session.add(RouteStop(org_id=org_id, route_id=route.id, bin_id=uuid.UUID(bid), seq=seq))
        session.commit()
        out.append(_route_out(session, route, truck.name))
    return out


@router.post("/routes/optimize", response_model=list[RouteOut])
def optimize_routes(
    body: OptimizeIn,
    requester: Annotated[TokenClaims, require_roles(*PLANNERS)],
    session: Annotated[Session, Depends(get_session)],
) -> list[RouteOut]:
    trucks = _active_trucks(session, requester.org_id)
    if not trucks:
        raise HTTPException(status_code=400, detail="no active trucks — add one first")
    bin_ids = body.bin_ids or _collect_today_bins(session, requester.org_id)
    if not bin_ids:
        raise HTTPException(status_code=400, detail="no bins to collect")
    return _plan_and_persist(session, requester.org_id, bin_ids, trucks)


@router.post("/routes/replan", response_model=list[RouteOut])
def replan_routes(
    body: ReplanIn,
    requester: Annotated[TokenClaims, require_roles(*PLANNERS)],
    session: Annotated[Session, Depends(get_session)],
) -> list[RouteOut]:
    """Mid-day recompute: re-plan the uncollected stops (plus any added bins) over the
    still-available trucks, superseding today's existing plan. Collected stops stay done."""
    today = datetime.now(UTC).date()
    disabled = set(body.disable_truck_ids or [])
    trucks = [t for t in _active_trucks(session, requester.org_id) if t.id not in disabled]
    if not trucks:
        raise HTTPException(status_code=400, detail="no trucks left after breakdowns")

    existing = session.scalars(
        select(Route).where(
            Route.org_id == requester.org_id,
            Route.deleted_at.is_(None),
            Route.date == today,
        )
    ).all()
    pending: set[uuid.UUID] = set()
    for route in existing:
        for stop in session.scalars(
            select(RouteStop).where(RouteStop.route_id == route.id, RouteStop.collected.is_(False))
        ):
            pending.add(stop.bin_id)
        route.deleted_at = datetime.now(UTC)  # supersede the old plan; collections are kept
    pending.update(body.add_bin_ids or [])
    session.commit()

    if not pending:
        raise HTTPException(status_code=400, detail="nothing left to collect")
    return _plan_and_persist(session, requester.org_id, list(pending), trucks)
