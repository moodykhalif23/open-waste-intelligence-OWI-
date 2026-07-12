export interface BinHealth {
  bin_id: string;
  qr_code: string;
  site_name: string;
  fill_pct: number;
  days_since_collection: number | null;
  overflow_risk: "low" | "medium" | "high";
  recommendation: "collect_today" | "schedule_soon" | "no_action";
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

export async function fetchCollectList(token: string): Promise<BinHealth[]> {
  const all = (await authed("/api/v1/bins/health", token).then((r) => r.json())) as BinHealth[];
  return all.filter((b) => b.recommendation !== "no_action");
}

export async function markCollected(token: string, binId: string): Promise<void> {
  await authed("/api/v1/collections", token, {
    method: "POST",
    body: JSON.stringify({ bin_id: binId }),
  });
}
