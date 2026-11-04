import { NextResponse } from "next/server";
import { jsonError, loadSettings, requireUser } from "@/lib/data/field";
import type {
  BoqRecord,
  MeasurementRecord,
  MembershipRow,
  ProfileRow,
  ProjectRecord,
  TaskRecord,
} from "@/lib/supabase/database.types";
import type { PendingApprovalRow } from "@/lib/domain/types";

export const runtime = "nodejs";

const SLIP_COLS =
  "id, slip_code, project_id, task_id, boq_item_id, created_by, measurement_date, quantity, entry_kind, work_order, over_limit, approval_status, approval_level, geofence_outside, image_urls, updated_at";

export async function GET() {
  const gate = await requireUser();
  if (!gate.user || !gate.supabase) return gate.response;
  const { supabase, user } = gate;

  const [profileRes, memberRes, settings] = await Promise.all([
    supabase.from("profiles").select("app_role").eq("id", user.id).maybeSingle(),
    supabase.from("project_members").select("project_id, member_role").eq("user_id", user.id),
    loadSettings(supabase),
  ]);
  if (profileRes.error) return jsonError(profileRes.error.message, 400);
  if (memberRes.error) return jsonError(memberRes.error.message, 400);

  const isAdmin = (profileRes.data as Pick<ProfileRow, "app_role"> | null)?.app_role === "admin";
  const approverProjects = (
    (memberRes.data || []) as Pick<MembershipRow, "project_id" | "member_role">[]
  )
    .filter((row) => row.member_role === "approver" || row.member_role === "admin")
    .map((row) => row.project_id);

  if (!isAdmin && approverProjects.length === 0) {
    return NextResponse.json({
      items: [],
      count: 0,
      truncated: false,
      viewer_can_approve: false,
    });
  }

  let slipQuery = supabase
    .from("measurements")
    .select(SLIP_COLS)
    .eq("approval_status", "Pending Approval")
    .order("created_at", { ascending: false })
    .limit(300);
  if (!isAdmin) slipQuery = slipQuery.in("project_id", approverProjects);

  const slipRes = await slipQuery;
  if (slipRes.error) return jsonError(slipRes.error.message, 400);

  const slips = (slipRes.data || []) as MeasurementRecord[];
  const projectIds = [...new Set(slips.map((slip) => slip.project_id))];
  const taskIds = [...new Set(slips.map((slip) => slip.task_id).filter(Boolean))] as string[];
  const boqIds = [...new Set(slips.map((slip) => slip.boq_item_id).filter(Boolean))] as string[];
  const userIds = [...new Set(slips.map((slip) => slip.created_by))];

  const [projects, tasks, boqs, people] = await Promise.all([
    projectIds.length
      ? supabase.from("projects").select("id, code, name").in("id", projectIds)
      : Promise.resolve({ data: [], error: null }),
    taskIds.length
      ? supabase.from("tasks").select("id, subject").in("id", taskIds)
      : Promise.resolve({ data: [], error: null }),
    boqIds.length
      ? supabase.from("boq_items").select("id, code").in("id", boqIds)
      : Promise.resolve({ data: [], error: null }),
    userIds.length
      ? supabase.from("profiles").select("id, full_name, email").in("id", userIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (projects.error) return jsonError(projects.error.message, 400);
  if (tasks.error) return jsonError(tasks.error.message, 400);
  if (boqs.error) return jsonError(boqs.error.message, 400);
  if (people.error) return jsonError(people.error.message, 400);

  const projectById = new Map(
    ((projects.data || []) as Pick<ProjectRecord, "id" | "code" | "name">[]).map((row) => [row.id, row]),
  );
  const taskById = new Map(
    ((tasks.data || []) as Pick<TaskRecord, "id" | "subject">[]).map((row) => [row.id, row.subject]),
  );
  const boqById = new Map(
    ((boqs.data || []) as Pick<BoqRecord, "id" | "code">[]).map((row) => [row.id, row.code]),
  );
  const personById = new Map(
    ((people.data || []) as Pick<ProfileRow, "id" | "full_name" | "email">[]).map((row) => [
      row.id,
      row.full_name || row.email || "",
    ]),
  );

  const items: PendingApprovalRow[] = slips.map((slip) => {
    const project = projectById.get(slip.project_id);
    const who = personById.get(slip.created_by) || "";
    return {
      name: slip.slip_code,
      project: project?.code,
      project_name: project?.name,
      work_order: slip.work_order || undefined,
      date: slip.measurement_date,
      status: slip.approval_status,
      measured_total: Number(slip.quantity),
      measured_by: who,
      custom_h2q_approval_status: slip.approval_status,
      custom_h2q_task: slip.task_id ? taskById.get(slip.task_id) : undefined,
      custom_h2q_boq_item: slip.boq_item_id ? boqById.get(slip.boq_item_id) : undefined,
      custom_h2q_boq_over_limit: slip.over_limit ? 1 : 0,
      custom_h2q_submitted_by_user: who,
      custom_h2q_entry_kind: slip.entry_kind,
      approval_level: slip.approval_level,
      approval_levels: settings.approval_chain_length || 1,
      next_roles: ["Chỉ huy"],
      entry_kind: slip.entry_kind,
      custom_h2q_geofence_outside: slip.geofence_outside ? 1 : 0,
      image_urls: slip.image_urls || [],
      modified: slip.updated_at,
    };
  });

  return NextResponse.json({
    items,
    count: items.length,
    truncated: slips.length >= 300,
    viewer_can_approve: true,
  });
}
