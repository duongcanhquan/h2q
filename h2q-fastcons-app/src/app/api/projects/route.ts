import { NextResponse } from "next/server";
import { addToLedger, emptyLedger, jsonError, loadSettings, requireUser } from "@/lib/data/field";
import type { BoqRecord, MeasurementRecord, ProjectRecord } from "@/lib/supabase/database.types";
import type { ProjectRow } from "@/lib/domain/types";

export const runtime = "nodejs";

export async function GET() {
  const gate = await requireUser();
  if (!gate.user || !gate.supabase) return gate.response;

  const { supabase } = gate;
  const { data: projects, error } = await supabase
    .from("projects")
    .select("*")
    .eq("status", "Open")
    .order("name");
  if (error) return jsonError(error.message, 400);

  const rows = (projects || []) as ProjectRecord[];
  const ids = rows.map((row) => row.id);
  const settings = await loadSettings(supabase).catch(() => null);
  const source = settings?.dashboard_progress_source || "BOQ Qty";

  let items: BoqRecord[] = [];
  let slips: Pick<MeasurementRecord, "project_id" | "boq_item_id" | "quantity" | "rate" | "entry_kind" | "approval_status">[] = [];
  if (ids.length) {
    const [boqRes, slipRes] = await Promise.all([
      supabase.from("boq_items").select("*").in("project_id", ids),
      supabase
        .from("measurements")
        .select("project_id, boq_item_id, quantity, rate, entry_kind, approval_status")
        .in("project_id", ids),
    ]);
    if (boqRes.error) return jsonError(boqRes.error.message, 400);
    if (slipRes.error) return jsonError(slipRes.error.message, 400);
    items = (boqRes.data || []) as BoqRecord[];
    slips = (slipRes.data || []) as typeof slips;
  }

  const payload: ProjectRow[] = rows.map((project) => {
    const projectItems = items.filter((item) => item.project_id === project.id);
    const plannedQty = projectItems.reduce((sum, item) => sum + Number(item.planned_qty || 0), 0);
    const plannedAmt = projectItems.reduce(
      (sum, item) => sum + Number(item.planned_qty || 0) * Number(item.rate || 0),
      0,
    );
    let doneQty = 0;
    let doneAmt = 0;
    for (const item of projectItems) {
      const ledger = emptyLedger();
      for (const slip of slips) {
        if (slip.boq_item_id !== item.id) continue;
        addToLedger(ledger, slip);
      }
      doneQty += ledger.executed;
      doneAmt += ledger.executed * Number(item.rate || 0);
    }
    const percent =
      source === "BOQ Amount"
        ? plannedAmt > 0
          ? (doneAmt / plannedAmt) * 100
          : 0
        : plannedQty > 0
          ? (doneQty / plannedQty) * 100
          : 0;

    return {
      name: project.code,
      project_name: project.name,
      status: project.status,
      percent_complete: percent,
      boq_progress_percent: percent,
      percent_complete_display: percent,
      progress_source: source,
      expected_start_date: project.expected_start_date,
      expected_end_date: project.expected_end_date,
      company: project.company,
      customer: project.customer,
    };
  });

  return NextResponse.json({ projects: payload, count: payload.length });
}
