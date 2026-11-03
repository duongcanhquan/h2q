import { jsonError, requireUser, type Db } from "@/lib/data/field";
import type { MembershipRow, ProfileRow, ProjectRecord } from "@/lib/supabase/database.types";

export const APP_ROLES = ["engineer", "approver", "admin"] as const;
export type AppRole = (typeof APP_ROLES)[number];

export type AssignmentInput = { project_id: string; member_role: AppRole };

export async function requireAdmin() {
  const gate = await requireUser();
  if (!gate.user || !gate.supabase) return gate;
  const { data, error } = await gate.supabase
    .from("profiles")
    .select("app_role")
    .eq("id", gate.user.id)
    .maybeSingle();
  if (error) {
    return { supabase: null, user: null, response: jsonError(error.message, 400) };
  }
  if ((data as Pick<ProfileRow, "app_role"> | null)?.app_role !== "admin") {
    return { supabase: null, user: null, response: jsonError("Chỉ admin mới quản lý người dùng.", 403) };
  }
  return gate;
}

export function asRole(value: unknown): AppRole | null {
  return APP_ROLES.includes(value as AppRole) ? (value as AppRole) : null;
}

export function authFailure(message: string) {
  const text = message.toLowerCase();
  if (text.includes("already") || text.includes("registered") || text.includes("exists")) {
    return "Email này đã có tài khoản.";
  }
  if (text.includes("password")) return "Mật khẩu cần ít nhất 6 ký tự.";
  if (text.includes("email")) return "Email không hợp lệ.";
  if (text.includes("foreign key") || text.includes("restrict")) {
    return "Không xóa được vì người này còn phiếu khối lượng hoặc nhật ký.";
  }
  return message;
}

export async function adminCount(supabase: Db) {
  const { count, error } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("app_role", "admin");
  if (error) throw new Error(error.message);
  return count || 0;
}

export async function loadDirectory(supabase: Db) {
  const [profiles, members, projects] = await Promise.all([
    supabase.from("profiles").select("id, email, full_name, app_role").order("full_name"),
    supabase.from("project_members").select("project_id, user_id, member_role"),
    supabase.from("projects").select("id, code, name").order("code"),
  ]);
  if (profiles.error) throw new Error(profiles.error.message);
  if (members.error) throw new Error(members.error.message);
  if (projects.error) throw new Error(projects.error.message);

  const byUser = new Map<string, AssignmentInput[]>();
  for (const row of (members.data || []) as MembershipRow[]) {
    const role = asRole(row.member_role);
    if (!role) continue;
    const list = byUser.get(row.user_id) || [];
    list.push({ project_id: row.project_id, member_role: role });
    byUser.set(row.user_id, list);
  }

  const users = ((profiles.data || []) as Pick<ProfileRow, "id" | "email" | "full_name" | "app_role">[]).map(
    (row) => ({
      id: row.id,
      email: row.email || "",
      full_name: row.full_name || row.email || "",
      app_role: asRole(row.app_role) || "engineer",
      assignments: byUser.get(row.id) || [],
    }),
  );

  return {
    users,
    projects: ((projects.data || []) as Pick<ProjectRecord, "id" | "code" | "name">[]).map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
    })),
  };
}

export function parseAssignments(value: unknown, projectIds: Set<string>): AssignmentInput[] | string {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: AssignmentInput[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return "Phân công không hợp lệ.";
    const projectId = String((item as { project_id?: unknown }).project_id || "");
    const role = asRole((item as { member_role?: unknown }).member_role);
    if (!projectIds.has(projectId) || !role) return "Công trình hoặc vai trò phân công không hợp lệ.";
    if (seen.has(projectId)) continue;
    seen.add(projectId);
    result.push({ project_id: projectId, member_role: role });
  }
  return result;
}

export async function replaceAssignments(supabase: Db, userId: string, next: AssignmentInput[]) {
  const current = await supabase.from("project_members").select("project_id").eq("user_id", userId);
  if (current.error) throw new Error(current.error.message);
  const keep = new Set(next.map((row) => row.project_id));
  const remove = ((current.data || []) as Pick<MembershipRow, "project_id">[])
    .map((row) => row.project_id)
    .filter((id) => !keep.has(id));
  if (remove.length) {
    const deleted = await supabase.from("project_members").delete().eq("user_id", userId).in("project_id", remove);
    if (deleted.error) throw new Error(deleted.error.message);
  }
  if (!next.length) return;
  const saved = await supabase.from("project_members").upsert(
    next.map((row) => ({ project_id: row.project_id, user_id: userId, member_role: row.member_role })),
    { onConflict: "project_id,user_id" },
  );
  if (saved.error) throw new Error(saved.error.message);
}
