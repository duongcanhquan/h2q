import { NextResponse } from "next/server";
import { jsonError } from "@/lib/data/field";
import { fail, officeRead, officeWrite, projectByCode } from "@/lib/data/registers";
import type { ProjectRecord, QuotationRow, SupplierRow } from "@/lib/supabase/database.types";

export const runtime = "nodejs";

export async function GET() {
  const gate = await officeRead();
  if (!gate.user || !gate.supabase) return gate.response;
  try {
    const [quotes, suppliers, projects] = await Promise.all([
      gate.supabase.from("quotations").select("*").order("created_at", { ascending: false }),
      gate.supabase.from("suppliers").select("id, name").order("name"),
      gate.supabase.from("projects").select("id, code, name").order("name"),
    ]);
    for (const result of [quotes, suppliers, projects]) {
      if (result.error) return jsonError(result.error.message, 400);
    }
    const party = new Map((suppliers.data as Pick<SupplierRow, "id" | "name">[]).map((row) => [row.id, row.name]));
    const project = new Map((projects.data as Pick<ProjectRecord, "id" | "code" | "name">[]).map((row) => [row.id, row]));
    const rows = ((quotes.data || []) as QuotationRow[]).map((row) => ({
      ...row,
      supplier_name: row.supplier_id ? party.get(row.supplier_id) || "" : "",
      project_code: project.get(row.project_id)?.code || "",
    }));
    const scores = new Map<string, { sum: number; count: number }>();
    for (const row of rows) {
      if (!row.supplier_id || !row.score) continue;
      const current = scores.get(row.supplier_id) || { sum: 0, count: 0 };
      current.sum += Number(row.score);
      current.count += 1;
      scores.set(row.supplier_id, current);
    }
    const ratings = [...scores.entries()].map(([id, value]) => ({
      supplier_id: id,
      supplier_name: party.get(id) || "",
      average: value.sum / value.count,
      count: value.count,
    }));
    return NextResponse.json({ rows, ratings, suppliers: suppliers.data || [], projects: projects.data || [] });
  } catch (err) {
    return fail(err, "Không tải được báo giá.");
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
  if (!code || !title) return jsonError("Nhập số và tên báo giá.", 400);
  const inserted = await gate.supabase.from("quotations").insert({
    project_id: project.id,
    supplier_id: body?.supplier_id ? String(body.supplier_id) : null,
    code,
    title,
    amount: Number(body?.amount || 0) || 0,
    status: "Draft",
  }).select("id").single();
  if (inserted.error) return jsonError(inserted.error.message.includes("duplicate") ? "Số báo giá đã có." : inserted.error.message, 400);
  return NextResponse.json({ id: (inserted.data as { id: string }).id });
}

export async function PATCH(request: Request) {
  const gate = await officeWrite();
  if (!gate.user || !gate.supabase) return gate.response;
  const body = (await request.json().catch(() => null)) as { id?: string; status?: string; score?: number; review?: string } | null;
  if (!body?.id) return jsonError("Thiếu báo giá.", 400);
  const status = String(body.status || "");
  if (status && !["Draft", "Sent", "Accepted", "Rejected"].includes(status)) {
    return jsonError("Trạng thái báo giá không hợp lệ.", 400);
  }
  const score = body.score ? Number(body.score) : null;
  if (score && (score < 1 || score > 5)) return jsonError("Điểm đánh giá từ 1 đến 5.", 400);
  const patch: { status?: string; score?: number | null; review?: string | null } = {};
  if (status) patch.status = status;
  if (score) patch.score = score;
  if (typeof body.review === "string") patch.review = body.review.trim() || null;
  const updated = await gate.supabase.from("quotations").update(patch).eq("id", body.id);
  if (updated.error) return jsonError(updated.error.message, 400);
  return NextResponse.json({ id: body.id });
}
