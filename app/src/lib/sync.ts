import { listQueued, remove, type QueuedReport } from "./queue";

export interface SyncOutcome {
  sent: number;
  rejected: number;
  remaining: number;
}

export class SyncError extends Error {
  constructor(readonly status: number) {
    super(`sync failed: HTTP ${status}`);
  }
}

interface BatchResult {
  results: { status: "created" | "duplicate" | "rejected"; observation_id: string }[];
}

export interface RecentReport {
  id: string;
  at: string;
}

const RECENT_KEY = "owi-recent-synced";
const RECENT_MAX = 20;

export function recentSynced(): RecentReport[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as RecentReport[];
  } catch {
    return [];
  }
}

function rememberSynced(ids: string[]): void {
  const now = new Date().toISOString();
  const merged = [...ids.map((id) => ({ id, at: now })), ...recentSynced()];
  const unique = merged.filter((r, i) => merged.findIndex((m) => m.id === r.id) === i);
  localStorage.setItem(RECENT_KEY, JSON.stringify(unique.slice(0, RECENT_MAX)));
}

function forgetSynced(id: string): void {
  localStorage.setItem(RECENT_KEY, JSON.stringify(recentSynced().filter((r) => r.id !== id)));
}

// Do-not-use: the server hard-deletes the photo and retires the record.
export async function eraseObservation(token: string, id: string): Promise<void> {
  const response = await fetch(`/api/v1/observations/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok && response.status !== 404) throw new SyncError(response.status);
  forgetSynced(id);
}

export async function syncQueue(token: string): Promise<SyncOutcome> {
  const all = await listQueued();
  // The server can locate a report from GPS or from a scanned bin QR; without
  // either it would be rejected, so it stays queued for a retried GPS fix.
  const sendable = all.filter((r) => (r.lat !== null && r.lng !== null) || r.binQr !== null);
  if (sendable.length === 0) return { sent: 0, rejected: 0, remaining: all.length };

  const form = new FormData();
  form.append("meta", JSON.stringify(sendable.map(toMeta)));
  for (const report of sendable) form.append("files", report.image, `${report.id}.jpg`);

  const response = await fetch("/api/v1/observations/batch", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!response.ok) throw new SyncError(response.status);

  const { results } = (await response.json()) as BatchResult;
  let sent = 0;
  let rejected = 0;
  const synced: string[] = [];
  for (const [i, result] of results.entries()) {
    const report = sendable[i];
    if (!report) continue;
    await remove(report.id);
    if (result.status === "rejected") rejected += 1;
    else {
      sent += 1;
      synced.push(result.observation_id);
    }
  }
  rememberSynced(synced);
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
