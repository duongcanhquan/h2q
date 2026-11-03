import { NextResponse } from "next/server";
import { jsonError } from "@/lib/data/field";
import { fail, officeRead, officeWrite, projectByCode } from "@/lib/data/registers";
import type { BoqHeaderRow, BoqRecord, ProjectRecord } from "@/lib/supabase/database.types";

export const runtime = "nodejs";

export async function GET() {
  const gate = await officeRead();
  if (!gate.user || !gate.supabase) return gate.response;
  try {
    const [headers, items, projects] = await Promise.all([
      gate.supabase.from("boq_headers").select("*").order("created_at", { ascending: false }),
      gate.supabase.from("boq_items").select("id, project_id, code, description, boq_id, planned_qty, rate"),
      gate.supabase.from("projects").select("id, code, name"),
    ]);
    if (headers.error) return jsonError(headers.error.message, 400);
    if (items.error) return jsonError(items.error.message, 400);
    if (projects.error) return jsonError(projects.error.message, 400);
    const projectById = new Map((projects.data as Pick<ProjectRecord, "id" | "code" | "name">[]).map((row) => [row.id, row]));
    const lines = (items.data || []) as Pick<BoqRecord, "boq_id" | "planned_qty" | "rate">[];
    const rows = ((headers.data || []) as BoqHeaderRow[]).map((header) => {
      const own = lines.filter((line) => line.boq_id === header.id);
      const amount = own.reduce((sum, line) => sum + Number(line.planned_qty) * Number(line.rate), 0);
      const project = projectById.get(header.project_id);
      return { ...header, project_code: project?.code || "", project_name: project?.name || "", line_count: own.length, planned_amount: amount };
    });
    return NextResponse.json({
      rows,
      items: items.data || [],
      projects: (projects.data || []) as Pick<ProjectRecord, "id" | "code" | "name">[],
    });
  } catch (err) {
    return fail(err, "Không tải được dự toán.");
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
  const title = String(body?.title || "").trim();
  if (!code || !title) return jsonError("Nhập mã và tên dự toán.", 400);
  const inserted = await gate.supabase.from("boq_headers").insert({
    project_id: project.id,
    code,
    title,
    revision: Number(body?.revision || 0) || 0,
    note: String(body?.note || "").trim() || null,
    status: "Draft",
  }).select("id").single();
  if (inserted.error) return jsonError(inserted.error.message.includes("duplicate") ? "Mã dự toán và lần sửa đã có." : inserted.error.message, 400);
  return NextResponse.json({ id: (inserted.data as { id: string }).id });
}
