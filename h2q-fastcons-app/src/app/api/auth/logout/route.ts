import { NextResponse } from "next/server";
import {
  FULL_NAME_COOKIE,
  SID_COOKIE,
  USER_COOKIE,
  getFrappeBaseUrl,
  getSidFromCookies,
} from "@/lib/frappe/server";

export const runtime = "nodejs";

export async function POST() {
  try {
    const sid = await getSidFromCookies();
    const base = getFrappeBaseUrl();
    if (sid) {
      await fetch(`${base}/api/method/logout`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Cookie: `sid=${sid}`,
        },
      }).catch(() => undefined);
    }
  } finally {
    const res = NextResponse.json({ ok: true });
    for (const name of [SID_COOKIE, USER_COOKIE, FULL_NAME_COOKIE]) {
      res.cookies.set(name, "", { httpOnly: true, path: "/", maxAge: 0 });
    }
    return res;
  }
}
