import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SID_COOKIE } from "@/lib/frappe/constants";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic =
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/sync") || // webhook/cron uses x-sync-secret, not sid
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/icons") ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/favicon.ico" ||
    pathname === "/sw.js" ||
    pathname.startsWith("/workbox");

  if (isPublic) return NextResponse.next();

  const sid = request.cookies.get(SID_COOKIE)?.value;
  if (!sid) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname === "/" ? "/dashboard" : pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
