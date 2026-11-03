import { NextResponse } from "next/server";
import { jsonError } from "@/lib/data/field";
import { fail, officeRead, officeWrite, projectByCode } from "@/lib/data/registers";
import type { MaterialPriceRow, MaterialUseRow, ProjectRecord, SupplierRow } from "@/lib/supabase/database.types";

export const runtime = "nodejs";

export async function GET() {
  const gate = await officeRead();
  if (!gate.user || !gate.supabase) return gate.response;
  try {
    const [suppliers, prices, uses, projects, tasks] = await Promise.all([
      gate.supabase.from("suppliers").select("*").order("name"),
      gate.supabase.from("material_prices").select("*").order("effective_on", { ascending: false }),
      gate.supabase.from("material_uses").select("*"),
      gate.supabase.from("projects").select("id, code, name").order("name"),
      gate.supabase.from("tasks").select("id, project_id, code, subject").order("code"),
    ]);
    for (const result of [suppliers, prices, uses, projects, tasks]) {
      if (result.error) return jsonError(result.error.message, 400);
    }
    const parties = (suppliers.data || []) as SupplierRow[];
    const nameOf = new Map(parties.map((row) => [row.id, row.name]));
    const projectOf = new Map((projects.data as Pick<ProjectRecord, "id" | "code" | "name">[]).map((row) => [row.id, row]));
    const taskRows = (tasks.data || []) as { id: string; project_id: string; code: string; subject: string }[];
    const taskOf = new Map(taskRows.map((row) => [row.id, row.subject]));
    const priceOf = new Map((prices.data as MaterialPriceRow[]).map((row) => [row.id, row]));
    const controls = ((uses.data || []) as MaterialUseRow[]).map((row) => {
      const price = priceOf.get(row.material_price_id);
      const planned = Number(row.planned_qty) || 0;
      const used = Number(row.used_qty) || 0;
      const rate = Number(price?.price) || 0;
      return {
        ...row,
        material: price?.name || "",
        unit: price?.unit || "",
        price: rate,
        supplier_name: price?.supplier_id ? nameOf.get(price.supplier_id) || "" : "",
        project_code: projectOf.get(row.project_id)?.code || "",
        task_subject: row.task_id ? taskOf.get(row.task_id) || "" : "",
        variance_qty: used - planned,
        variance_amount: (used - planned) * rate,
      };
    });
    return NextResponse.json({
      suppliers: parties,
      prices: ((prices.data || []) as MaterialPriceRow[]).map((row) => ({
        ...row,
        supplier_name: row.supplier_id ? nameOf.get(row.supplier_id) || "" : "",
      })),
      controls,
      projects: projects.data || [],
      tasks: taskRows.map((row) => ({ ...row, project_code: projectOf.get(row.project_id)?.code || "" })),
    });
  } catch (err) {
    return fail(err, "Không tải được vật tư.");
  }
}

export async function POST(request: Request) {
  const gate = await officeWrite();
  if (!gate.user || !gate.supabase) return gate.response;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (body?.kind === "supplier") {
    const name = String(body.name || "").trim();
    if (!name) return jsonError("Nhập tên nhà cung cấp.", 400);
    const inserted = await gate.supabase.from("suppliers").insert({
      name,
      tax_code: String(body.tax_code || "").trim() || null,
      phone: String(body.phone || "").trim() || null,
      trade: String(body.trade || "").trim() || null,
    }).select("id").single();
    if (inserted.error) return jsonError(inserted.error.message, 400);
    return NextResponse.json({ id: (inserted.data as { id: string }).id });
  }
  if (body?.kind === "price") {
    const name = String(body.name || "").trim();
    if (!name) return jsonError("Nhập tên nguyên liệu.", 400);
    const inserted = await gate.supabase.from("material_prices").insert({
      supplier_id: body.supplier_id ? String(body.supplier_id) : null,
      name,
      unit: String(body.unit || "").trim() || null,
      price: Number(body.price || 0) || 0,
      effective_on: String(body.effective_on || "").slice(0, 10) || new Date().toISOString().slice(0, 10),
    }).select("id").single();
    if (inserted.error) return jsonError(inserted.error.message, 400);
    return NextResponse.json({ id: (inserted.data as { id: string }).id });
  }
  const project = await projectByCode(gate.supabase, String(body?.project_code || "")).catch((err: Error) => err);
  if (project instanceof Error) return jsonError(project.message, 400);
  if (!project || !body?.material_price_id) return jsonError("Chọn công trình và nguyên liệu.", 400);
  const taskId = String(body.task_id || "");
  if (taskId) {
    const task = await gate.supabase.from("tasks").select("id").eq("id", taskId).eq("project_id", project.id).maybeSingle();
    if (task.error) return jsonError(task.error.message, 400);
    if (!task.data) return jsonError("Hạng mục không thuộc công trình này.", 400);
  }
  const usage = {
    project_id: project.id,
    material_price_id: String(body.material_price_id),
    task_id: taskId || null,
    planned_qty: Number(body.planned_qty || 0) || 0,
    used_qty: Number(body.used_qty || 0) || 0,
  };
  let inserted = await gate.supabase.from("material_uses").insert(usage).select("id").single();
  if (inserted.error && /task_id|schema cache/i.test(inserted.error.message)) {
    const { task_id: _task, ...plain } = usage;
    inserted = await gate.supabase.from("material_uses").insert(plain).select("id").single();
  }
  if (inserted.error) return jsonError(inserted.error.message, 400);
  return NextResponse.json({ id: (inserted.data as { id: string }).id });
}
