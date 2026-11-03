import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  try {
    const supabase = await createSupabaseServer();
    await supabase.auth.signOut();
  } catch {
    // Still return ok so the browser can leave the session screen.
  }
  return NextResponse.json({ ok: true });
}
