import { NextResponse } from "next/server";
import { jsonError } from "@/lib/data/field";
import { fail, officeRead, officeWrite, projectByCode } from "@/lib/data/registers";
import type { ProjectRecord, SubcontractorRow, WorkOrderLineRow, WorkOrderRow } from "@/lib/supabase/database.types";

export const runtime = "nodejs";

export async function GET() {
  const gate = await officeRead();
  if (!gate.user || !gate.supabase) return gate.response;
  try {
    const [orders, lines, subs, projects] = await Promise.all([
      gate.supabase.from("work_orders").select("*").order("created_at", { ascending: false }),
      gate.supabase.from("work_order_lines").select("work_order_id, qty, rate"),
      gate.supabase.from("subcontractors").select("*").order("name"),
      gate.supabase.from("projects").select("id, code, name").order("name"),
    ]);
    for (const result of [orders, lines, subs, projects]) {
      if (result.error) return jsonError(result.error.message, 400);
    }
    const parties = new Map((subs.data as SubcontractorRow[]).map((row) => [row.id, row.name]));
    const names = new Map((projects.data as Pick<ProjectRecord, "id" | "code" | "name">[]).map((row) => [row.id, row]));
    const sov = (lines.data || []) as Pick<WorkOrderLineRow, "work_order_id" | "qty" | "rate">[];
    const rows = ((orders.data || []) as WorkOrderRow[]).map((order) => {
      const value = sov.filter((line) => line.work_order_id === order.id).reduce((sum, line) => sum + Number(line.qty) * Number(line.rate), 0);
      const project = names.get(order.project_id);
      const retention = value * (Number(order.retention_percent) || 0) / 100;
      return {
        ...order,
        party_name: parties.get(order.subcontractor_id) || "",
        project_code: project?.code || "",
        project_name: project?.name || "",
        contract_value: value,
        retention_amount: retention,
        payable: value - retention,
      };
    });
    return NextResponse.json({ rows, parties: subs.data || [], projects: projects.data || [] });
  } catch (err) {
    return fail(err, "Không tải được hợp đồng giao thầu.");
  }
}

export async function POST(request: Request) {
  const gate = await officeWrite();
  if (!gate.user || !gate.supabase) return gate.response;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (body?.kind === "party") {
    const name = String(body.name || "").trim();
    if (!name) return jsonError("Nhập tên thầu phụ.", 400);
    const inserted = await gate.supabase.from("subcontractors").insert({
      name,
      tax_code: String(body.tax_code || "").trim() || null,
      phone: String(body.phone || "").trim() || null,
    }).select("id").single();
    if (inserted.error) return jsonError(inserted.error.message, 400);
    return NextResponse.json({ id: (inserted.data as { id: string }).id });
  }
  const project = await projectByCode(gate.supabase, String(body?.project_code || "")).catch((err: Error) => err);
  if (project instanceof Error) return jsonError(project.message, 400);
  if (!project) return jsonError("Không tìm thấy công trình.", 404);
  const code = String(body?.code || "").trim();
  const title = String(body?.title || "").trim();
  if (!code || !title || !body?.subcontractor_id) return jsonError("Nhập mã, tên hợp đồng và thầu phụ.", 400);
  const inserted = await gate.supabase.from("work_orders").insert({
    project_id: project.id,
    subcontractor_id: String(body.subcontractor_id),
    code,
    title,
    retention_percent: Number(body.retention_percent || 0) || 0,
    status: "Draft",
  }).select("id").single();
  if (inserted.error) return jsonError(inserted.error.message.includes("duplicate") ? "Mã hợp đồng đã có trong công trình." : inserted.error.message, 400);
  const orderId = (inserted.data as { id: string }).id;
  const description = String(body.description || title).trim();
  const qty = Number(body.qty || 0) || 0;
  const rate = Number(body.rate || 0) || 0;
  if (description && (qty || rate)) {
    await gate.supabase.from("work_order_lines").insert({
      work_order_id: orderId,
      description,
      unit: String(body.unit || "").trim() || null,
      qty,
      rate,
      boq_item_id: body.boq_item_id ? String(body.boq_item_id) : null,
    });
  }
  return NextResponse.json({ id: orderId });
}
