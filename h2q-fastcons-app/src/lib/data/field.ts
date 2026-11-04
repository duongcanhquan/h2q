import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createSupabaseServer } from "@/lib/supabase/server";
import type {
  AppSettingsRow,
  Database,
  MeasurementRecord,
  ProjectRecord,
} from "@/lib/supabase/database.types";
import type { H2qPublicSettings } from "@/lib/domain/types";
import { bucketForSlip } from "@/lib/quantity/slip";

export type Db = SupabaseClient<Database>;

export const SETTINGS_FALLBACK: H2qPublicSettings = {
  enable_measurement_book: 1,
  enable_site_diary: 1,
  enable_client_ra_billing: 0,
  enable_offline_sync: 1,
  dashboard_progress_source: "BOQ Qty",
  ui_profile: "Field Gloves",
  allow_mobile_revise_rejected: 1,
  boq_over_limit_policy: "Warn",
  auto_request_approval_default: 1,
  gps_required: 0,
  geofence_enforcement: "Off",
  min_photos_on_submit: 0,
  min_photos_on_approve: 0,
  sync_retry_max: 5,
  pending_ttl_hours: 72,
  telegram_enabled: 0,
  approval_chain_length: 1,
};

export function jsonError(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

export async function requireUser(): Promise<
  { supabase: Db; user: User } | { supabase: null; user: null; response: NextResponse }
> {
  try {
    const supabase = await createSupabaseServer();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      return { supabase: null, user: null, response: jsonError("Phiên đăng nhập đã hết.", 401) };
    }
    return { supabase, user: data.user };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Chưa cấu hình Supabase.";
    return { supabase: null, user: null, response: jsonError(message, 503) };
  }
}

export function mapSettings(row: AppSettingsRow | null): H2qPublicSettings {
  if (!row) return SETTINGS_FALLBACK;
  return {
    enable_measurement_book: row.enable_measurement_book,
    enable_site_diary: row.enable_site_diary,
    enable_client_ra_billing: row.enable_client_ra_billing,
    enable_offline_sync: row.enable_offline_sync,
    dashboard_progress_source: row.dashboard_progress_source,
    ui_profile: row.ui_profile,
    allow_mobile_revise_rejected: row.allow_mobile_revise_rejected,
    boq_over_limit_policy: row.boq_over_limit_policy,
    auto_request_approval_default: row.auto_request_approval_default,
    gps_required: row.gps_required,
    geofence_enforcement: row.geofence_enforcement,
    min_photos_on_submit: row.min_photos_on_submit,
    min_photos_on_approve: row.min_photos_on_approve,
    sync_retry_max: row.sync_retry_max,
    pending_ttl_hours: row.pending_ttl_hours,
    telegram_enabled: row.telegram_enabled,
    approval_chain_length: row.approval_chain_length,
  };
}

let settingsMemo: { at: number; value: H2qPublicSettings } | null = null;
const SETTINGS_TTL_MS = 60_000;

export async function loadSettings(supabase: Db) {
  if (settingsMemo && Date.now() - settingsMemo.at < SETTINGS_TTL_MS) {
    return settingsMemo.value;
  }
  const { data, error } = await supabase.from("app_settings").select("*").eq("id", 1).maybeSingle();
  if (error) throw new Error(error.message);
  const value = mapSettings(data);
  settingsMemo = { at: Date.now(), value };
  return value;
}

export function clearSettingsMemo() {
  settingsMemo = null;
}

export function entryKindOf(value: unknown): "thuc_hien" | "nghiem_thu" {
  const raw = String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
  if (raw.includes("nghiem") || raw.includes("acceptance")) return "nghiem_thu";
  return "thuc_hien";
}

export function geofenceRing(value: ProjectRecord["geofence"]): Array<[number, number]> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const ring = value.ring;
  if (!Array.isArray(ring)) return null;
  const points: Array<[number, number]> = [];
  for (const point of ring) {
    if (!Array.isArray(point) || point.length < 2) continue;
    const lat = Number(point[0]);
    const lng = Number(point[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) points.push([lat, lng]);
  }
  return points.length >= 3 ? points : null;
}

export type Ledger = {
  executed: number;
  executed_pending: number;
  accepted: number;
  accepted_pending: number;
};

export function emptyLedger(): Ledger {
  return { executed: 0, executed_pending: 0, accepted: 0, accepted_pending: 0 };
}

export function addToLedger(ledger: Ledger, row: Pick<MeasurementRecord, "entry_kind" | "approval_status" | "quantity">) {
  const bucket = bucketForSlip(row.entry_kind, row.approval_status);
  if (!bucket) return ledger;
  ledger[bucket] += Number(row.quantity) || 0;
  return ledger;
}

export function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
