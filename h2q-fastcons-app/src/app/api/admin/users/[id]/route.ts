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
import type { ProfileRow } from "@/lib/supabase/database.types";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const gate = await requireAdmin();
  if (!gate.user || !gate.supabase) return gate.response;
  const { id } = await params;

  const body = (await request.json().catch(() => null)) as {
    email?: unknown;
    password?: unknown;
    full_name?: unknown;
    app_role?: unknown;
    assignments?: unknown;
  } | null;
  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");
  const fullName = String(body?.full_name || "").trim();
  const role = asRole(body?.app_role);
  if (!email.includes("@") || !fullName || !role) {
    return jsonError("Nhập họ tên, email và vai trò.", 400);
  }
  if (password && password.length < 6) return jsonError("Mật khẩu mới cần ít nhất 6 ký tự.", 400);

  try {
    const existing = await gate.supabase.from("profiles").select("id, app_role").eq("id", id).maybeSingle();
    if (existing.error) return jsonError(existing.error.message, 400);
    const row = existing.data as Pick<ProfileRow, "id" | "app_role"> | null;
    if (!row) return jsonError("Không tìm thấy người dùng.", 404);
    if (row.app_role === "admin" && role !== "admin" && (await adminCount(gate.supabase)) <= 1) {
      return jsonError("Phải còn ít nhất một admin.", 400);
    }

    const directory = await loadDirectory(gate.supabase);
    const assignments = parseAssignments(body?.assignments, new Set(directory.projects.map((item) => item.id)));
    if (typeof assignments === "string") return jsonError(assignments, 400);

    const admin = createSupabaseAdmin();
    const authPatch: { email: string; password?: string; user_metadata: { full_name: string } } = {
      email,
      user_metadata: { full_name: fullName },
    };
    if (password) authPatch.password = password;
    const updatedAuth = await admin.auth.admin.updateUserById(id, authPatch);
    if (updatedAuth.error) return jsonError(authFailure(updatedAuth.error.message), 400);

    const profile = await gate.supabase
      .from("profiles")
      .update({ email, full_name: fullName, app_role: role })
      .eq("id", id);
    if (profile.error) return jsonError(profile.error.message, 400);
    await replaceAssignments(gate.supabase, id, assignments);
    return NextResponse.json({ id, email, full_name: fullName, app_role: role });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Không lưu được người dùng.", 400);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const gate = await requireAdmin();
  if (!gate.user || !gate.supabase) return gate.response;
  const { id } = await params;
  if (id === gate.user.id) return jsonError("Không xóa chính tài khoản đang đăng nhập.", 400);

  try {
    const existing = await gate.supabase.from("profiles").select("app_role").eq("id", id).maybeSingle();
    if (existing.error) return jsonError(existing.error.message, 400);
    const row = existing.data as Pick<ProfileRow, "app_role"> | null;
    if (!row) return jsonError("Không tìm thấy người dùng.", 404);
    if (row.app_role === "admin" && (await adminCount(gate.supabase)) <= 1) {
      return jsonError("Phải còn ít nhất một admin.", 400);
    }

    const admin = createSupabaseAdmin();
    const removed = await admin.auth.admin.deleteUser(id);
    if (removed.error) return jsonError(authFailure(removed.error.message), 400);
    return NextResponse.json({ id, deleted: true });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Không xóa được người dùng.", 400);
  }
}
