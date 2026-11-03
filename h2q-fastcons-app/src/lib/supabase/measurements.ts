"use client";

import { submitMeasurement } from "@/lib/api/client";
import { ApiError, isRetryable } from "@/lib/api/errors";
import type { SubmitMeasurementPayload } from "@/lib/domain/types";

const IDB_NAME = "h2q-fastcons";
const IDB_STORE = "pending_measurements";

export type EnqueueInput = SubmitMeasurementPayload & {
  client_request_id?: string;
  project_name?: string;
};

async function openIdb(): Promise<IDBDatabase> {
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

async function idbPut(row: Record<string, unknown>) {
  const db = await openIdb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(row);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGetAll(): Promise<EnqueueInput[]> {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).getAll();
    req.onsuccess = () => resolve((req.result || []) as EnqueueInput[]);
    req.onerror = () => reject(req.error);
  });
}

async function idbDelete(clientRequestId: string) {
  const db = await openIdb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(clientRequestId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function enqueueMeasurement(input: EnqueueInput): Promise<{
  mode: "saved" | "indexeddb";
  client_request_id: string;
}> {
  const client_request_id =
    input.client_request_id ||
    (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `req_${Date.now()}`);
  const payload = { ...input, client_request_id };
  await idbPut({ ...payload, saved_at: Date.now() });

  try {
    await submitMeasurement(payload);
    await idbDelete(client_request_id).catch(() => undefined);
    return { mode: "saved", client_request_id };
  } catch (err) {
    if (err instanceof ApiError && isRetryable(err)) {
      return { mode: "indexeddb", client_request_id };
    }
    if (!(err instanceof ApiError) || err.status !== 401) {
      await idbDelete(client_request_id).catch(() => undefined);
    }
    throw err;
  }
}

export async function drainLocalMeasurementQueue(): Promise<number> {
  const rows = await idbGetAll().catch(() => []);
  let drained = 0;
  for (const row of rows) {
    try {
      const res = await enqueueMeasurement(row);
      if (res.mode === "saved") drained += 1;
    } catch {
      // A rejected slip is removed inside enqueueMeasurement.
    }
  }
  return drained;
}
