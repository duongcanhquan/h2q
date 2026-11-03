import { NextResponse } from "next/server";
import {
  geofenceRing,
  jsonError,
  loadSettings,
  num,
  requireUser,
} from "@/lib/data/field";
import { evaluateGeofence } from "@/lib/geo/geofence";
import type { DiaryRecord, ProjectRecord } from "@/lib/supabase/database.types";
import type { SiteDiaryPayload } from "@/lib/domain/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const gate = await requireUser();
  if (!gate.user || !gate.supabase) return gate.response;
  const { supabase, user } = gate;

  let body: SiteDiaryPayload;
  try {
    body = (await request.json()) as SiteDiaryPayload;
  } catch {
    return jsonError("Dữ liệu nhật ký không đọc được.", 400);
  }
  if (!body.project) return jsonError("Thiếu công trình.", 400);
  const date = body.date || new Date().toISOString().slice(0, 10);
  const line = body.lines?.[0];

  const settings = await loadSettings(supabase);
  if (!settings.enable_site_diary) return jsonError("Nhật ký đang tắt.", 400);
  if (settings.gps_required && (num(body.gps_lat) == null || num(body.gps_lng) == null)) {
    return jsonError("GPS bắt buộc.", 400);
  }

  const clientRequestId = body.client_request_id?.trim() || null;
  if (clientRequestId) {
    const existing = await supabase
      .from("diaries")
      .select("id")
      .eq("client_request_id", clientRequestId)
      .maybeSingle();
    if (existing.data) {
      const row = existing.data as Pick<DiaryRecord, "id">;
      return NextResponse.json({
        project: body.project,
        date,
        entries: [row.id],
        count: 1,
      });
    }
  }

  const projectRes = await supabase.from("projects").select("*").eq("code", body.project).maybeSingle();
  if (projectRes.error) return jsonError(projectRes.error.message, 400);
  if (!projectRes.data) return jsonError("Không tìm thấy công trình.", 404);
  const project = projectRes.data as ProjectRecord;

  const fence = evaluateGeofence(
    settings.geofence_enforcement,
    num(body.gps_lat),
    num(body.gps_lng),
    geofenceRing(project.geofence),
  );
  if (fence.action === "block") return jsonError(`${fence.message} Không gửi được.`, 400);

  let taskId: string | null = line?.task || null;
  if (taskId) {
    const taskRes = await supabase
      .from("tasks")
      .select("id")
      .eq("id", taskId)
      .eq("project_id", project.id)
      .maybeSingle();
    if (taskRes.error) return jsonError(taskRes.error.message, 400);
    if (!taskRes.data) return jsonError("Hạng mục không thuộc công trình này.", 400);
  }

  const imageUrls = (body.image_urls || []).map((url) => url.trim()).filter(Boolean);
  const fields = {
    weather: body.weather || null,
    site_condition: body.site_condition || null,
    safety_status: body.safety_status || null,
    work_note: body.work_note || line?.description || null,
    task_id: taskId,
    quantity: num(line?.quantity),
    labour_count: Number.isFinite(Number(line?.labour_count)) ? Math.round(Number(line?.labour_count)) : null,
    equipment_note: line?.equipment_note || null,
    image_urls: imageUrls,
    gps_lat: num(body.gps_lat),
    gps_lng: num(body.gps_lng),
    gps_accuracy: num(body.gps_accuracy),
    geofence_outside: fence.outside === 1,
  };

  let lookup = supabase
    .from("diaries")
    .select("id, image_urls")
    .eq("project_id", project.id)
    .eq("diary_date", date)
    .eq("created_by", user.id);
  lookup = taskId ? lookup.eq("task_id", taskId) : lookup.is("task_id", null);
  const prior = await lookup.maybeSingle();
  if (prior.error) return jsonError(prior.error.message, 400);

  if (prior.data) {
    const existing = prior.data as Pick<DiaryRecord, "id" | "image_urls">;
    const id = existing.id;
    fields.image_urls = [...new Set([...(existing.image_urls || []), ...imageUrls])];
    const updated = await supabase.from("diaries").update(fields).eq("id", id).select("id").single();
    if (updated.error) return jsonError(updated.error.message, 400);
    await linkDiaryPhotos(supabase, project.id, taskId, date, user.id, imageUrls);
    return NextResponse.json({
      project: project.code,
      date,
      entries: [id],
      count: 1,
      geofence_outside: fence.outside,
      geofence_reason: fence.reason,
    });
  }

  const inserted = await supabase
    .from("diaries")
    .insert({
      project_id: project.id,
      created_by: user.id,
      diary_date: date,
      client_request_id: clientRequestId,
      ...fields,
    })
    .select("id")
    .single();
  if (inserted.error) return jsonError(inserted.error.message, 400);
  const id = (inserted.data as Pick<DiaryRecord, "id">).id;
  await linkDiaryPhotos(supabase, project.id, taskId, date, user.id, imageUrls);
  return NextResponse.json({
    project: project.code,
    date,
    entries: [id],
    count: 1,
    geofence_outside: fence.outside,
    geofence_reason: fence.reason,
  });
}

async function linkDiaryPhotos(
  supabase: NonNullable<Awaited<ReturnType<typeof requireUser>>["supabase"]>,
  projectId: string,
  taskId: string | null,
  date: string,
  userId: string,
  urls: string[],
) {
  if (!urls.length) return;
  const existing = await supabase.from("documents").select("file_url").eq("project_id", projectId).in("file_url", urls);
  if (existing.error) return;
  const have = new Set(((existing.data || []) as { file_url: string }[]).map((row) => row.file_url));
  const rows = urls.filter((url) => !have.has(url)).map((url) => ({
    project_id: projectId,
    task_id: taskId,
    kind: "tien_do" as const,
    title: `Nhật ký ${date}`,
    file_url: url,
    storage_key: url,
    taken_on: date,
    note: "Ảnh nhật ký thi công",
    created_by: userId,
  }));
  if (!rows.length) return;
  const inserted = await supabase.from("documents").insert(rows);
  if (inserted.error && /created_by|schema cache/i.test(inserted.error.message)) {
    await supabase.from("documents").insert(rows.map(({ created_by: _by, ...rest }) => rest));
  }
}
