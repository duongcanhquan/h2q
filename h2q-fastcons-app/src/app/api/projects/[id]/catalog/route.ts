import { NextResponse } from "next/server";
import { jsonError, type Db } from "@/lib/data/field";
import { requireAdmin } from "@/lib/data/people";
import type { ProjectRecord } from "@/lib/supabase/database.types";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

function num(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function projectId(supabase: Db, code: string) {
  const { data, error } = await supabase.from("projects").select("id").eq("code", code).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Pick<ProjectRecord, "id"> | null)?.id || null;
}

export async function POST(request: Request, { params }: Params) {
  const gate = await requireAdmin();
  if (!gate.user || !gate.supabase) return gate.response;
  const code = decodeURIComponent((await params).id);
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  try {
    const id = await projectId(gate.supabase, code);
    if (!id) return jsonError("Không tìm thấy công trình.", 404);
    if (body?.kind === "task") {
      const taskCode = String(body.code || "").trim();
      const subject = String(body.subject || "").trim();
      if (!taskCode || !subject) return jsonError("Nhập mã và tên hạng mục.", 400);
      const inserted = await gate.supabase.from("tasks").insert({
        project_id: id,
        code: taskCode,
        subject,
        status: "Open",
      }).select("id").single();
      if (inserted.error) {
        return jsonError(inserted.error.message.includes("duplicate") ? "Mã hạng mục đã có." : inserted.error.message, 400);
      }
      return NextResponse.json({ id: (inserted.data as { id: string }).id });
    }
    if (body?.kind === "boq") {
      const itemCode = String(body.code || "").trim();
      const description = String(body.description || "").trim();
      if (!itemCode || !description) return jsonError("Nhập mã và tên công việc.", 400);
      const inserted = await gate.supabase.from("boq_items").insert({
        project_id: id,
        task_id: body.task_id ? String(body.task_id) : null,
        code: itemCode,
        description,
        unit: String(body.unit || "").trim() || null,
        planned_qty: num(body.planned_qty),
        rate: num(body.rate),
      }).select("id").single();
      if (inserted.error) {
        return jsonError(inserted.error.message.includes("duplicate") ? "Mã công việc đã có." : inserted.error.message, 400);
      }
      return NextResponse.json({ id: (inserted.data as { id: string }).id });
    }
    return jsonError("Loại danh mục không hợp lệ.", 400);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Không lưu được.", 400);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const gate = await requireAdmin();
  if (!gate.user || !gate.supabase) return gate.response;
  const code = decodeURIComponent((await params).id);
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const itemId = String(body?.id || "");
  if (!itemId) return jsonError("Thiếu mã dòng.", 400);
  try {
    const id = await projectId(gate.supabase, code);
    if (!id) return jsonError("Không tìm thấy công trình.", 404);
    if (body?.kind === "task") {
      const updated = await gate.supabase.from("tasks").update({
        code: String(body.code || "").trim(),
        subject: String(body.subject || "").trim(),
        status: String(body.status || "Open"),
      }).eq("id", itemId).eq("project_id", id);
      if (updated.error) return jsonError(updated.error.message, 400);
      return NextResponse.json({ id: itemId });
    }
    if (body?.kind === "boq") {
      const updated = await gate.supabase.from("boq_items").update({
        task_id: body.task_id ? String(body.task_id) : null,
        code: String(body.code || "").trim(),
        description: String(body.description || "").trim(),
        unit: String(body.unit || "").trim() || null,
        planned_qty: num(body.planned_qty),
        rate: num(body.rate),
      }).eq("id", itemId).eq("project_id", id);
      if (updated.error) return jsonError(updated.error.message, 400);
      return NextResponse.json({ id: itemId });
    }
    return jsonError("Loại danh mục không hợp lệ.", 400);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Không lưu được.", 400);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const gate = await requireAdmin();
  if (!gate.user || !gate.supabase) return gate.response;
  const code = decodeURIComponent((await params).id);
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind");
  const itemId = url.searchParams.get("id") || "";
  if (!itemId) return jsonError("Thiếu mã dòng.", 400);
  try {
    const id = await projectId(gate.supabase, code);
    if (!id) return jsonError("Không tìm thấy công trình.", 404);
    const table = kind === "task" ? "tasks" : kind === "boq" ? "boq_items" : null;
    if (!table) return jsonError("Loại danh mục không hợp lệ.", 400);
    const removed = await gate.supabase.from(table).delete().eq("id", itemId).eq("project_id", id);
    if (removed.error) return jsonError(removed.error.message, 400);
    return NextResponse.json({ id: itemId });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Không xóa được.", 400);
  }
}
