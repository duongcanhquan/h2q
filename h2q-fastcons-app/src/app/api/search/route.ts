import { NextResponse } from "next/server";
import { jsonError, requireUser } from "@/lib/data/field";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const gate = await requireUser();
  if (!gate.user || !gate.supabase) return gate.response;
  const q = new URL(request.url).searchParams.get("q")?.trim() || "";
  if (q.length < 2) return NextResponse.json({ projects: [], materials: [], suppliers: [], workers: [], equipment: [], documents: [], stock: [] });
  const like = `%${q.replace(/[%_,]/g, "")}%`;
  const [projectsByCode, projectsByName, materials, suppliers, workers, equipmentByCode, equipmentByName, documents, stockItems] = await Promise.all([
    gate.supabase.from("projects").select("code, name").ilike("code", like).limit(12),
    gate.supabase.from("projects").select("code, name").ilike("name", like).limit(12),
    gate.supabase.from("material_prices").select("id, name, unit, price").ilike("name", like).limit(12),
    gate.supabase.from("suppliers").select("id, name, trade").ilike("name", like).limit(12),
    gate.supabase.from("workers").select("id, full_name, role_title, photo_url").ilike("full_name", like).limit(12),
    gate.supabase.from("equipment").select("id, code, name, status").ilike("code", like).limit(12),
    gate.supabase.from("equipment").select("id, code, name, status").ilike("name", like).limit(12),
    gate.supabase.from("documents").select("id, title, kind, file_url, taken_on").ilike("title", like).limit(12),
    gate.supabase.from("stock_items").select("id, code, name, unit, kind").ilike("name", like).limit(12),
  ]);
  const results = [projectsByCode, projectsByName, materials, suppliers, workers, equipmentByCode, equipmentByName, documents, stockItems];
  const failed = results.find((row) => row.error && !/does not exist|schema cache/i.test(row.error.message));
  if (failed?.error) return jsonError(failed.error.message, 400);
  const projects = [...(projectsByCode.data || []), ...(projectsByName.data || [])].filter(
    (row, index, list) => list.findIndex((item) => item.code === row.code) === index,
  );
  const equipment = [...(equipmentByCode.data || []), ...(equipmentByName.data || [])].filter(
    (row, index, list) => list.findIndex((item) => item.id === row.id) === index,
  );
  return NextResponse.json({
    projects,
    materials: materials.data || [],
    suppliers: suppliers.data || [],
    workers: workers.data || [],
    equipment,
    documents: documents.data || [],
    stock: stockItems.data || [],
  });
}
