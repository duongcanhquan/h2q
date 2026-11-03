import { NextResponse } from "next/server";
import {
  addToLedger,
  emptyLedger,
  entryKindOf,
  geofenceRing,
  jsonError,
  loadSettings,
  num,
  requireUser,
} from "@/lib/data/field";
import { notifyTelegram } from "@/lib/notify/telegram";
import { cleanRemarks, previewQuantitySlip } from "@/lib/quantity/slip";
import { evaluateGeofence } from "@/lib/geo/geofence";
import type { BoqRecord, MeasurementRecord, ProjectRecord, TaskRecord } from "@/lib/supabase/database.types";
import type { SubmitMeasurementPayload } from "@/lib/domain/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const gate = await requireUser();
  if (!gate.user || !gate.supabase) return gate.response;
  const { supabase, user } = gate;

  let body: SubmitMeasurementPayload;
  try {
    body = (await request.json()) as SubmitMeasurementPayload;
  } catch {
    return jsonError("Dữ liệu phiếu không đọc được.", 400);
  }

  const clientRequestId = body.client_request_id?.trim() || null;
  if (clientRequestId) {
    const existing = await supabase
      .from("measurements")
      .select("id, slip_code, approval_status")
      .eq("client_request_id", clientRequestId)
      .maybeSingle();
    if (existing.data) {
      const row = existing.data as Pick<MeasurementRecord, "slip_code" | "approval_status">;
      return NextResponse.json({
        measurement_book: row.slip_code,
        approval_status: row.approval_status,
        duplicate: true,
      });
    }
  }

  const settings = await loadSettings(supabase);
  if (!settings.enable_measurement_book) {
    return jsonError("Sổ khối lượng đang tắt.", 400);
  }

  const qty = num(body.quantity);
  if (qty == null || qty === 0) return jsonError("Nhập khối lượng khác 0.", 400);
  if (!body.project || !body.task) return jsonError("Thiếu công trình hoặc hạng mục.", 400);

  const imageUrls = (body.image_urls || []).map((url) => url.trim()).filter(Boolean);
  if (settings.min_photos_on_submit > 0 && imageUrls.length < settings.min_photos_on_submit) {
    return jsonError(`Cần tối thiểu ${settings.min_photos_on_submit} ảnh.`, 400);
  }
  if (settings.gps_required && (num(body.gps_lat) == null || num(body.gps_lng) == null)) {
    return jsonError("GPS bắt buộc.", 400);
  }

  const projectRes = await supabase.from("projects").select("*").eq("code", body.project).maybeSingle();
  if (projectRes.error) return jsonError(projectRes.error.message, 400);
  if (!projectRes.data) return jsonError("Không tìm thấy công trình.", 404);
  const project = projectRes.data as ProjectRecord;

  const taskRes = await supabase
    .from("tasks")
    .select("*")
    .eq("id", body.task)
    .eq("project_id", project.id)
    .maybeSingle();
  if (taskRes.error) return jsonError(taskRes.error.message, 400);
  if (!taskRes.data) return jsonError("Hạng mục không thuộc công trình này.", 400);
  const task = taskRes.data as TaskRecord;

  let boq: BoqRecord | null = null;
  if (body.boq_item) {
    const boqRes = await supabase
      .from("boq_items")
      .select("*")
      .eq("id", body.boq_item)
      .eq("project_id", project.id)
      .maybeSingle();
    if (boqRes.error) return jsonError(boqRes.error.message, 400);
    boq = (boqRes.data as BoqRecord | null) ?? null;
  }

  const kind = entryKindOf(body.entry_kind);
  const remarks = cleanRemarks(body.remarks);
  let overLimit = false;
  if (boq) {
    const slipRes = await supabase
      .from("measurements")
      .select("quantity, entry_kind, approval_status")
      .eq("boq_item_id", boq.id);
    if (slipRes.error) return jsonError(slipRes.error.message, 400);
    const ledger = emptyLedger();
    for (const slip of slipRes.data || []) addToLedger(ledger, slip);
    const preview = previewQuantitySlip({
      kind,
      qty,
      contract: Number(boq.planned_qty) || 0,
      executed: ledger.executed,
      accepted: ledger.accepted,
      pendingExecuted: ledger.executed_pending,
      policy: settings.boq_over_limit_policy,
      hasNote: Boolean(remarks),
    });
    if (preview.action === "block") return jsonError(preview.message, 400);
    overLimit = preview.over;
  }

  const fence = evaluateGeofence(
    settings.geofence_enforcement,
    num(body.gps_lat),
    num(body.gps_lng),
    geofenceRing(project.geofence),
  );
  if (fence.action === "block") return jsonError(`${fence.message} Không gửi được.`, 400);

  const approval = settings.auto_request_approval_default ? "Pending Approval" : "Draft";
  const rate = num(body.rate) ?? (boq ? Number(boq.rate) || null : null);
  const billed = num(body.billed_amount) ?? (rate != null ? rate * qty : null);

  const { data: inserted, error: insertError } = await supabase
    .from("measurements")
    .insert({
      project_id: project.id,
      task_id: task.id,
      boq_item_id: boq?.id ?? null,
      created_by: user.id,
      measurement_date: body.date || new Date().toISOString().slice(0, 10),
      quantity: qty,
      entry_kind: kind,
      description: body.description || task.subject,
      remarks: remarks || null,
      uom: body.uom || boq?.unit || null,
      rate,
      billed_amount: billed,
      work_order: body.work_order?.trim() || null,
      image_urls: imageUrls,
      gps_lat: num(body.gps_lat),
      gps_lng: num(body.gps_lng),
      gps_accuracy: num(body.gps_accuracy),
      geofence_outside: fence.outside === 1,
      over_limit: overLimit,
      approval_status: approval,
      client_request_id: clientRequestId,
    })
    .select("slip_code, approval_status, quantity")
    .single();

  if (insertError) return jsonError(insertError.message, 400);
  const saved = inserted as Pick<MeasurementRecord, "slip_code" | "approval_status" | "quantity">;

  if (settings.telegram_enabled) {
    const label = kind === "nghiem_thu" ? "Nghiệm thu" : "Thực hiện";
    void notifyTelegram(
      `${label} ${saved.slip_code} · ${project.name} · KL ${saved.quantity} · ${saved.approval_status}`,
    );
  }

  return NextResponse.json({
    measurement_book: saved.slip_code,
    approval_status: saved.approval_status,
    project: project.code,
    task: task.id,
    measured_total: saved.quantity,
    boq_over_limit_warn: overLimit ? 1 : 0,
  });
}
