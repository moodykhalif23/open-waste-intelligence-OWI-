import uuid
from collections import defaultdict
from datetime import UTC, date, datetime, time
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from owi_api.analytics.osrm import get_distance_matrix
from owi_api.analytics.refresh import refresh_bin
from owi_api.analytics.routing import DistanceMatrix, GeoPoint, Stop, TruckSpec, solve_routes
from owi_api.analytics.savings import Scenario, compute_savings
from owi_api.audit import client_ip, record_audit
from owi_api.config import settings
from owi_api.db import get_session
from owi_api.fleet import METHOD_SPECS, fleet_fuel_rate, resolve_capacity, resolve_fuel
from owi_api.models.enums import CollectionMethod, OverflowRisk, RouteStatus, UserRole
from owi_api.models.operations import BinHealthDaily, CollectionEvent
from owi_api.models.registry import Bin, User
from owi_api.models.route import Route, RouteStop, Truck
from owi_api.org_config import effective_fuel_price, effective_waste_density
from owi_api.routers.auth import get_current_user, require_roles
from owi_api.security import TokenClaims
from owi_api.weights import estimate_collection_weight

router = APIRouter(prefix="/api/v1", tags=["routes"])

PLANNERS = (UserRole.ADMIN, UserRole.COORDINATOR)
STAFF = (*PLANNERS, UserRole.COLLECTOR, UserRole.VIEWER)


class TruckIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    method: CollectionMethod = CollectionMethod.TRUCK
    # Omitted capacity/fuel fall back to the method's defaults.
    capacity_kg: float | None = Field(default=None, gt=0)
    fuel_l_per_100km: float | None = Field(default=None, ge=0)
    depot_lat: float = Field(ge=-90, le=90)
    depot_lng: float = Field(ge=-180, le=180)


class CrewMemberOut(BaseModel):
    id: uuid.UUID
    name: str
    phone: str | None


class TruckOut(BaseModel):
    id: uuid.UUID
    name: str
    method: CollectionMethod
    capacity_kg: float
    fuel_l_per_100km: float
    crew: list[CrewMemberOut]


class CrewIn(BaseModel):
    user_ids: list[uuid.UUID]


class MethodOut(BaseModel):
    method: CollectionMethod
    motorized: bool
    default_capacity_kg: float
    default_fuel_l_per_100km: float


class StopOut(BaseModel):
    id: uuid.UUID
    seq: int
    bin_id: uuid.UUID
    qr_code: str
    lat: float
    lng: float
    collected: bool
    skipped: bool
    skip_reason: str | None


class RouteOut(BaseModel):
    id: uuid.UUID
    truck_id: uuid.UUID
    truck_name: str
    method: CollectionMethod
    date: date
    status: RouteStatus
    planned_km: float
    planned_fuel_l: float
    demand_kg: float
    bins_served: int
    stops: list[StopOut]
    started_at: datetime | None
    started_by_me: bool
    completed_at: datetime | None
    actual_distance_km: float | None
    actual_duration_seconds: int | None
    actual_fuel_l: float | None
    actual_weight_kg: float | None


class RouteActionIn(BaseModel):
    occurred_at: datetime | None = None


class RouteCompleteIn(RouteActionIn):
    actual_distance_km: float | None = Field(default=None, ge=0)
    actual_fuel_l: float = Field(ge=0)
    actual_weight_kg: float = Field(ge=0)


class StopSkipIn(RouteActionIn):
    reason: str | None = Field(default=None, max_length=120)


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


@router.get("/collection-methods", response_model=list[MethodOut])
def list_collection_methods(
    requester: Annotated[TokenClaims, Depends(get_current_user)],
) -> list[MethodOut]:
    return [
        MethodOut(
            method=method,
            motorized=spec.motorized,
            default_capacity_kg=spec.default_capacity_kg,
            default_fuel_l_per_100km=spec.default_fuel_l_per_100km,
        )
        for method, spec in METHOD_SPECS.items()
    ]


def _truck_out(truck: Truck, crew: list[CrewMemberOut]) -> TruckOut:
    return TruckOut(
        id=truck.id,
        name=truck.name,
        method=truck.method,
        capacity_kg=truck.capacity_kg,
        fuel_l_per_100km=truck.fuel_l_per_100km,
        crew=crew,
    )


