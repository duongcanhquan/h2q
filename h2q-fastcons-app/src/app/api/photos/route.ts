import { NextResponse } from "next/server";
import { jsonError, requireUser } from "@/lib/data/field";
import { fileFolder, storeFile } from "@/lib/storage/files";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const gate = await requireUser();
  if (!gate.user || !gate.supabase) return gate.response;

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size <= 0) {
    return jsonError("Chưa có tệp ảnh.", 400);
  }
  if (file.size > 15 * 1024 * 1024) {
    return jsonError("Tệp lớn hơn 15 MB.", 400);
  }

  try {
    const folder = fileFolder(new URL(request.url).searchParams.get("folder"));
    const bytes = new Uint8Array(await file.arrayBuffer());
    const stored = await storeFile(folder, file.name, bytes, file.type || "application/octet-stream");
    return NextResponse.json({ file_url: stored.url, name: stored.key, store: stored.store });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Không lưu được tệp.", 400);
  }
}
