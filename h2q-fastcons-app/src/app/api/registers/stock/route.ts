import { NextResponse } from "next/server";
import { jsonError } from "@/lib/data/field";
import { fail, officeRead, officeWrite } from "@/lib/data/registers";
import type { Json, StockItemRow, StockLocationRow, StockMoveLineRow, StockMoveRow } from "@/lib/supabase/database.types";

export const runtime = "nodejs";

type Signed = { location_id: string; item_id: string; qty: number; value: number };

function applyMove(rows: Signed[], move: StockMoveRow, line: StockMoveLineRow) {
  const qty = Number(line.qty) || 0;
  const value = qty * (Number(line.unit_cost) || 0);
  if (move.kind === "nhap") rows.push({ location_id: move.location_id, item_id: line.item_id, qty, value });
  if (move.kind === "xuat") rows.push({ location_id: move.location_id, item_id: line.item_id, qty: -qty, value: -value });
  if (move.kind === "chuyen") {
    rows.push({ location_id: move.location_id, item_id: line.item_id, qty: -qty, value: -value });
    if (move.to_location_id) rows.push({ location_id: move.to_location_id, item_id: line.item_id, qty, value });
  }
}

export async function GET() {
  const gate = await officeRead();
  if (!gate.user || !gate.supabase) return gate.response;
  try {
    const [locations, items, moves, lines, suppliers, projects, tasks, workers] = await Promise.all([
      gate.supabase.from("stock_locations").select("*").order("code"),
      gate.supabase.from("stock_items").select("*").order("code"),
      gate.supabase.from("stock_moves").select("*").order("move_date", { ascending: false }),
      gate.supabase.from("stock_move_lines").select("id, move_id, item_id, qty, unit_cost"),
      gate.supabase.from("suppliers").select("id, name").order("name"),
      gate.supabase.from("projects").select("id, code, name").order("name"),
      gate.supabase.from("tasks").select("id, project_id, code, subject").order("code"),
      gate.supabase.from("workers").select("id, full_name").order("full_name"),
    ]);
    for (const result of [locations, items, moves, lines]) {
      if (result.error) return jsonError(result.error.message, 400);
    }
    const placeOf = new Map(((locations.data || []) as StockLocationRow[]).map((row) => [row.id, row]));
    const itemOf = new Map(((items.data || []) as StockItemRow[]).map((row) => [row.id, row]));
    const everyMove = new Map(((moves.data || []) as StockMoveRow[]).map((row) => [row.id, row]));
    const moveOf = new Map(((moves.data || []) as StockMoveRow[]).slice(0, 60).map((row) => [row.id, row]));
    const signed: Signed[] = [];
    for (const line of (lines.data || []) as StockMoveLineRow[]) {
      const move = everyMove.get(line.move_id);
      if (move) applyMove(signed, move, line);
    }
    const balance = new Map<string, { qty: number; value: number }>();
    for (const row of signed) {
      const key = `${row.location_id}:${row.item_id}`;
      const current = balance.get(key) || { qty: 0, value: 0 };
      current.qty += row.qty;
      current.value += row.value;
      balance.set(key, current);
    }
    const supplierOf = new Map(((suppliers.data || []) as { id: string; name: string }[]).map((row) => [row.id, row.name]));
    const projectOf = new Map(((projects.data || []) as { id: string; code: string; name: string }[]).map((row) => [row.id, row]));
    const taskOf = new Map(((tasks.data || []) as { id: string; subject: string }[]).map((row) => [row.id, row.subject]));
    const workerOf = new Map(((workers.data || []) as { id: string; full_name: string }[]).map((row) => [row.id, row.full_name]));
    let receiptMoney = 0;
    for (const line of (lines.data || []) as StockMoveLineRow[]) {
      const move = everyMove.get(line.move_id);
      if (move?.kind === "nhap") receiptMoney += Number(line.qty) * Number(line.unit_cost);
    }
    const journal = ((lines.data || []) as StockMoveLineRow[])
      .filter((line) => moveOf.has(line.move_id))
      .map((line) => {
        const move = moveOf.get(line.move_id)!;
        const amount = Number(line.qty) * Number(line.unit_cost);
        return {
          id: line.id,
          code: move.code,
          kind: move.kind,
          move_date: move.move_date,
          item: itemOf.get(line.item_id)?.name || "",
          unit: itemOf.get(line.item_id)?.unit || "",
          qty: Number(line.qty),
          unit_cost: Number(line.unit_cost),
          amount,
          place: placeOf.get(move.location_id)?.code || "",
          destination: move.to_location_id ? placeOf.get(move.to_location_id)?.code || "" : "",
          supplier: move.supplier_id ? supplierOf.get(move.supplier_id) || "" : "",
          project: move.project_id ? projectOf.get(move.project_id)?.code || "" : "",
          task: move.task_id ? taskOf.get(move.task_id) || "" : "",
          receiver: move.receiver_worker_id ? workerOf.get(move.receiver_worker_id) || move.receiver_name || "" : move.receiver_name || "",
        };
      });
    return NextResponse.json({
      locations: locations.data || [],
      items: items.data || [],
      suppliers: suppliers.data || [],
      projects: projects.data || [],
      tasks: ((tasks.data || []) as { id: string; project_id: string; code: string; subject: string }[]).map((row) => ({
        ...row,
        project_code: projectOf.get(row.project_id)?.code || "",
      })),
      workers: workers.data || [],
      balances: [...balance.entries()].map(([key, row]) => {
        const [locationId, itemId] = key.split(":");
        return {
          location_id: locationId,
          item_id: itemId,
          place: placeOf.get(locationId)?.code || "",
          place_name: placeOf.get(locationId)?.name || "",
          item: itemOf.get(itemId)?.name || "",
          item_kind: itemOf.get(itemId)?.kind || "",
          unit: itemOf.get(itemId)?.unit || "",
          qty: row.qty,
          value: row.value,
        };
      }).filter((row) => Math.abs(row.qty) > 0.0001),
      journal,
      receipt_money: receiptMoney,
    });
  } catch (err) {
    return fail(err, "Không tải được kho.");
  }
}

