import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { FULL_NAME_COOKIE, SID_COOKIE, USER_COOKIE } from "@/lib/frappe/server";

export const runtime = "nodejs";

export async function GET() {
  const jar = await cookies();
  const sid = jar.get(SID_COOKIE)?.value;
  const user = jar.get(USER_COOKIE)?.value;
  if (!sid || !user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({
    authenticated: true,
    user,
    full_name: jar.get(FULL_NAME_COOKIE)?.value || user,
  });
}
