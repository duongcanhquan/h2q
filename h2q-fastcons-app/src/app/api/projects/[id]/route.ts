import { NextResponse } from "next/server";
import { jsonError, requireUser } from "@/lib/data/field";
import { requireAdmin } from "@/lib/data/people";
import type { ProjectRecord } from "@/lib/supabase/database.types";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

function text(value: unknown) {
  const trimmed = String(value ?? "").trim();
  return trimmed || null;
}

export async function PATCH(request: Request, { params }: Params) {
  const gate = await requireAdmin();
  if (!gate.user || !gate.supabase) return gate.response;
  const code = decodeURIComponent((await params).id);
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const name = String(body?.name || "").trim();
  const nextCode = String(body?.code || code).trim();
  if (!name || !nextCode) return jsonError("Nhập mã và tên công trình.", 400);

  const updated = await gate.supabase
    .from("projects")
    .update({
      code: nextCode,
      name,
      status: text(body?.status) || "Open",
      company: text(body?.company),
      customer: text(body?.customer),
      expected_start_date: text(body?.expected_start_date),
      expected_end_date: text(body?.expected_end_date),
    })
    .eq("code", code)
    .select("code")
    .maybeSingle();
  if (updated.error) {
    const message = updated.error.message.includes("duplicate") ? "Mã công trình đã tồn tại." : updated.error.message;
    return jsonError(message, 400);
  }
  if (!updated.data) return jsonError("Không tìm thấy công trình.", 404);
  return NextResponse.json({ code: (updated.data as Pick<ProjectRecord, "code">).code });
}

export async function GET(_request: Request, { params }: Params) {
  const gate = await requireUser();
  if (!gate.user || !gate.supabase) return gate.response;
  const code = decodeURIComponent((await params).id);
  const { data, error } = await gate.supabase.from("projects").select("*").eq("code", code).maybeSingle();
  if (error) return jsonError(error.message, 400);
  if (!data) return jsonError("Không tìm thấy công trình.", 404);
  return NextResponse.json(data);
}
