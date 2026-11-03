import { NextResponse } from "next/server";
import { jsonError } from "@/lib/data/field";
import { officeWrite } from "@/lib/data/registers";
import type { BoqHeaderRow } from "@/lib/supabase/database.types";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

const STATUSES = ["Draft", "Submitted", "Approved", "Superseded"];

export async function PATCH(request: Request, { params }: Params) {
  const gate = await officeWrite();
  if (!gate.user || !gate.supabase) return gate.response;
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { status?: string; item_id?: string } | null;
  if (body?.item_id) {
    const linked = await gate.supabase.from("boq_items").update({ boq_id: id }).eq("id", body.item_id);
    if (linked.error) return jsonError(linked.error.message, 400);
    return NextResponse.json({ id, item_id: body.item_id });
  }
  const status = String(body?.status || "");
  if (!STATUSES.includes(status)) return jsonError("Trạng thái dự toán không hợp lệ.", 400);
  const current = await gate.supabase.from("boq_headers").select("id, project_id, status").eq("id", id).maybeSingle();
  if (current.error) return jsonError(current.error.message, 400);
  const header = current.data as Pick<BoqHeaderRow, "id" | "project_id" | "status"> | null;
  if (!header) return jsonError("Không tìm thấy dự toán.", 404);
  if (status === "Approved") {
    await gate.supabase
      .from("boq_headers")
      .update({ status: "Superseded" })
      .eq("project_id", header.project_id)
      .eq("status", "Approved")
      .neq("id", id);
  }
  const updated = await gate.supabase.from("boq_headers").update({ status }).eq("id", id);
  if (updated.error) return jsonError(updated.error.message, 400);
  return NextResponse.json({ id, status });
}