def _crews(
    session: Session, org_id: uuid.UUID, with_phone: bool
) -> dict[uuid.UUID | None, list[CrewMemberOut]]:
    crews: dict[uuid.UUID | None, list[CrewMemberOut]] = defaultdict(list)
    for user in session.scalars(
        select(User)
        .where(User.org_id == org_id, User.deleted_at.is_(None), User.vehicle_id.is_not(None))
        .order_by(User.name)
    ):
        crews[user.vehicle_id].append(
            CrewMemberOut(id=user.id, name=user.name, phone=user.phone if with_phone else None)
        )
    return crews


def _active_trucks(session: Session, org_id: uuid.UUID) -> list[Truck]:
    return list(
        session.scalars(
            select(Truck).where(
                Truck.org_id == org_id, Truck.deleted_at.is_(None), Truck.active.is_(True)
            )
        )
    )


def _depot(session: Session, truck: Truck) -> GeoPoint:
    lat, lng = session.execute(
        select(func.ST_Y(Truck.depot), func.ST_X(Truck.depot)).where(Truck.id == truck.id)
    ).one()
    return (lng, lat)


def _collect_today_bins(session: Session, org_id: uuid.UUID) -> list[uuid.UUID]:
    latest = (
        select(BinHealthDaily.bin_id, BinHealthDaily.overflow_risk)
        .where(BinHealthDaily.org_id == org_id)
        .order_by(BinHealthDaily.bin_id, BinHealthDaily.date.desc())
        .distinct(BinHealthDaily.bin_id)
        .subquery()
    )
    return list(
        session.scalars(
            select(latest.c.bin_id)
            .join(Bin, Bin.id == latest.c.bin_id)
            .where(latest.c.overflow_risk != OverflowRisk.LOW, Bin.deleted_at.is_(None))
        )
    )


@router.post("/trucks", response_model=TruckOut, status_code=201)
def create_truck(
    body: TruckIn,
    requester: Annotated[TokenClaims, require_roles(*PLANNERS)],
    session: Annotated[Session, Depends(get_session)],
) -> TruckOut:
    truck = Truck(
        org_id=requester.org_id,
        name=body.name,
        method=body.method,
        capacity_kg=resolve_capacity(body.method, body.capacity_kg),
        fuel_l_per_100km=resolve_fuel(body.method, body.fuel_l_per_100km),
        depot=f"SRID=4326;POINT({body.depot_lng} {body.depot_lat})",
    )
    session.add(truck)
    session.commit()
    return _truck_out(truck, [])


@router.get("/trucks", response_model=list[TruckOut])
def list_trucks(
    requester: Annotated[TokenClaims, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_session)],
) -> list[TruckOut]:
    trucks = _active_trucks(session, requester.org_id)
    crews = (
        _crews(session, requester.org_id, with_phone=requester.role in PLANNERS)
        if requester.role in STAFF
        else {}
    )
    return [_truck_out(t, crews.get(t.id, [])) for t in trucks]


