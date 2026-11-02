"use client";

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import type { SubmitMeasurementPayload } from "@/lib/frappe/types";
import type { MeasurementsSyncRow } from "@/lib/supabase/database.types";

const IDB_NAME = "h2q-fastcons";
const IDB_STORE = "pending_measurements";

export type EnqueueInput = SubmitMeasurementPayload & {
  frappe_user?: string;
  client_request_id?: string;
  project_name?: string;
  uom?: string;
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

/**
 * Offline-first enqueue:
 * 1) Write IndexedDB always
 * 2) Try insert into Supabase `measurements_sync`
 * 3) Trigger Next.js flush worker (best-effort)
 */
export async function enqueueMeasurement(input: EnqueueInput): Promise<{
  mode: "supabase" | "indexeddb";
  client_request_id: string;
  sync_id?: string;
}> {
  const client_request_id =
    input.client_request_id ||
    (typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `req_${Date.now()}`);

  const localRow = { ...input, client_request_id, saved_at: Date.now() };
  await idbPut(localRow);

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return { mode: "indexeddb", client_request_id };
  }

  const imageUrls = input.image_urls || [];
  const description =
    input.description || input.task || "Field measurement";
  if (!input.work_order) {
    console.warn(
      "[measurements] work_order missing — BuildSuite MB requires it; flush may auto-resolve",
    );
  }

  const { data, error } = await supabase
    .from("measurements_sync")
    .insert({
      work_order: input.work_order || "PENDING_RESOLVE",
      project: input.project,
      measurement_date: input.date || new Date().toISOString().slice(0, 10),
      task: input.task,
      description,
      quantity: input.quantity,
      uom: input.uom || null,
      rate: input.rate ?? null,
      billed_amount: input.billed_amount ?? null,
      image_url: imageUrls[0] || null,
      image_urls: imageUrls,
      is_synced_to_frappe: false,
      boq_item: input.boq_item || null,
      remarks: input.remarks || null,
      frappe_user: input.frappe_user || null,
      client_request_id,
      sync_status: "pending",
      status: "Draft",
      approval_status: "Draft",
      gps_lat: input.gps_lat ?? null,
      gps_lng: input.gps_lng ?? null,
      gps_accuracy: input.gps_accuracy ?? null,
      auto_request_approval: Boolean(input.auto_request_approval),
      boq_over_limit: false,
    })
    .select("id")
    .single();

  if (error) {
    // Stay offline-local; flush later when network returns
    console.warn("[measurements] Supabase insert deferred:", error.message);
    return { mode: "indexeddb", client_request_id };
  }

  // Kick Next.js → Frappe bridge (uses httpOnly sid)
  void fetch("/api/sync/flush-measurements", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ client_request_id }),
  }).catch(() => undefined);

  await idbDelete(client_request_id).catch(() => undefined);

  return {
    mode: "supabase",
    client_request_id,
    sync_id: (data as { id?: string } | null)?.id,
  };
}

/** Flush IndexedDB leftovers into Supabase when back online */
export async function drainLocalMeasurementQueue(): Promise<number> {
  const rows = await idbGetAll();
  if (!rows.length) return 0;
  let drained = 0;
  for (const row of rows) {
    try {
      const res = await enqueueMeasurement(row);
      if (res.mode === "supabase") drained += 1;
    } catch {
      // keep in IDB
    }
  }
  return drained;
}

export async function listRecentSyncForProject(
  projectId: string,
): Promise<MeasurementsSyncRow[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("measurements_sync")
    .select("*")
    .eq("project", projectId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return [];
  return (data || []) as MeasurementsSyncRow[];
}
