import { NextResponse } from "next/server";
import { jsonError } from "@/lib/data/field";
import { fail, officeWrite } from "@/lib/data/registers";
import type { AuditLogRow } from "@/lib/supabase/database.types";

export const runtime = "nodejs";

const LABEL: Record<string, string> = {
  projects: "Công trình",
  boq_headers: "Dự toán",
  work_orders: "Giao thầu",
  scope_changes: "Phát sinh",
  suppliers: "Nhà cung cấp",
  material_prices: "Giá nguyên liệu",
  material_uses: "Kiểm soát vật tư",
  quotations: "Báo giá",
};

export async function GET() {
  const gate = await officeWrite();
  if (!gate.user || !gate.supabase) return gate.response;
  try {
    const { data, error } = await gate.supabase
      .from("audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) return jsonError(error.message, 400);
    const rows = ((data || []) as AuditLogRow[]).map((row) => ({
      ...row,
      entity_label: LABEL[row.entity] || row.entity,
    }));
    return NextResponse.json({ rows });
  } catch (err) {
    return fail(err, "Không tải được sổ kiểm toán.");
  }
}
