import { NextRequest, NextResponse } from "next/server";

/**
 * Supabase Database Webhook target.
 * Configure in Dashboard → Database → Webhooks:
 *   Table: measurements_sync | Events: INSERT
 *   URL: https://<vercel-app>/api/sync/on-measurement
 *   HTTP Header: x-sync-secret: <SYNC_WEBHOOK_SECRET>
 *
 * Forwards to the flush worker so Frappe gets the new pending row.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.SYNC_WEBHOOK_SECRET?.trim();
  if (secret) {
    const header = request.headers.get("x-sync-secret");
    if (header !== secret) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
  }

  const payload = (await request.json().catch(() => ({}))) as {
    record?: { client_request_id?: string; id?: string; status?: string };
    type?: string;
  };

  const record = payload.record;
  if (!record || record.status !== "pending") {
    return NextResponse.json({ message: "ignored", reason: "not pending insert" });
  }

  const origin = new URL(request.url).origin;
  const res = await fetch(`${origin}/api/sync/flush-measurements`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(secret ? { "x-sync-secret": secret } : {}),
    },
    body: JSON.stringify({
      client_request_id: record.client_request_id,
    }),
  });

  const data = await res.json().catch(() => ({}));
  return NextResponse.json({ message: "forwarded", upstream: data }, { status: res.status });
}
