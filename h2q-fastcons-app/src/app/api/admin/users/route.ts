import { NextResponse } from "next/server";
import { jsonError } from "@/lib/data/field";
import {
  adminCount,
  asRole,
  authFailure,
  loadDirectory,
  parseAssignments,
  replaceAssignments,
  requireAdmin,
} from "@/lib/data/people";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.user || !gate.supabase) return gate.response;
  try {
    const directory = await loadDirectory(gate.supabase);
    return NextResponse.json({ ...directory, me: gate.user.id });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Không tải được danh sách người dùng.", 400);
  }
}

export async function POST(request: Request) {
  const gate = await requireAdmin();
  if (!gate.user || !gate.supabase) return gate.response;

  const body = (await request.json().catch(() => null)) as {
    email?: unknown;
    password?: unknown;
    full_name?: unknown;
    app_role?: unknown;
    assignments?: unknown;
  } | null;
  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");
  const fullName = String(body?.full_name || "").trim() || email.split("@")[0] || email;
  const role = asRole(body?.app_role) || "engineer";
  if (!email.includes("@") || password.length < 6) {
    return jsonError("Nhập email hợp lệ và mật khẩu ít nhất 6 ký tự.", 400);
  }

  try {
    const directory = await loadDirectory(gate.supabase);
    const assignments = parseAssignments(body?.assignments, new Set(directory.projects.map((row) => row.id)));
    if (typeof assignments === "string") return jsonError(assignments, 400);

    const admin = createSupabaseAdmin();
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (created.error || !created.data.user) {
      return jsonError(authFailure(created.error?.message || "Không tạo được tài khoản."), 400);
    }

    const userId = created.data.user.id;
    const profile = await gate.supabase
      .from("profiles")
      .update({ full_name: fullName, email, app_role: role })
      .eq("id", userId);
    if (profile.error) return jsonError(profile.error.message, 400);
    await replaceAssignments(gate.supabase, userId, assignments);

    if (role === "admin" && (await adminCount(gate.supabase)) < 1) {
      return jsonError("Đã tạo tài khoản nhưng chưa gán được quyền admin.", 400);
    }
    return NextResponse.json({ id: userId, email, full_name: fullName, app_role: role });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Không tạo được tài khoản.", 400);
  }
}