@router.put("/trucks/{truck_id}/crew", response_model=list[CrewMemberOut])
def set_truck_crew(
    truck_id: uuid.UUID,
    body: CrewIn,
    request: Request,
    requester: Annotated[TokenClaims, require_roles(*PLANNERS)],
    session: Annotated[Session, Depends(get_session)],
) -> list[CrewMemberOut]:
    truck = session.get(Truck, truck_id)
    if truck is None or truck.org_id != requester.org_id or truck.deleted_at is not None:
        raise HTTPException(status_code=404, detail="vehicle not found")
    wanted = list(dict.fromkeys(body.user_ids))
    members = list(session.scalars(select(User).where(User.id.in_(wanted)))) if wanted else []
    if len(members) != len(wanted) or any(
        u.org_id != requester.org_id or u.deleted_at is not None or u.role is not UserRole.COLLECTOR
        for u in members
    ):
        raise HTTPException(
            status_code=422, detail="crew members must be active collectors in this organization"
        )
    removed = [
        u
        for u in session.scalars(select(User).where(User.vehicle_id == truck.id))
        if u.id not in wanted
    ]
    for user in removed:
        user.vehicle_id = None
    for user in members:
        user.vehicle_id = truck.id
    record_audit(
        session,
        org_id=requester.org_id,
        actor_user_id=requester.user_id,
        action="truck.crew_update",
        entity="truck",
        entity_id=truck.id,
        ip=client_ip(request),
        detail={"user_ids": [str(u) for u in wanted], "removed": [str(u.id) for u in removed]},
    )
    session.commit()
    return [
        CrewMemberOut(id=u.id, name=u.name, phone=u.phone)
        for u in sorted(members, key=lambda u: u.name)
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
    density = effective_waste_density(session, org_id)
    stops = []
    for bin_, lat, lng in rows:
        fill = latest_fill.get(bin_.id, 100.0)  # unknown fill → assume full, so it isn't skipped
        demand = fill / 100 * bin_.volume_liters * density
        stops.append(Stop(str(bin_.id), (lng, lat), max(1.0, demand)))
    return stops


def _route_out(
    session: Session, route: Route, truck: Truck, requester_id: uuid.UUID | None = None
) -> RouteOut:
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
                skipped=stop.skipped_at is not None,
                skip_reason=stop.skip_reason,
            )
        )
    return RouteOut(
        id=route.id,
        truck_id=route.truck_id,
        truck_name=truck.name,
        method=truck.method,
        date=route.date,
        status=route.status,
        planned_km=route.planned_km,
        planned_fuel_l=route.planned_fuel_l,
        demand_kg=route.demand_kg,
        bins_served=route.bins_served,
        stops=stops_out,
        started_at=route.started_at,
        started_by_me=requester_id is not None and route.started_by_user_id == requester_id,
        completed_at=route.completed_at,
        actual_distance_km=route.actual_distance_km,
        actual_duration_seconds=(
            int((route.completed_at - route.started_at).total_seconds())
            if route.completed_at is not None and route.started_at is not None
            else None
        ),
        actual_fuel_l=route.actual_fuel_l,
        actual_weight_kg=route.actual_weight_kg,
    )


def _action_time(body: RouteActionIn | None, route: Route) -> datetime:
    now = datetime.now(UTC)
    if body is None or body.occurred_at is None:
        return now
    occurred = body.occurred_at
    if occurred.tzinfo is None:
        occurred = occurred.replace(tzinfo=UTC)
    earliest = datetime.combine(route.date, time.min, tzinfo=UTC)
    if route.started_at is not None:
        earliest = max(earliest, route.started_at)
    return min(max(occurred, earliest), now)


def _crew_vehicle(session: Session, claims: TokenClaims) -> uuid.UUID | None:
    user = session.get(User, claims.user_id)
    return user.vehicle_id if user is not None else None


def _ensure_on_vehicle(session: Session, claims: TokenClaims, route: Route) -> None:
    if claims.role is UserRole.COLLECTOR and _crew_vehicle(session, claims) != route.truck_id:
        raise HTTPException(status_code=403, detail="route belongs to another vehicle")


@router.get("/routes", response_model=list[RouteOut])
def list_routes(
    requester: Annotated[TokenClaims, require_roles(*STAFF)],
    session: Annotated[Session, Depends(get_session)],
    on: date | None = None,
) -> list[RouteOut]:
    day = on or datetime.now(UTC).date()
    query = (
        select(Route, Truck)
        .join(Truck, Truck.id == Route.truck_id)
        .where(
            Route.org_id == requester.org_id,
            Route.deleted_at.is_(None),
            Route.date == day,
        )
    )
    if requester.role is UserRole.COLLECTOR:
        vehicle_id = _crew_vehicle(session, requester)
        if vehicle_id is None:
            return []
        query = query.where(Route.truck_id == vehicle_id)
    rows = session.execute(query).all()
    return [_route_out(session, route, truck, requester.user_id) for route, truck in rows]


