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
}

export interface RouteCompletion {
  actual_distance_km: number | null;
  actual_fuel_l: number;
  actual_weight_kg: number;
}

export interface Route {
  id: string;
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

export async function collectStop(token: string, stopId: string): Promise<void> {
  await authed(`/api/v1/routes/stops/${stopId}/collect`, token, { method: "POST" });
}

export async function startRoute(token: string, routeId: string): Promise<Route> {
  return (await authed(`/api/v1/routes/${routeId}/start`, token, { method: "POST" }).then(
    (r) => r.json(),
  )) as Route;
}

export async function completeRoute(
  token: string,
  routeId: string,
  body: RouteCompletion,
): Promise<Route> {
  return (await authed(`/api/v1/routes/${routeId}/complete`, token, {
    method: "POST",
    body: JSON.stringify(body),
  }).then((r) => r.json())) as Route;
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
