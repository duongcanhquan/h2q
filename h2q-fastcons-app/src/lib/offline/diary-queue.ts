"use client";

import { submitSiteDiary } from "@/lib/api/client";
import { ApiError, isRetryable } from "@/lib/api/errors";
import type { SiteDiaryPayload } from "@/lib/domain/types";

const IDB_NAME = "h2q-fastcons-diary";
const IDB_STORE = "pending_diaries";

export type QueuedDiary = SiteDiaryPayload & {
  client_request_id: string;
  saved_at: number;
};

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: "client_request_id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(row: QueuedDiary) {
  const db = await openIdb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(row);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbAll(): Promise<QueuedDiary[]> {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).getAll();
    req.onsuccess = () => resolve((req.result || []) as QueuedDiary[]);
    req.onerror = () => reject(req.error);
  });
}

async function idbDelete(id: string) {
  const db = await openIdb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function enqueueSiteDiary(
  payload: SiteDiaryPayload,
): Promise<{ mode: "saved" | "indexeddb"; entries?: string[] }> {
  try {
    const saved = await submitSiteDiary(payload);
    return { mode: "saved", entries: saved.entries };
  } catch (err) {
    if (!(err instanceof ApiError) || !isRetryable(err)) throw err;
    const client_request_id =
      payload.client_request_id ||
      (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `diary_${Date.now()}`);
    await idbPut({ ...payload, client_request_id, saved_at: Date.now() });
    return { mode: "indexeddb" };
  }
}

export async function drainSiteDiaryQueue(): Promise<number> {
  const rows = await idbAll().catch(() => []);
  let drained = 0;
  for (const row of rows) {
    try {
      await submitSiteDiary(row);
      await idbDelete(row.client_request_id);
      drained += 1;
    } catch (err) {
      if (!(err instanceof ApiError) || !isRetryable(err)) {
        await idbDelete(row.client_request_id).catch(() => undefined);
      }
    }
  }
  return drained;
}