@router.post("/routes/{route_id}/start", response_model=RouteOut)
def start_route(
    route_id: uuid.UUID,
    requester: Annotated[
        TokenClaims,
        require_roles(UserRole.ADMIN, UserRole.COORDINATOR, UserRole.COLLECTOR),
    ],
    session: Annotated[Session, Depends(get_session)],
    body: RouteActionIn | None = None,
) -> RouteOut:
    route = session.scalar(
        select(Route)
        .where(
            Route.id == route_id,
            Route.org_id == requester.org_id,
            Route.deleted_at.is_(None),
        )
        .with_for_update()
    )
    if route is None:
        raise HTTPException(status_code=404, detail="route not found")
    _ensure_on_vehicle(session, requester, route)
    if route.status is RouteStatus.ACTIVE:
        if route.started_by_user_id != requester.user_id:
            raise HTTPException(status_code=409, detail="route is active on another device")
    elif route.status is not RouteStatus.PLANNED:
        if route.started_by_user_id != requester.user_id:
            raise HTTPException(status_code=409, detail="route is not planned")
    else:
        route.status = RouteStatus.ACTIVE
        route.started_at = _action_time(body, route)
        route.started_by_user_id = requester.user_id
        session.commit()
    truck = session.get(Truck, route.truck_id)
    if truck is None:
        raise HTTPException(status_code=404, detail="route vehicle not found")
    return _route_out(session, route, truck, requester.user_id)


