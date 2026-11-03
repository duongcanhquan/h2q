import { NextResponse } from "next/server";
import { jsonError } from "@/lib/data/field";
import { fail, officeRead, officeWrite, projectByCode } from "@/lib/data/registers";
import type { BoqRecord, ProjectRecord, WorkPackageRow } from "@/lib/supabase/database.types";

export const runtime = "nodejs";

export async function GET() {
  const gate = await officeRead();
  if (!gate.user || !gate.supabase) return gate.response;
  try {
    const [packages, items, projects] = await Promise.all([
      gate.supabase.from("work_packages").select("*").order("code"),
      gate.supabase.from("boq_items").select("id, project_id, code, description, work_package_id, planned_qty, rate"),
      gate.supabase.from("projects").select("id, code, name"),
    ]);
    if (packages.error) return jsonError(packages.error.message, 400);
    if (items.error) return jsonError(items.error.message, 400);
    if (projects.error) return jsonError(projects.error.message, 400);
    const names = new Map((projects.data as Pick<ProjectRecord, "id" | "code" | "name">[]).map((row) => [row.id, row]));
    const lines = (items.data || []) as Pick<BoqRecord, "id" | "project_id" | "code" | "description" | "work_package_id" | "planned_qty" | "rate">[];
    const rows = ((packages.data || []) as WorkPackageRow[]).map((pack) => {
      const planned = lines
        .filter((line) => line.work_package_id === pack.id)
        .reduce((sum, line) => sum + Number(line.planned_qty) * Number(line.rate), 0);
      const project = names.get(pack.project_id);
      return { ...pack, project_code: project?.code || "", project_name: project?.name || "", planned_amount: planned };
    });
    return NextResponse.json({
      rows,
      projects: projects.data || [],
      items: lines.map((line) => ({
        ...line,
        project_code: names.get(line.project_id)?.code || "",
      })),
    });
  } catch (err) {
    return fail(err, "Không tải được gói việc.");
  }
}

export async function POST(request: Request) {
  const gate = await officeWrite();
  if (!gate.user || !gate.supabase) return gate.response;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const project = await projectByCode(gate.supabase, String(body?.project_code || "")).catch((err: Error) => err);
  if (project instanceof Error) return jsonError(project.message, 400);
  if (!project) return jsonError("Không tìm thấy công trình.", 404);
  const code = String(body?.code || "").trim();
  const name = String(body?.name || "").trim();
  if (!code || !name) return jsonError("Nhập mã và tên gói việc.", 400);
  const inserted = await gate.supabase.from("work_packages").insert({
    project_id: project.id,
    code,
    name,
    budget: Number(body?.budget || 0) || 0,
  }).select("id").single();
  if (inserted.error) return jsonError(inserted.error.message.includes("duplicate") ? "Mã gói việc đã có." : inserted.error.message, 400);
  return NextResponse.json({ id: (inserted.data as { id: string }).id });
}

export async function PATCH(request: Request) {
  const gate = await officeWrite();
  if (!gate.user || !gate.supabase) return gate.response;
  const body = (await request.json().catch(() => null)) as { id?: string; item_id?: string } | null;
  if (!body?.id || !body.item_id) return jsonError("Chọn gói việc và đầu việc.", 400);
  const [pack, item] = await Promise.all([
    gate.supabase.from("work_packages").select("id, project_id").eq("id", body.id).maybeSingle(),
    gate.supabase.from("boq_items").select("id, project_id").eq("id", body.item_id).maybeSingle(),
  ]);
  if (pack.error) return jsonError(pack.error.message, 400);
  if (item.error) return jsonError(item.error.message, 400);
  const packRow = pack.data as { id: string; project_id: string } | null;
  const itemRow = item.data as { id: string; project_id: string } | null;
  if (!packRow || !itemRow || packRow.project_id !== itemRow.project_id) {
    return jsonError("Đầu việc không thuộc công trình của gói.", 400);
  }
  const linked = await gate.supabase.from("boq_items").update({ work_package_id: body.id }).eq("id", body.item_id);
  if (linked.error) return jsonError(linked.error.message, 400);
  return NextResponse.json({ id: body.id, item_id: body.item_id });
}
