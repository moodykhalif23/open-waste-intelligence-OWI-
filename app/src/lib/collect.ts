export interface BinHealth {
  bin_id: string;
  qr_code: string;
  site_name: string;
  fill_pct: number;
  days_since_collection: number | null;
  overflow_risk: "low" | "medium" | "high";
  recommendation: "collect_today" | "schedule_soon" | "no_action";
}

export interface RouteStop {
  id: string;
  seq: number;
  bin_id: string;
  qr_code: string;
  lat: number;
  lng: number;
  collected: boolean;
}

export interface Route {
  id: string;
  truck_name: string;
  planned_km: number;
  planned_fuel_l: number;
  bins_served: number;
  stops: RouteStop[];
}

async function authed(path: string, token: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(path, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(typeof init?.body === "string" ? { "Content-Type": "application/json" } : {}),
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response;
}

export async function fetchRoutes(token: string): Promise<Route[]> {
  return (await authed("/api/v1/routes", token).then((r) => r.json())) as Route[];
}

export async function collectStop(token: string, stopId: string): Promise<void> {
  await authed(`/api/v1/routes/stops/${stopId}/collect`, token, { method: "POST" });
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
