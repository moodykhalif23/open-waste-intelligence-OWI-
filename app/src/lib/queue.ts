import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export type FillBand = "empty" | "low" | "half" | "high" | "overflowing";

export interface QueuedReport {
  id: string;
  capturedAt: string;
  lat: number | null;
  lng: number | null;
  binQr: string | null;
  fillTap: FillBand | null;
  image: Blob;
}

interface OwiDB extends DBSchema {
  reports: { key: string; value: QueuedReport };
}

let db: Promise<IDBPDatabase<OwiDB>> | null = null;

function getDb(): Promise<IDBPDatabase<OwiDB>> {
  db ??= openDB<OwiDB>("owi", 1, {
    upgrade(database) {
      database.createObjectStore("reports", { keyPath: "id" });
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