export async function POST(request: Request) {
  const gate = await officeWrite();
  if (!gate.user || !gate.supabase) return gate.response;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  try {
    if (body?.kind === "location") {
      const code = String(body.code || "").trim();
      const name = String(body.name || "").trim();
      if (!code || !name) return jsonError("Nhập mã và tên địa điểm.", 400);
      const inserted = await gate.supabase.from("stock_locations").insert({
        code,
        name,
        kind: body.place_kind === "cong_truong" ? "cong_truong" : "kho",
        note: String(body.note || "").trim() || null,
      }).select("id").single();
      if (inserted.error) return jsonError(inserted.error.message.includes("duplicate") ? "Mã địa điểm đã có." : inserted.error.message, 400);
      return NextResponse.json(inserted.data);
    }
    if (body?.kind === "item") {
      const code = String(body.code || "").trim();
      const name = String(body.name || "").trim();
      const unit = String(body.unit || "").trim();
      if (!code || !name || !unit) return jsonError("Nhập mã, tên và đơn vị.", 400);
      const inserted = await gate.supabase.from("stock_items").insert({
        code,
        name,
        unit,
        kind: body.item_kind === "cong_cu" ? "cong_cu" : "vat_lieu",
        material_price_id: body.material_price_id ? String(body.material_price_id) : null,
      }).select("id").single();
      if (inserted.error) return jsonError(inserted.error.message.includes("duplicate") ? "Mã hàng đã có." : inserted.error.message, 400);
      return NextResponse.json(inserted.data);
    }
    const lines = Array.isArray(body?.lines) ? body.lines : [];
    const posted = await gate.supabase.rpc("post_stock_move", {
      p_body: {
        kind: String(body?.move_kind || ""),
        location_id: String(body?.location_id || ""),
        to_location_id: String(body?.to_location_id || ""),
        supplier_id: String(body?.supplier_id || ""),
        project_id: String(body?.project_id || ""),
        task_id: String(body?.task_id || ""),
        receiver_worker_id: String(body?.receiver_worker_id || ""),
        receiver_name: String(body?.receiver_name || ""),
        move_date: String(body?.move_date || ""),
        note: String(body?.note || ""),
        lines,
      } as Json,
    });
    if (posted.error) return jsonError(posted.error.message, 400);
    return NextResponse.json({ id: posted.data });
  } catch (err) {
    return fail(err, "Không ghi được kho.");
  }
}
