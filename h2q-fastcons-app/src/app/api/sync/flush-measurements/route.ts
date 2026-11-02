import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/server";
import { getFrappeBaseUrl, getSidFromCookies } from "@/lib/frappe/server";
import type { MeasurementsSyncRow } from "@/lib/supabase/database.types";

export const runtime = "nodejs";

type FlushBody = {
  client_request_id?: string;
  limit?: number;
};

/**
 * Pull pending rows from Supabase `measurements_sync` and POST each payload
 * to Frappe `h2q_core.api.submit_measurement` using the caller's sid cookie
 * (or FRAPPE_API_KEY/SECRET service credentials when configured).
 */
function assertWebhookOrSession(request: NextRequest, hasSid: boolean) {
  const secret = process.env.SYNC_WEBHOOK_SECRET?.trim();
  const header = request.headers.get("x-sync-secret");
  const apiKey = process.env.FRAPPE_API_KEY?.trim();
  const apiSecret = process.env.FRAPPE_API_SECRET?.trim();
  if (secret && header === secret) return "webhook";
  if (hasSid) return "session";
  if (apiKey && apiSecret) return "api_key";
  return null;
}

export async function POST(request: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { message: "Supabase is not configured on this deployment" },
        { status: 503 },
      );
    }

    const sid = await getSidFromCookies();
    const authMode = assertWebhookOrSession(request, Boolean(sid));
    if (!authMode) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as FlushBody;
    const admin = getSupabaseAdmin();

    let query = admin
      .from("measurements_sync")
      .select("*")
      .in("sync_status", ["pending", "failed"])
      .eq("is_synced_to_frappe", false)
      .order("created_at", { ascending: true })
      .limit(Math.min(body.limit || 20, 50));

    if (body.client_request_id) {
      query = admin
        .from("measurements_sync")
        .select("*")
        .eq("client_request_id", body.client_request_id)
        .limit(1);
    }

    const { data: rows, error } = await query;
    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    const results: Array<Record<string, unknown>> = [];
    for (const row of (rows || []) as MeasurementsSyncRow[]) {
      results.push(await syncOneRow(row));
    }

    return NextResponse.json({ message: "success", data: { results } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "flush failed";
    return NextResponse.json({ message }, { status: 500 });
  }
}

async function syncOneRow(row: MeasurementsSyncRow) {
  const admin = getSupabaseAdmin();
  await admin
    .from("measurements_sync")
    .update({ sync_status: "syncing", last_error: null })
    .eq("id", row.id);

  try {
    const imageUrls = Array.isArray(row.image_urls) ? row.image_urls : [];
    if (row.image_url && !imageUrls.includes(row.image_url)) {
      imageUrls.unshift(row.image_url);
    }

    const mb = await callFrappeSubmitMeasurement({
      project: row.project,
      task: row.task,
      quantity: Number(row.quantity),
      image_url: row.image_url || imageUrls[0],
      image_urls: imageUrls,
      work_order: row.work_order !== "PENDING_RESOLVE" ? row.work_order : undefined,
      work_order_line: row.work_order_line || undefined,
      boq_item: row.boq_item || undefined,
      description: row.description,
      remarks: row.remarks || undefined,
      date: row.measurement_date || undefined,
      uom: row.uom || undefined,
      nos: row.nos ?? undefined,
      length: row.length ?? undefined,
      breadth: row.breadth ?? undefined,
      depth: row.depth ?? undefined,
      is_deduction: row.is_deduction,
      rate: row.rate ?? undefined,
      billed_amount: row.billed_amount ?? undefined,
      cost_code_type: row.cost_code_type || undefined,
      cost_code_group: row.cost_code_group || undefined,
      cost_code_item: row.cost_code_item || undefined,
      cost_code_label: row.cost_code_label || undefined,
      measured_by: row.measured_by || undefined,
      gps_lat: row.gps_lat ?? undefined,
      gps_lng: row.gps_lng ?? undefined,
      gps_accuracy: row.gps_accuracy ?? undefined,
      auto_request_approval: row.auto_request_approval ? 1 : undefined,
    });

    await admin
      .from("measurements_sync")
      .update({
        sync_status: "synced",
        is_synced_to_frappe: true,
        frappe_measurement_book: mb,
        synced_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("id", row.id);

    return { id: row.id, status: "synced", measurement_book: mb };
  } catch (error) {
    const message = error instanceof Error ? error.message : "sync failed";
    await admin
      .from("measurements_sync")
      .update({ sync_status: "failed", is_synced_to_frappe: false, last_error: message })
      .eq("id", row.id);
    return { id: row.id, status: "failed", error: message };
  }
}

async function callFrappeSubmitMeasurement(payload: Record<string, unknown>) {
  const base = getFrappeBaseUrl();
  const headers: HeadersInit = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  const apiKey = process.env.FRAPPE_API_KEY?.trim();
  const apiSecret = process.env.FRAPPE_API_SECRET?.trim();
  if (apiKey && apiSecret) {
    headers.Authorization = `token ${apiKey}:${apiSecret}`;
  } else {
    const sid = await getSidFromCookies();
    if (!sid) {
      throw new Error("No Frappe session (sid) or API key for sync worker");
    }
    headers.Cookie = `sid=${sid}`;
  }

  const upstream = await fetch(`${base}/api/method/h2q_core.api.submit_measurement`, {
    method: "POST",
    headers,
    body: JSON.stringify({ payload: JSON.stringify(payload) }),
  });

  const raw = await upstream.text();
  let json: Record<string, unknown> = {};
  try {
    json = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    throw new Error(raw.slice(0, 300) || `Frappe HTTP ${upstream.status}`);
  }

  if (!upstream.ok) {
    throw new Error(
      String(json._error_message || json.exception || json.message || `HTTP ${upstream.status}`),
    );
  }

  const message = json.message as { data?: { measurement_book?: string } } | undefined;
  const mb = message?.data?.measurement_book;
  if (!mb) {
    throw new Error("Frappe response missing measurement_book");
  }
  return mb;
}

/** Cron / Database Webhook can GET with x-sync-secret to drain the queue. */
export async function GET(request: NextRequest) {
  const secret = process.env.SYNC_WEBHOOK_SECRET?.trim();
  const header = request.headers.get("x-sync-secret");
  if (!secret || header !== secret) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const fake = new NextRequest(request.url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-sync-secret": secret,
    },
    body: JSON.stringify({ limit: 20 }),
  });
  return POST(fake);
}
