import { NextResponse } from "next/server";
import { supabaseEnv } from "@/lib/supabase/server";

export async function GET() {
  const env = supabaseEnv();
  return NextResponse.json({
    ok: env.configured,
    app: "h2q-fastcons",
    time: new Date().toISOString(),
    supabase_configured: env.configured,
  });
}
