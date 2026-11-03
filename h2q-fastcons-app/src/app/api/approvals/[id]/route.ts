import { NextResponse } from "next/server";
import { jsonError, loadSettings, requireUser } from "@/lib/data/field";
import { notifyTelegram } from "@/lib/notify/telegram";
import type { Json, MeasurementRecord } from "@/lib/supabase/database.types";
import type { MeasurementApprovalResult } from "@/lib/domain/types";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const gate = await requireUser();
  if (!gate.user || !gate.supabase) return gate.response;
  const { supabase } = gate;
  const { id } = await params;
  const slipCode = decodeURIComponent(id);

  let action = "";
  let reason = "";
  try {
    const body = (await request.json()) as { action?: string; reason?: string };
    action = body.action === "reject" ? "reject" : body.action === "approve" ? "approve" : "";
    reason = body.reason?.trim() || "";
  } catch {
    return jsonError("Dữ liệu duyệt không đọc được.", 400);
  }
  if (!action) return jsonError("Thiếu thao tác duyệt hoặc từ chối.", 400);

  const found = await supabase
    .from("measurements")
    .select("id, slip_code, image_urls, entry_kind")
    .eq("slip_code", slipCode)
    .maybeSingle();
  if (found.error) return jsonError(found.error.message, 400);
  if (!found.data) return jsonError("Không tìm thấy phiếu.", 404);
  const slip = found.data as Pick<MeasurementRecord, "id" | "slip_code" | "image_urls" | "entry_kind">;

  if (action === "approve") {
    const settings = await loadSettings(supabase);
    const photos = slip.image_urls?.length || 0;
    if (settings.min_photos_on_approve > 0 && photos < settings.min_photos_on_approve) {
      return jsonError(`Cần tối thiểu ${settings.min_photos_on_approve} ảnh trước khi duyệt.`, 400);
    }
  }

  const decided = await supabase.rpc("decide_measurement", {
    p_id: slip.id,
    p_action: action,
    p_reason: reason || null,
  });
  if (decided.error) return jsonError(decided.error.message, 400);

  const result = (decided.data || {}) as Json;
  const payload = (typeof result === "object" && result && !Array.isArray(result) ? result : {}) as Record<
    string,
    Json | undefined
  >;
  const body: MeasurementApprovalResult = {
    measurement_book: String(payload.measurement_book || slip.slip_code),
    approval_status: payload.approval_status ? String(payload.approval_status) : undefined,
    approval_level: numberOrUndefined(payload.approval_level),
    approval_levels: numberOrUndefined(payload.approval_levels),
    awaiting_next_level: numberOrUndefined(payload.awaiting_next_level),
    certified: numberOrUndefined(payload.certified),
    entry_kind: payload.entry_kind ? String(payload.entry_kind) : slip.entry_kind,
    ledger: payload.ledger ? String(payload.ledger) : undefined,
    measured_total: numberOrUndefined(payload.measured_total),
  };

  const settings = await loadSettings(supabase).catch(() => null);
  if (settings?.telegram_enabled) {
    const verb =
      body.awaiting_next_level
        ? "chuyển cấp"
        : action === "reject"
          ? "từ chối"
          : body.certified
            ? "chứng nhận"
            : "duyệt sản lượng";
    void notifyTelegram(`Phiếu ${body.measurement_book} đã ${verb}.`);
  }

  return NextResponse.json(body);
}

function numberOrUndefined(value: Json | undefined) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value !== "" && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}
