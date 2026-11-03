import { NextResponse } from "next/server";
import {
  addToLedger,
  emptyLedger,
  geofenceRing,
  jsonError,
  requireUser,
} from "@/lib/data/field";
import type { BoqRecord, MeasurementRecord, ProjectRecord, TaskRecord } from "@/lib/supabase/database.types";
import type { BoqItemRow, ProjectWbsData, TaskRow } from "@/lib/domain/types";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const gate = await requireUser();
  if (!gate.user || !gate.supabase) return gate.response;
  const { id } = await params;
  const code = decodeURIComponent(id);
  const { supabase } = gate;

  const { data: project, error } = await supabase
    .from("projects")
    .select("*")
    .eq("code", code)
    .maybeSingle();
  if (error) return jsonError(error.message, 400);
  if (!project) return jsonError("Không tìm thấy công trình hoặc bạn chưa được phân công.", 404);
  const row = project as ProjectRecord;

  const [taskRes, boqRes, slipRes] = await Promise.all([
    supabase.from("tasks").select("*").eq("project_id", row.id).order("code"),
    supabase.from("boq_items").select("*").eq("project_id", row.id).order("code"),
    supabase
      .from("measurements")
      .select("boq_item_id, quantity, entry_kind, approval_status")
      .eq("project_id", row.id),
  ]);
  if (taskRes.error) return jsonError(taskRes.error.message, 400);
  if (boqRes.error) return jsonError(boqRes.error.message, 400);
  if (slipRes.error) return jsonError(slipRes.error.message, 400);

  const slips = (slipRes.data || []) as Pick<
    MeasurementRecord,
    "boq_item_id" | "quantity" | "entry_kind" | "approval_status"
  >[];
  const boqRows = ((boqRes.data || []) as BoqRecord[]).map((item) => toBoq(item, slips));
  const tasks = ((taskRes.data || []) as TaskRecord[]).map<TaskRow>((task) => ({
    name: task.id,
    code: task.code,
    subject: task.subject,
    parent_task: task.parent_id,
    status: task.status,
    is_group: task.is_group ? 1 : 0,
    boq_items: boqRows.filter((item) => item.task === task.id),
  }));

  const body: ProjectWbsData = {
    project: row.code,
    project_name: row.name,
    tasks,
    boqs: [],
    boq_items: boqRows,
    site_geofence: geofenceRing(row.geofence) ? { ring: geofenceRing(row.geofence)! } : null,
  };
  return NextResponse.json(body);
}

function toBoq(
  item: BoqRecord,
  slips: Pick<MeasurementRecord, "boq_item_id" | "quantity" | "entry_kind" | "approval_status">[],
): BoqItemRow {
  const ledger = emptyLedger();
  for (const slip of slips) {
    if (slip.boq_item_id !== item.id) continue;
    addToLedger(ledger, slip);
  }
  const planned = Number(item.planned_qty) || 0;
  const rate = Number(item.rate) || 0;
  return {
    name: item.id,
    code: item.code,
    description: item.description,
    unit: item.unit || undefined,
    planned_qty: planned,
    rate,
    planned_amount: planned * rate,
    executed_qty: ledger.executed,
    executed_pending_qty: ledger.executed_pending,
    accepted_qty: ledger.accepted,
    accepted_pending_qty: ledger.accepted_pending,
    actual_qty: ledger.executed,
    actual_amount: ledger.executed * rate,
    remaining_qty: planned - ledger.executed,
    acceptance_room: (ledger.executed > 0 ? ledger.executed : planned) - ledger.accepted - ledger.accepted_pending,
    progress_percent: planned > 0 ? (ledger.executed / planned) * 100 : null,
    over_limit: planned > 0 && ledger.executed > planned ? 1 : 0,
    task: item.task_id,
  };
}
