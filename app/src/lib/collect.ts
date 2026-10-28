import { ApiError, apiUrl } from "./api";

export interface BinHealth {
  bin_id: string;
  qr_code: string;
  site_name: string;
  fill_pct: number;
  days_since_collection: number | null;
  overflow_risk: "low" | "medium" | "high";
  recommendation: "collect_today" | "schedule_soon" | "no_action";
}

interface RouteStop {
  id: string;
  seq: number;
  qr_code: string;
  collected: boolean;
  skipped: boolean;
  skip_reason: string | null;
}

export interface RouteCompletion {
  actual_distance_km: number | null;
  actual_fuel_l: number;
  actual_weight_kg: number;
}

export interface Route {
  id: string;
  date: string;
  truck_name: string;
  method: string;
  status: "planned" | "active" | "done";
  started_by_me: boolean;
  planned_km: number;
  planned_fuel_l: number;
  actual_distance_km: number | null;
  actual_duration_seconds: number | null;
  actual_fuel_l: number | null;
  actual_weight_kg: number | null;
  stops: RouteStop[];
}

export const SKIP_REASONS = ["blocked", "missing", "damaged", "other"] as const;
export type SkipReason = (typeof SKIP_REASONS)[number];

export type RouteAction =
  | { kind: "start"; routeId: string; occurredAt: string }
  | { kind: "collect"; stopId: string; occurredAt: string }
  | { kind: "skip"; stopId: string; reason: SkipReason; occurredAt: string }
  | { kind: "complete"; routeId: string; completion: RouteCompletion; occurredAt: string };

const ROUTES_KEY = "owi-routes";

async function authed(path: string, token: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(apiUrl(path), {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(typeof init?.body === "string" ? { "Content-Type": "application/json" } : {}),
    },
  });
  if (!response.ok) throw new ApiError(response.status);
  return response;
}

export async function fetchRoutes(token: string): Promise<Route[]> {
  return (await authed("/api/v1/routes", token).then((r) => r.json())) as Route[];
}

export async function collectStop(token: string, stopId: string, occurredAt: string): Promise<void> {
  await authed(`/api/v1/routes/stops/${stopId}/collect`, token, {
    method: "POST",
    body: JSON.stringify({ occurred_at: occurredAt }),
  });
}

export async function skipStop(
  token: string,
  stopId: string,
  reason: SkipReason,
  occurredAt: string,
): Promise<void> {
  await authed(`/api/v1/routes/stops/${stopId}/skip`, token, {
    method: "POST",
    body: JSON.stringify({ reason, occurred_at: occurredAt }),
  });
}

export async function startRoute(token: string, routeId: string, occurredAt: string): Promise<Route> {
  return (await authed(`/api/v1/routes/${routeId}/start`, token, {
    method: "POST",
    body: JSON.stringify({ occurred_at: occurredAt }),
  }).then((r) => r.json())) as Route;
}

export async function completeRoute(
  token: string,
  routeId: string,
  body: RouteCompletion,
  occurredAt: string,
): Promise<Route> {
  return (await authed(`/api/v1/routes/${routeId}/complete`, token, {
    method: "POST",
    body: JSON.stringify({ ...body, occurred_at: occurredAt }),
  }).then((r) => r.json())) as Route;
}

export async function sendRouteAction(token: string, action: RouteAction): Promise<void> {
  switch (action.kind) {
    case "start":
      await startRoute(token, action.routeId, action.occurredAt);
      return;
    case "collect":
      await collectStop(token, action.stopId, action.occurredAt);
      return;
    case "skip":
      await skipStop(token, action.stopId, action.reason, action.occurredAt);
      return;
    case "complete":
      await completeRoute(token, action.routeId, action.completion, action.occurredAt);
  }
}

export function cachedRoutes(): Route[] {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const routes = JSON.parse(localStorage.getItem(ROUTES_KEY) ?? "[]") as Route[];
    return routes.filter((route) => route.date === today);
  } catch {
    return [];
  }
}

export function cacheRoutes(routes: Route[]): boolean {
  try {
    localStorage.setItem(ROUTES_KEY, JSON.stringify(routes));
    return true;
  } catch {
    return false;
  }
}

function applyRouteAction(route: Route, action: RouteAction): Route {
  switch (action.kind) {
    case "start":
      return route.id === action.routeId && route.status === "planned"
        ? { ...route, status: "active", started_by_me: true }
        : route;
    case "complete":
      return route.id === action.routeId && route.status === "active" && route.started_by_me
        ? { ...route, ...action.completion, status: "done" }
        : route;
    case "collect":
      return {
        ...route,
        stops: route.stops.map((stop) =>
          stop.id === action.stopId
            ? { ...stop, collected: true, skipped: false, skip_reason: null }
            : stop,
        ),
      };
    case "skip":
      return {
        ...route,
        stops: route.stops.map((stop) =>
          stop.id === action.stopId && !stop.collected
            ? { ...stop, skipped: true, skip_reason: action.reason }
            : stop,
        ),
      };
  }
}

export function applyRouteActions(routes: Route[], actions: RouteAction[]): Route[] {
  return actions.reduce(
    (current, action) => current.map((route) => applyRouteAction(route, action)),
    routes,
  );
}

export async function fetchBinHealth(token: string): Promise<BinHealth[]> {
  return (await authed("/api/v1/bins/health", token).then((r) => r.json())) as BinHealth[];
}

export async function fetchCollectList(token: string): Promise<BinHealth[]> {
  return (await fetchBinHealth(token)).filter((b) => b.recommendation !== "no_action");
}

export async function markCollected(token: string, binId: string): Promise<void> {
  await authed("/api/v1/collections", token, {
    method: "POST",
    body: JSON.stringify({ bin_id: binId }),
  });
}
