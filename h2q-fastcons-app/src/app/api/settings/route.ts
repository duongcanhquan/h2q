import { NextResponse } from "next/server";
import { jsonError, loadSettings, requireUser } from "@/lib/data/field";

export const runtime = "nodejs";

export async function GET() {
  const gate = await requireUser();
  if (!gate.user || !gate.supabase) return gate.response;
  try {
    const settings = await loadSettings(gate.supabase);
    return NextResponse.json(settings);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Không tải được cấu hình.", 400);
  }
}
