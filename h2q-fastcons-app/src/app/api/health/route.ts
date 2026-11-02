import { NextResponse } from "next/server";

/** Lightweight probe for Vercel / uptime checks. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    app: "h2q-fastcons",
    time: new Date().toISOString(),
    frappe_url_configured: Boolean(
      process.env.FRAPPE_URL || process.env.NEXT_PUBLIC_FRAPPE_URL,
    ),
    supabase_configured: Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ),
  });
}
