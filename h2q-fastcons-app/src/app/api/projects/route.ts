import { NextResponse } from "next/server";
import { addToLedger, emptyLedger, jsonError, loadSettings, requireUser } from "@/lib/data/field";
import { requireAdmin } from "@/lib/data/people";
import type { BoqRecord, MeasurementRecord, ProjectRecord } from "@/lib/supabase/database.types";
import type { ProjectRow } from "@/lib/domain/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const gate = await requireUser();
  if (!gate.user || !gate.supabase) return gate.response;

  const { supabase } = gate;
  const url = new URL(request.url);
  const all = url.searchParams.get("all") === "1";
  const lite = url.searchParams.get("lite") === "1";

  let query = supabase
    .from("projects")
    .select("id, code, name, status, company, customer, expected_start_date, expected_end_date")
    .order("name");
  if (!all) query = query.eq("status", "Open");
  const { data: projects, error } = await query;
  if (error) return jsonError(error.message, 400);

  const rows = (projects || []) as Pick<
    ProjectRecord,
    "id" | "code" | "name" | "status" | "company" | "customer" | "expected_start_date" | "expected_end_date"
  >[];

  // Picker / archive: names only — no BOQ or measurement scan.
  if (lite) {
    const payload: ProjectRow[] = rows.map((project) => ({
      name: project.code,
      project_name: project.name,
      status: project.status,
      percent_complete: 0,
      boq_progress_percent: 0,
      percent_complete_display: 0,
      progress_source: "BOQ Qty",
      expected_start_date: project.expected_start_date,
      expected_end_date: project.expected_end_date,
      company: project.company,
      customer: project.customer,
    }));
    return NextResponse.json({ projects: payload, count: payload.length, lite: true });
  }

  const ids = rows.map((row) => row.id);
  const settings = await loadSettings(supabase).catch(() => null);
  const source = settings?.dashboard_progress_source || "BOQ Qty";

  const plannedQty = new Map<string, number>();
  const plannedAmt = new Map<string, number>();
  const doneQty = new Map<string, number>();
  const doneAmt = new Map<string, number>();

  if (ids.length) {
    const [boqRes, slipRes] = await Promise.all([
      supabase.from("boq_items").select("id, project_id, planned_qty, rate").in("project_id", ids),
      supabase
        .from("measurements")
        .select("project_id, boq_item_id, quantity, rate, entry_kind, approval_status")
        .in("project_id", ids)
        .in("approval_status", ["Approved", "Pending Approval"]),
    ]);
    if (boqRes.error) return jsonError(boqRes.error.message, 400);
    if (slipRes.error) return jsonError(slipRes.error.message, 400);

    const items = (boqRes.data || []) as Pick<BoqRecord, "id" | "project_id" | "planned_qty" | "rate">[];
    const slips = (slipRes.data || []) as Pick<
      MeasurementRecord,
      "project_id" | "boq_item_id" | "quantity" | "rate" | "entry_kind" | "approval_status"
    >[];

    const rateByBoq = new Map<string, number>();
    for (const item of items) {
      const pid = item.project_id;
      const qty = Number(item.planned_qty || 0);
      const rate = Number(item.rate || 0);
      plannedQty.set(pid, (plannedQty.get(pid) || 0) + qty);
      plannedAmt.set(pid, (plannedAmt.get(pid) || 0) + qty * rate);
      rateByBoq.set(item.id, rate);
    }

    // O(slips) — not O(boq × slips).
    for (const slip of slips) {
      const ledger = emptyLedger();
      addToLedger(ledger, slip);
      if (!ledger.executed) continue;
      const pid = slip.project_id;
      const rate = slip.boq_item_id ? rateByBoq.get(slip.boq_item_id) ?? Number(slip.rate || 0) : Number(slip.rate || 0);
      doneQty.set(pid, (doneQty.get(pid) || 0) + ledger.executed);
      doneAmt.set(pid, (doneAmt.get(pid) || 0) + ledger.executed * rate);
    }
  }

  const payload: ProjectRow[] = rows.map((project) => {
    const plannedQ = plannedQty.get(project.id) || 0;
    const plannedA = plannedAmt.get(project.id) || 0;
    const doneQ = doneQty.get(project.id) || 0;
    const doneA = doneAmt.get(project.id) || 0;
    const percent =
      source === "BOQ Amount"
        ? plannedA > 0
          ? (doneA / plannedA) * 100
          : 0
        : plannedQ > 0
          ? (doneQ / plannedQ) * 100
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

function text(value: unknown) {
  const trimmed = String(value || "").trim();
  return trimmed || null;
}

export async function POST(request: Request) {
  const gate = await requireAdmin();
  if (!gate.user || !gate.supabase) return gate.response;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const code = String(body?.code || "").trim();
  const name = String(body?.name || "").trim();
  if (!code || !name) return jsonError("Nhập mã và tên công trình.", 400);

  const inserted = await gate.supabase
    .from("projects")
    .insert({
      code,
      name,
      status: text(body?.status) || "Open",
      company: text(body?.company),
      customer: text(body?.customer),
      expected_start_date: text(body?.expected_start_date),
      expected_end_date: text(body?.expected_end_date),
    })
    .select("id, code")
    .single();
  if (inserted.error || !inserted.data) {
    const message = inserted.error?.message.includes("duplicate")
      ? "Mã công trình đã tồn tại."
      : inserted.error?.message || "Không tạo được công trình.";
    return jsonError(message, 400);
  }
  const saved = inserted.data as { id: string; code: string };
  await gate.supabase.from("project_members").insert({
    project_id: saved.id,
    user_id: gate.user.id,
    member_role: "admin",
  });
  return NextResponse.json({ code: saved.code });
}
