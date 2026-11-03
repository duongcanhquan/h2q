import { NextResponse } from "next/server";
import { jsonError } from "@/lib/data/field";
import { fail, officeRead, officeWrite, projectByCode } from "@/lib/data/registers";
import type { CrewJobRow, CrewRow, EquipmentRow, ProjectRecord, WorkerRow } from "@/lib/supabase/database.types";

export const runtime = "nodejs";

export async function GET() {
  const gate = await officeRead();
  if (!gate.user || !gate.supabase) return gate.response;
  try {
    const [projects, crews, jobs, equipment, workers, packages, tasks, accounts, attendance] = await Promise.all([
      gate.supabase.from("projects").select("id, code, name, contract_role").order("name"),
      gate.supabase.from("crews").select("*").order("name"),
      gate.supabase.from("crew_jobs").select("*").order("created_at", { ascending: false }),
      gate.supabase.from("equipment").select("*").order("code"),
      gate.supabase.from("workers").select("*").order("full_name"),
      gate.supabase.from("work_packages").select("id, project_id, code, name, budget"),
      gate.supabase.from("tasks").select("id, project_id, code, subject"),
      gate.supabase.from("profiles").select("id, full_name, email"),
      gate.supabase.from("attendance").select("*").order("work_date", { ascending: false }).limit(40),
    ]);
    for (const result of [projects, crews, jobs, equipment, workers]) {
      if (result.error) return jsonError(result.error.message, 400);
    }
    const optional = [packages, tasks, accounts, attendance].filter((result) => result.error && !/does not exist|schema cache/i.test(result.error.message));
    if (optional[0]?.error) return jsonError(optional[0].error.message, 400);
    const projectOf = new Map((projects.data as Pick<ProjectRecord, "id" | "code" | "name">[]).map((row) => [row.id, row]));
    const crewOf = new Map((crews.data as CrewRow[]).map((row) => [row.id, row.name]));
    const packageRows = (packages.data || []) as { id: string; project_id: string; code: string; name: string; budget: number }[];
    const taskRows = (tasks.data || []) as { id: string; project_id: string; code: string; subject: string }[];
    const packageOf = new Map(packageRows.map((row) => [row.id, row]));
    const taskOf = new Map(taskRows.map((row) => [row.id, row]));
    const workerOf = new Map((workers.data as WorkerRow[]).map((row) => [row.id, row.full_name]));
    return NextResponse.json({
      projects: projects.data || [],
      packages: packageRows.map((row) => ({ ...row, project_code: projectOf.get(row.project_id)?.code || "" })),
      tasks: taskRows.map((row) => ({ ...row, project_code: projectOf.get(row.project_id)?.code || "" })),
      accounts: accounts.data || [],
      crews: crews.data || [],
      jobs: ((jobs.data || []) as CrewJobRow[]).map((row) => ({
        ...row,
        project_code: projectOf.get(row.project_id)?.code || "",
        crew_name: crewOf.get(row.crew_id) || "",
        package_name: row.work_package_id ? packageOf.get(row.work_package_id)?.name || "" : "",
        package_budget: row.work_package_id ? Number(packageOf.get(row.work_package_id)?.budget || 0) : 0,
        task_subject: row.task_id ? taskOf.get(row.task_id)?.subject || "" : "",
      })),
      equipment: ((equipment.data || []) as EquipmentRow[]).map((row) => ({
        ...row,
        project_code: row.project_id ? projectOf.get(row.project_id)?.code || "" : "",
      })),
      workers: ((workers.data || []) as WorkerRow[]).map((row) => ({
        ...row,
        crew_name: row.crew_id ? crewOf.get(row.crew_id) || "" : "",
      })),
      attendance: ((attendance.error ? [] : attendance.data || []) as { id: string; project_id: string; worker_id: string; task_id: string | null; work_date: string; status: string }[]).map((row) => ({
        ...row,
        project_code: projectOf.get(row.project_id)?.code || "",
        worker_name: workerOf.get(row.worker_id) || "",
        task_subject: row.task_id ? taskOf.get(row.task_id)?.subject || "" : "",
      })),
    });
  } catch (err) {
    return fail(err, "Không tải được điều hành.");
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (body?.kind === "attendance") return markAttendance(body);
  const gate = await officeWrite();
  if (!gate.user || !gate.supabase) return gate.response;
  try {
    if (body?.kind === "role") {
      const role = body.contract_role === "thau_van_hanh" ? "thau_van_hanh" : "tong_thau";
      const project = await projectByCode(gate.supabase, String(body.project_code || ""));
      if (!project) return jsonError("Không tìm thấy công trình.", 404);
      const updated = await gate.supabase.from("projects").update({ contract_role: role }).eq("id", project.id);
      if (updated.error) return jsonError(updated.error.message, 400);
      return NextResponse.json({ id: project.id, contract_role: role });
    }
    if (body?.kind === "crew") {
      const name = String(body.name || "").trim();
      if (!name) return jsonError("Nhập tên đội.", 400);
      const inserted = await gate.supabase.from("crews").insert({
        name,
        leader: String(body.leader || "").trim() || null,
        phone: String(body.phone || "").trim() || null,
      }).select("id").single();
      if (inserted.error) return jsonError(inserted.error.message, 400);
      return NextResponse.json(inserted.data);
    }
    if (body?.kind === "job") {
      const project = await projectByCode(gate.supabase, String(body.project_code || ""));
      if (!project || !body.crew_id) return jsonError("Chọn công trình và đội.", 400);
      const title = String(body.title || "").trim();
      if (!title) return jsonError("Nhập việc giao cho đội.", 400);
      const taskId = String(body.task_id || "");
      if (!taskId) return jsonError("Chọn hạng mục để giao cho đội.", 400);
      const task = await gate.supabase.from("tasks").select("id").eq("id", taskId).eq("project_id", project.id).maybeSingle();
      if (task.error) return jsonError(task.error.message, 400);
      if (!task.data) return jsonError("Hạng mục không thuộc công trình này.", 400);
      const packageId = String(body.work_package_id || "");
      if (packageId) {
        const pack = await gate.supabase.from("work_packages").select("id").eq("id", packageId).eq("project_id", project.id).maybeSingle();
        if (pack.error) return jsonError(pack.error.message, 400);
        if (!pack.data) return jsonError("Gói việc không thuộc công trình này.", 400);
      }
      const inserted = await gate.supabase.from("crew_jobs").insert({
        project_id: project.id,
        crew_id: String(body.crew_id),
        work_package_id: String(body.work_package_id || "") || null,
        task_id: taskId,
        title,
        cost: Number(body.cost || 0) || 0,
        status: "Open",
      }).select("id").single();
      if (inserted.error) return jsonError(inserted.error.message, 400);
      return NextResponse.json(inserted.data);
    }
    if (body?.kind === "equipment") {
      const code = String(body.code || "").trim();
      const name = String(body.name || "").trim();
      if (!code || !name) return jsonError("Nhập mã và tên thiết bị.", 400);
      const project = body.project_code ? await projectByCode(gate.supabase, String(body.project_code)) : null;
      const inserted = await gate.supabase.from("equipment").insert({
        project_id: project?.id || null,
        code,
        name,
        kind: String(body.equipment_kind || "").trim() || null,
        status: String(body.status || "Sẵn sàng"),
      }).select("id").single();
      if (inserted.error) return jsonError(inserted.error.message.includes("duplicate") ? "Mã thiết bị đã có." : inserted.error.message, 400);
      return NextResponse.json(inserted.data);
    }
    const name = String(body?.full_name || "").trim();
    if (!name) return jsonError("Nhập tên nhân sự.", 400);
    const person = {
      full_name: name,
      role_title: String(body?.role_title || "").trim() || null,
      phone: String(body?.phone || "").trim() || null,
      crew_id: body?.crew_id ? String(body.crew_id) : null,
      profile_id: body?.profile_id ? String(body.profile_id) : null,
      photo_url: String(body?.photo_url || "").trim() || null,
    };
    let inserted = await gate.supabase.from("workers").insert(person).select("id").single();
    if (inserted.error && /profile_id|schema cache/i.test(inserted.error.message)) {
      const { profile_id: _profile, ...plain } = person;
      inserted = await gate.supabase.from("workers").insert(plain).select("id").single();
    }
    if (inserted.error) {
      return jsonError(inserted.error.message.includes("duplicate") ? "Tài khoản này đã gắn một nhân sự." : inserted.error.message, 400);
    }
    return NextResponse.json(inserted.data);
  } catch (err) {
    return fail(err, "Không lưu được.");
  }
}

async function markAttendance(body: Record<string, unknown>) {
  const gate = await officeRead();
  if (!gate.user || !gate.supabase) return gate.response;
  const project = await projectByCode(gate.supabase, String(body.project_code || "")).catch((err: Error) => err);
  if (project instanceof Error) return jsonError(project.message, 400);
  if (!project || !body.worker_id) return jsonError("Chọn công trình và nhân sự.", 400);
  const saved = await gate.supabase.from("attendance").upsert({
    project_id: project.id,
    task_id: String(body.task_id || "") || null,
    crew_id: String(body.crew_id || "") || null,
    worker_id: String(body.worker_id),
    work_date: String(body.work_date || "").slice(0, 10) || new Date().toISOString().slice(0, 10),
    status: ["Có mặt", "Vắng", "Nửa ngày"].includes(String(body.status)) ? String(body.status) : "Có mặt",
    note: String(body.note || "").trim() || null,
    created_by: gate.user.id,
  }, { onConflict: "worker_id,project_id,work_date" }).select("id").single();
  if (saved.error) return jsonError(saved.error.message, 400);
  return NextResponse.json(saved.data);
}
