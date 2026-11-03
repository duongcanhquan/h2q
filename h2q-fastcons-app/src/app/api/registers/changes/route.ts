import { NextResponse } from "next/server";
import { jsonError } from "@/lib/data/field";
import { fail, officeRead, officeWrite, projectByCode } from "@/lib/data/registers";
import type { ProjectRecord, ScopeChangeRow } from "@/lib/supabase/database.types";

export const runtime = "nodejs";

export async function GET() {
  const gate = await officeRead();
  if (!gate.user || !gate.supabase) return gate.response;
  try {
    const [changes, projects] = await Promise.all([
      gate.supabase.from("scope_changes").select("*").order("created_at", { ascending: false }),
      gate.supabase.from("projects").select("id, code, name").order("name"),
    ]);
    if (changes.error) return jsonError(changes.error.message, 400);
    if (projects.error) return jsonError(projects.error.message, 400);
    const names = new Map((projects.data as Pick<ProjectRecord, "id" | "code" | "name">[]).map((row) => [row.id, row]));
    const rows = ((changes.data || []) as ScopeChangeRow[]).map((row) => {
      const project = names.get(row.project_id);
      return { ...row, project_code: project?.code || "", project_name: project?.name || "" };
    });
    return NextResponse.json({ rows, projects: projects.data || [] });
  } catch (err) {
    return fail(err, "Không tải được phát sinh.");
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
  if (!code || !title) return jsonError("Nhập mã và tên phát sinh.", 400);
  const inserted = await gate.supabase.from("scope_changes").insert({
    project_id: project.id,
    code,
    title,
    reason: String(body?.reason || "").trim() || null,
    amount: Number(body?.amount || 0) || 0,
    status: "Draft",
  }).select("id").single();
  if (inserted.error) return jsonError(inserted.error.message.includes("duplicate") ? "Mã phát sinh đã có." : inserted.error.message, 400);
  return NextResponse.json({ id: (inserted.data as { id: string }).id });
}

export async function PATCH(request: Request) {
  const gate = await officeWrite();
  if (!gate.user || !gate.supabase) return gate.response;
  const body = (await request.json().catch(() => null)) as { id?: string; status?: string } | null;
  const status = String(body?.status || "");
  if (!body?.id || !["Draft", "Submitted", "Approved", "Rejected"].includes(status)) {
    return jsonError("Trạng thái phát sinh không hợp lệ.", 400);
  }
  const updated = await gate.supabase.from("scope_changes").update({ status }).eq("id", body.id);
  if (updated.error) return jsonError(updated.error.message, 400);
  return NextResponse.json({ id: body.id, status });
}
