import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { RouteAction } from "./collect";

export type FillBand = "empty" | "low" | "half" | "high" | "overflowing";
export const FILL_BANDS: FillBand[] = ["empty", "low", "half", "high", "overflowing"];

export interface QueuedReport {
  id: string;
  capturedAt: string;
  lat: number | null;
  lng: number | null;
  binQr: string | null;
  fillTap: FillBand | null;
  image: Blob;
}

export type QueuedRouteAction = RouteAction & { seq?: number };

interface OwiDB extends DBSchema {
  reports: { key: string; value: QueuedReport };
  routeActions: { key: number; value: QueuedRouteAction };
}

let db: Promise<IDBPDatabase<OwiDB>> | null = null;

function getDb(): Promise<IDBPDatabase<OwiDB>> {
  db ??= openDB<OwiDB>("owi", 2, {
    upgrade(database, oldVersion) {
      if (oldVersion < 1) database.createObjectStore("reports", { keyPath: "id" });
      if (oldVersion < 2) {
        database.createObjectStore("routeActions", { keyPath: "seq", autoIncrement: true });
      }
    },
  });
  return db;
}

export async function enqueue(report: QueuedReport): Promise<void> {
  await (await getDb()).put("reports", report);
}

export async function listQueued(): Promise<QueuedReport[]> {
  return (await getDb()).getAll("reports");
}

export async function remove(id: string): Promise<void> {
  await (await getDb()).delete("reports", id);
}

export async function enqueueRouteAction(action: RouteAction): Promise<void> {
  await (await getDb()).add("routeActions", action);
}

export async function listRouteActions(): Promise<QueuedRouteAction[]> {
  return (await getDb()).getAll("routeActions");
}

export async function removeRouteAction(seq: number): Promise<void> {
  await (await getDb()).delete("routeActions", seq);
}
