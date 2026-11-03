import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = await createSupabaseServer();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return NextResponse.json({ authenticated: false }, { status: 401 });
    const profile = await supabase
      .from("profiles")
      .select("full_name, email, app_role")
      .eq("id", data.user.id)
      .maybeSingle();
    return NextResponse.json({
      authenticated: true,
      user: profile.data?.email || data.user.email,
      full_name: profile.data?.full_name || data.user.email,
      app_role: profile.data?.app_role || "engineer",
    });
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 503 });
  }
}
