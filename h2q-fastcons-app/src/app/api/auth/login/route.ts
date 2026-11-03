import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

type LoginBody = { usr?: string; pwd?: string; email?: string; password?: string };

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LoginBody;
    const email = (body.usr || body.email || "").trim();
    const password = body.pwd || body.password || "";
    if (!email || !password) {
      return NextResponse.json({ message: "Nhập email và mật khẩu." }, { status: 400 });
    }

    const supabase = await createSupabaseServer();
    const signed = await supabase.auth.signInWithPassword({ email, password });
    if (signed.error || !signed.data.user) {
      const raw = signed.error?.message || "";
      const invalid = /invalid login|invalid credentials|email not confirmed/i.test(raw);
      const message = /email not confirmed/i.test(raw)
        ? "Email chưa được xác nhận. Tắt Confirm email trên Supabase hoặc xác nhận hộp thư."
        : invalid
          ? "Sai email hoặc mật khẩu."
          : raw || "Đăng nhập thất bại.";
      return NextResponse.json({ message }, { status: 401 });
    }

    const profile = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", signed.data.user.id)
      .maybeSingle();
    const fullName = profile.data?.full_name || signed.data.user.email || email;
    return NextResponse.json({
      user: profile.data?.email || signed.data.user.email || email,
      full_name: fullName,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Không kết nối được máy chủ.";
    return NextResponse.json({ message }, { status: 503 });
  }
}
