import { apiUrl } from "./api";
import { listQueued, remove, type QueuedReport } from "./queue";

interface SyncOutcome {
  sent: number;
  rejected: number;
  rejectedReasons: string[];
  unlocatable: number;
  remaining: number;
}

const CHUNK = 10;
const RETRYABLE = new Set([401, 403, 408, 425, 429]);

export class SyncError extends Error {
  constructor(readonly status: number) {
    super(`sync failed: HTTP ${status}`);
  }
}

interface BatchResult {
  results: { status: "created" | "duplicate" | "rejected"; observation_id: string; detail?: string | null }[];
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
  const response = await fetch(apiUrl(`/api/v1/observations/${id}`), {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok && response.status !== 404) throw new SyncError(response.status);
  forgetSynced(id);
}

export const isLocatable = (r: QueuedReport) => (r.lat !== null && r.lng !== null) || r.binQr !== null;

export async function discardUnlocatable(): Promise<void> {
  for (const report of await listQueued()) if (!isLocatable(report)) await remove(report.id);
}

async function postBatch(token: string, reports: QueuedReport[]): Promise<Response> {
  const form = new FormData();
  form.append("meta", JSON.stringify(reports.map(toMeta)));
  for (const report of reports) form.append("files", report.image, `${report.id}.jpg`);
  return fetch(apiUrl("/api/v1/observations/batch"), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
}

const permanent = (status: number) => status >= 400 && status < 500 && !RETRYABLE.has(status);

export async function syncQueue(token: string): Promise<SyncOutcome> {
  const all = await listQueued();
  const sendable = all.filter(isLocatable);
  const outcome: SyncOutcome = {
    sent: 0,
    rejected: 0,
    rejectedReasons: [],
    unlocatable: all.length - sendable.length,
    remaining: all.length - sendable.length,
  };
  const synced: string[] = [];

  const settle = async (report: QueuedReport, result: BatchResult["results"][number]) => {
    await remove(report.id);
    if (result.status === "rejected") {
      outcome.rejected += 1;
      if (result.detail) outcome.rejectedReasons.push(result.detail);
    } else {
      outcome.sent += 1;
      synced.push(result.observation_id);
    }
  };

  try {
    for (let i = 0; i < sendable.length; i += CHUNK) {
      const chunk = sendable.slice(i, i + CHUNK);
      const response = await postBatch(token, chunk);
      if (response.ok) {
        const { results } = (await response.json()) as BatchResult;
        for (const [k, result] of results.entries()) if (chunk[k]) await settle(chunk[k], result);
        continue;
      }
      if (!permanent(response.status)) throw new SyncError(response.status);
      for (const report of chunk) {
        const single = await postBatch(token, [report]);
        if (single.ok) {
          const { results } = (await single.json()) as BatchResult;
          if (results[0]) await settle(report, results[0]);
        } else if (permanent(single.status)) {
          await settle(report, { status: "rejected", observation_id: "", detail: `HTTP ${single.status}` });
        } else {
          throw new SyncError(single.status);
        }
      }
    }
  } finally {
    rememberSynced(synced);
  }
  return outcome;
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
