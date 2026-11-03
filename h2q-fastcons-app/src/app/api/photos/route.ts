import { NextResponse } from "next/server";
import { jsonError, requireUser } from "@/lib/data/field";

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
    return jsonError("Ảnh lớn hơn 15 MB.", 400);
  }

  const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(-80) || "photo.jpg";
  const path = `${gate.user.id}/${crypto.randomUUID()}-${safe}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const uploaded = await gate.supabase.storage.from("site-photos").upload(path, bytes, {
    contentType: file.type || "image/jpeg",
    upsert: false,
  });
  if (uploaded.error) return jsonError(uploaded.error.message, 400);

  const { data } = gate.supabase.storage.from("site-photos").getPublicUrl(path);
  return NextResponse.json({ file_url: data.publicUrl, name: path });
}
