import { listQueued, remove, type QueuedReport } from "./queue";

export interface SyncSettings {
  apiUrl: string;
  token: string;
}

export interface SyncOutcome {
  sent: number;
  rejected: number;
  remaining: number;
}

interface BatchResult {
  results: { status: "created" | "duplicate" | "rejected" }[];
}

export async function syncQueue(settings: SyncSettings): Promise<SyncOutcome> {
  const all = await listQueued();
  // The server can locate a report from GPS or from a scanned bin QR; without
  // either it would be rejected, so it stays queued for a retried GPS fix.
  const sendable = all.filter((r) => (r.lat !== null && r.lng !== null) || r.binQr !== null);
  if (sendable.length === 0) return { sent: 0, rejected: 0, remaining: all.length };

  const form = new FormData();
  form.append("meta", JSON.stringify(sendable.map(toMeta)));
  for (const report of sendable) form.append("files", report.image, `${report.id}.jpg`);

  const response = await fetch(`${settings.apiUrl}/api/v1/observations/batch`, {
    method: "POST",
    headers: { Authorization: `Bearer ${settings.token}` },
    body: form,
  });
  if (!response.ok) throw new Error(`sync failed: HTTP ${response.status}`);

  const { results } = (await response.json()) as BatchResult;
  let sent = 0;
  let rejected = 0;
  for (const [i, result] of results.entries()) {
    const report = sendable[i];
    if (!report) continue;
    await remove(report.id);
    if (result.status === "rejected") rejected += 1;
    else sent += 1;
  }
  return { sent, rejected, remaining: all.length - sendable.length };
}

function toMeta(report: QueuedReport) {
  return {
    captured_at: report.capturedAt,
    lat: report.lat,
    lng: report.lng,
    bin_qr: report.binQr,
    fill_tap: report.fillTap,
  };
}
