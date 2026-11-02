import { cookies } from "next/headers";
import { FULL_NAME_COOKIE, SID_COOKIE, USER_COOKIE } from "@/lib/frappe/constants";

export { FULL_NAME_COOKIE, SID_COOKIE, USER_COOKIE };

export function getFrappeBaseUrl(): string {
  const url =
    process.env.FRAPPE_URL?.trim() ||
    process.env.NEXT_PUBLIC_FRAPPE_URL?.trim() ||
    "";
  if (!url) {
    throw new Error("FRAPPE_URL / NEXT_PUBLIC_FRAPPE_URL is not configured");
  }
  return url.replace(/\/$/, "");
}

export async function getSidFromCookies(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(SID_COOKIE)?.value;
}

export function parseSetCookieSid(setCookieHeaders: string[]): string | undefined {
  for (const header of setCookieHeaders) {
    const match = /(?:^|,\s*)sid=([^;]+)/i.exec(header);
    if (match?.[1]) return decodeURIComponent(match[1]);
  }
  // Node fetch may join cookies; also try simple split
  for (const header of setCookieHeaders) {
    const parts = header.split(/,(?=\s*[^;]+=)/);
    for (const part of parts) {
      const m = /^\s*sid=([^;]+)/i.exec(part);
      if (m?.[1]) return decodeURIComponent(m[1]);
    }
  }
  return undefined;
}
