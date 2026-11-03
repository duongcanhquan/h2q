import { jsonError, requireUser, type Db } from "@/lib/data/field";
import { requireAdmin } from "@/lib/data/people";
import type { ProjectRecord } from "@/lib/supabase/database.types";

export async function projectByCode(supabase: Db, code: string) {
  const { data, error } = await supabase.from("projects").select("id, code, name").eq("code", code).maybeSingle();
  if (error) throw new Error(error.message);
  return data as Pick<ProjectRecord, "id" | "code" | "name"> | null;
}

export async function officeRead() {
  return requireUser();
}

export async function officeWrite() {
  return requireAdmin();
}

export function fail(err: unknown, fallback: string) {
  return jsonError(err instanceof Error ? err.message : fallback, 400);
}
