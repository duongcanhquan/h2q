import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createSupabaseProxy, supabaseEnv } from "@/lib/supabase/server";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic =
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/icons") ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/favicon.ico" ||
    pathname === "/sw.js" ||
    pathname.startsWith("/workbox");

  const response = NextResponse.next({ request });
  const env = supabaseEnv();
  if (!env.configured) {
    if (isPublic) return response;
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ message: "Chưa cấu hình Supabase." }, { status: 503 });
    }
    return redirectToLogin(request);
  }

  const supabase = createSupabaseProxy(request, response);
  let userId = "";
  try {
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id || "";
  } catch {
    userId = "";
  }
  if (!userId && !isPublic) {
    if (pathname.startsWith("/api/")) {
      const denied = NextResponse.json({ message: "Phiên đăng nhập đã hết." }, { status: 401 });
      response.cookies.getAll().forEach((cookie) => {
        denied.cookies.set(cookie);
      });
      return denied;
    }
    const redirect = redirectToLogin(request, pathname);
    response.cookies.getAll().forEach((cookie) => {
      redirect.cookies.set(cookie);
    });
    return redirect;
  }
  return response;
}

function redirectToLogin(request: NextRequest, pathname = request.nextUrl.pathname) {
  const login = new URL("/login", request.url);
  login.searchParams.set("next", pathname === "/" ? "/dashboard" : pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
