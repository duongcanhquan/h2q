import { NextResponse } from "next/server";
import { jsonError, requireUser } from "@/lib/data/field";
import { projectByCode } from "@/lib/data/registers";
import { fileFolder, storeFile } from "@/lib/storage/files";

export const runtime = "nodejs";

const KINDS = ["vat_lieu", "cong_nhan", "cong_trinh", "tien_do", "hoa_don", "tep"] as const;

export async function GET(request: Request) {
  const gate = await requireUser();
  if (!gate.user || !gate.supabase) return gate.response;
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind");
  const project = url.searchParams.get("project");
  let query = gate.supabase.from("documents").select("*").order("taken_on", { ascending: false }).limit(100);
  if (kind) query = query.eq("kind", kind);
  if (project) {
    const found = await projectByCode(gate.supabase, project);
    if (!found) return NextResponse.json({ rows: [] });
    query = query.eq("project_id", found.id);
  }
  const { data, error } = await query;
  if (error) return jsonError(error.message, 400);
  return NextResponse.json({ rows: data || [] });
}

export async function POST(request: Request) {
  const gate = await requireUser();
  if (!gate.user || !gate.supabase) return gate.response;
  const form = await request.formData();
  const file = form.get("file");
  const kind = String(form.get("kind") || "");
  const title = String(form.get("title") || "").trim();
  if (!(file instanceof File) || file.size <= 0) return jsonError("Chưa chọn tệp.", 400);
  if (file.size > 15 * 1024 * 1024) return jsonError("Tệp lớn hơn 15 MB.", 400);
  if (!KINDS.includes(kind as (typeof KINDS)[number]) || !title) {
    return jsonError("Chọn loại hồ sơ và nhập tiêu đề.", 400);
  }
  try {
    const projectCode = String(form.get("project_code") || "");
    const project = projectCode ? await projectByCode(gate.supabase, projectCode) : null;
    if (projectCode && !project) return jsonError("Không tìm thấy công trình.", 404);
    const taskId = String(form.get("task_id") || "");
    if (taskId) {
      if (!project) return jsonError("Chọn công trình trước khi chọn hạng mục.", 400);
      const task = await gate.supabase.from("tasks").select("id").eq("id", taskId).eq("project_id", project.id).maybeSingle();
      if (task.error) return jsonError(task.error.message, 400);
      if (!task.data) return jsonError("Hạng mục không thuộc công trình này.", 400);
    }
    const folder = kind === "vat_lieu" ? "vat-lieu" : kind === "cong_nhan" ? "cong-nhan" : kind === "tien_do" ? "tien-do" : kind === "hoa_don" ? "hoa-don" : kind === "cong_trinh" ? "cong-trinh" : "tep";
    const stored = await storeFile(fileFolder(folder), file.name, new Uint8Array(await file.arrayBuffer()), file.type || "application/octet-stream");
    const row = {
      project_id: project?.id || null,
      task_id: String(form.get("task_id") || "") || null,
      worker_id: String(form.get("worker_id") || "") || null,
      material_price_id: String(form.get("material_price_id") || "") || null,
      equipment_id: String(form.get("equipment_id") || "") || null,
      kind,
      title,
      file_url: stored.url,
      storage_key: stored.key,
      note: String(form.get("note") || "").trim() || null,
      taken_on: String(form.get("taken_on") || "").slice(0, 10) || new Date().toISOString().slice(0, 10),
      created_by: gate.user.id,
    };
    let inserted = await gate.supabase.from("documents").insert(row).select("id, file_url, storage_key").single();
    if (inserted.error && /schema cache|column/i.test(inserted.error.message)) {
      const { worker_id: _worker, material_price_id: _material, equipment_id: _equipment, created_by: _by, ...plain } = row;
      inserted = await gate.supabase.from("documents").insert(plain).select("id, file_url, storage_key").single();
    }
    if (inserted.error) return jsonError(inserted.error.message, 400);
    return NextResponse.json({ ...inserted.data, store: stored.store });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Không lưu được hồ sơ.", 400);
  }
}
