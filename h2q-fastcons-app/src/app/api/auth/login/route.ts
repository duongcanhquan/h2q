import { NextResponse } from "next/server";
import {
  FULL_NAME_COOKIE,
  SID_COOKIE,
  USER_COOKIE,
  getFrappeBaseUrl,
  parseSetCookieSid,
} from "@/lib/frappe/server";

export const runtime = "nodejs";

type LoginBody = { usr?: string; pwd?: string };

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LoginBody;
    const usr = body.usr?.trim();
    const pwd = body.pwd;
    if (!usr || !pwd) {
      return NextResponse.json({ message: "usr and pwd are required" }, { status: 400 });
    }

    const base = getFrappeBaseUrl();
    const form = new URLSearchParams({ usr, pwd });
    const upstream = await fetch(`${base}/api/method/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: form.toString(),
      redirect: "manual",
    });

    const raw = await upstream.text();
    let json: Record<string, unknown> = {};
    try {
      json = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    } catch {
      json = { message: raw };
    }

    if (!upstream.ok) {
      return NextResponse.json(
        {
          message:
            (json.message as string) ||
            (json._error_message as string) ||
            "Login failed",
        },
        { status: upstream.status === 401 ? 401 : 400 },
      );
    }

    const setCookies =
      typeof upstream.headers.getSetCookie === "function"
        ? upstream.headers.getSetCookie()
        : upstream.headers.get("set-cookie")
          ? [upstream.headers.get("set-cookie")!]
          : [];

    const sid = parseSetCookieSid(setCookies);
    if (!sid) {
      return NextResponse.json(
        { message: "Frappe login ok but sid cookie missing. Check CORS / site URL." },
        { status: 502 },
      );
    }

    const fullName =
      (json.full_name as string) ||
      ((json.message as { full_name?: string } | string | undefined) &&
      typeof json.message === "object"
        ? (json.message as { full_name?: string }).full_name
        : undefined);

    const res = NextResponse.json({
      user: usr,
      full_name: fullName || usr,
    });

    const secure = process.env.NODE_ENV === "production";
    const cookieOpts = {
      httpOnly: true,
      secure,
      sameSite: "lax" as const,
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    };
    res.cookies.set(SID_COOKIE, sid, cookieOpts);
    res.cookies.set(USER_COOKIE, usr, cookieOpts);
    if (fullName) res.cookies.set(FULL_NAME_COOKIE, fullName, cookieOpts);
    return res;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login proxy failed";
    return NextResponse.json({ message }, { status: 500 });
  }
}