@router.post("/routes/{route_id}/complete", response_model=RouteOut)
def complete_route(
    route_id: uuid.UUID,
    body: RouteCompleteIn,
    requester: Annotated[
        TokenClaims,
        require_roles(UserRole.ADMIN, UserRole.COORDINATOR, UserRole.COLLECTOR),
    ],
    session: Annotated[Session, Depends(get_session)],
) -> RouteOut:
    route = session.scalar(
        select(Route)
        .where(
            Route.id == route_id,
            Route.org_id == requester.org_id,
            Route.deleted_at.is_(None),
        )
        .with_for_update()
    )
    if route is None:
        raise HTTPException(status_code=404, detail="route not found")
    _ensure_on_vehicle(session, requester, route)
    if route.status is RouteStatus.PLANNED or route.started_by_user_id != requester.user_id:
        raise HTTPException(status_code=409, detail="route is not active on this device")
    truck = session.get(Truck, route.truck_id)
    if truck is None:
        raise HTTPException(status_code=404, detail="route vehicle not found")
    if route.status is RouteStatus.DONE:
        return _route_out(session, route, truck, requester.user_id)
    pending = session.scalar(
        select(func.count())
        .select_from(RouteStop)
        .where(
            RouteStop.route_id == route.id,
            RouteStop.collected.is_(False),
            RouteStop.skipped_at.is_(None),
        )
    )
    if pending:
        raise HTTPException(
            status_code=409, detail="collect or skip every route stop before completing"
        )
    if not METHOD_SPECS[truck.method].motorized and body.actual_fuel_l > 0:
        raise HTTPException(
            status_code=422, detail="manual collection methods must report zero fuel"
        )

    route.status = RouteStatus.DONE
    route.completed_at = _action_time(body, route)
    route.actual_distance_km = body.actual_distance_km
    route.actual_fuel_l = body.actual_fuel_l
    route.actual_weight_kg = body.actual_weight_kg
    session.commit()
    return _route_out(session, route, truck, requester.user_id)


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
    trucks = _active_trucks(session, requester.org_id)
    if not trucks:
        raise HTTPException(status_code=400, detail="no active trucks — add one first")

    fuel_rate = fleet_fuel_rate((t.method, t.fuel_l_per_100km) for t in trucks)
    depot = _depot(session, trucks[0])
    matrix = get_distance_matrix(settings.osrm_url or None)

    all_bins = list(
        session.scalars(
            select(Bin.id).where(Bin.org_id == requester.org_id, Bin.deleted_at.is_(None))
        )
    )
    today_bins = _collect_today_bins(session, requester.org_id)

    try:
        baseline = _scenario(
            _bin_demand(session, requester.org_id, all_bins), len(trucks), depot, matrix, fuel_rate
        )
        optimized = _scenario(
            _bin_demand(session, requester.org_id, today_bins),
            len(trucks),
            depot,
            matrix,
            fuel_rate,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    report = compute_savings(baseline, optimized, effective_fuel_price(session, requester.org_id))

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


def _stop_route(session: Session, stop: RouteStop, claims: TokenClaims) -> Route | None:
    route = session.scalar(
        select(Route)
        .where(
            Route.id == stop.route_id,
            Route.org_id == claims.org_id,
            Route.deleted_at.is_(None),
        )
        .with_for_update()
    )
    if route is not None:
        _ensure_on_vehicle(session, claims, route)
    return route


def _active_stop_route(route: Route | None, claims: TokenClaims, action: str) -> Route:
    if route is None or route.status is not RouteStatus.ACTIVE:
        raise HTTPException(status_code=409, detail=f"start the route before {action} stops")
    if claims.role is UserRole.COLLECTOR and route.started_by_user_id != claims.user_id:
        raise HTTPException(status_code=403, detail="route is active on another device")
    return route


@router.post("/routes/stops/{stop_id}/collect", status_code=204)
def collect_stop(
    stop_id: uuid.UUID,
    claims: Annotated[TokenClaims, require_roles(*STAFF)],
    session: Annotated[Session, Depends(get_session)],
    body: RouteActionIn | None = None,
) -> None:
    """Driver marks a stop done: records the collection, resets bin health, ticks the stop."""
    stop = session.scalar(
        select(RouteStop)
        .where(RouteStop.id == stop_id, RouteStop.org_id == claims.org_id)
        .with_for_update()
    )
    if stop is None or stop.org_id != claims.org_id:
        raise HTTPException(status_code=404, detail="stop not found")
    route = _stop_route(session, stop, claims)
    if stop.collected:
        return
    route = _active_stop_route(route, claims, "collecting")
    session.add(
        CollectionEvent(
            org_id=claims.org_id,
            bin_id=stop.bin_id,
            route_stop_id=stop.id,
            occurred_at=_action_time(body, route),
            collector_id=claims.user_id if claims.role is UserRole.COLLECTOR else None,
            estimated_weight_kg=estimate_collection_weight(session, stop.bin_id),
        )
    )
    stop.collected = True
    stop.skipped_at = None
    stop.skip_reason = None
    session.commit()
    refresh_bin(session, stop.bin_id)


@router.post("/routes/stops/{stop_id}/skip", status_code=204)
def skip_stop(
    stop_id: uuid.UUID,
    claims: Annotated[
        TokenClaims,
        require_roles(UserRole.ADMIN, UserRole.COORDINATOR, UserRole.COLLECTOR),
    ],
    session: Annotated[Session, Depends(get_session)],
    body: StopSkipIn | None = None,
) -> None:
    stop = session.scalar(
        select(RouteStop)
        .where(RouteStop.id == stop_id, RouteStop.org_id == claims.org_id)
        .with_for_update()
    )
    if stop is None:
        raise HTTPException(status_code=404, detail="stop not found")
    route = _stop_route(session, stop, claims)
    if stop.skipped_at is not None:
        return
    if stop.collected:
        raise HTTPException(status_code=409, detail="stop is already collected")
    route = _active_stop_route(route, claims, "skipping")
    reason = body.reason.strip() if body is not None and body.reason else ""
    stop.skipped_at = _action_time(body, route)
    stop.skip_reason = reason or None
    session.commit()


def _plan_and_persist(
    session: Session, org_id: uuid.UUID, bin_ids: list[uuid.UUID], trucks: list[Truck]
) -> list[RouteOut]:
    stops = _bin_demand(session, org_id, bin_ids)
    depot = _depot(session, trucks[0])
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
        out.append(_route_out(session, route, truck))
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
    existing = session.scalars(
        select(Route)
        .where(
            Route.org_id == requester.org_id,
            Route.deleted_at.is_(None),
            Route.date == today,
        )
        .with_for_update()
    ).all()
    pending: set[uuid.UUID] = set()
    for route in existing:
        if route.status is not RouteStatus.PLANNED:
            continue
        for stop in session.scalars(
            select(RouteStop).where(
                RouteStop.route_id == route.id,
                RouteStop.collected.is_(False),
                RouteStop.skipped_at.is_(None),
            )
        ):
            pending.add(stop.bin_id)
    active_bins = {
        bin_id
        for route in existing
        if route.status is RouteStatus.ACTIVE
        for bin_id in session.scalars(
            select(RouteStop.bin_id).where(RouteStop.route_id == route.id)
        )
    }
    pending.update(body.add_bin_ids or [])
    pending.difference_update(active_bins)

    if not pending:
        return []

    trucks = [t for t in _active_trucks(session, requester.org_id) if t.id not in disabled]
    if not trucks:
        raise HTTPException(status_code=400, detail="no trucks left after breakdowns")

    for route in existing:
        if route.status is not RouteStatus.PLANNED:
            continue
        route.deleted_at = datetime.now(UTC)  # supersede the old plan; collections are kept
    session.commit()

    return _plan_and_persist(session, requester.org_id, list(pending), trucks)
