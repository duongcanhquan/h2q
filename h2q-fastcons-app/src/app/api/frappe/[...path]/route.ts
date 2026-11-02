import { NextRequest, NextResponse } from "next/server";
import { getFrappeBaseUrl, getSidFromCookies } from "@/lib/frappe/server";

export const runtime = "nodejs";

async function proxy(request: NextRequest, path: string[]) {
  const sid = await getSidFromCookies();
  if (!sid) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const base = getFrappeBaseUrl();
  const targetPath = path.join("/");
  const url = new URL(`${base}/${targetPath}`);
  request.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });

  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  headers.set("accept", request.headers.get("accept") || "application/json");
  headers.set("cookie", `sid=${sid}`);

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: "manual",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = Buffer.from(await request.arrayBuffer());
  }

  const upstream = await fetch(url, init);
  const buf = await upstream.arrayBuffer();
  const resHeaders = new Headers();
  const upstreamType = upstream.headers.get("content-type");
  if (upstreamType) resHeaders.set("content-type", upstreamType);

  return new NextResponse(buf, {
    status: upstream.status,
    headers: resHeaders,
  });
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(request, path);
}
export async function POST(request: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(request, path);
}
export async function PUT(request: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(request, path);
}
export async function PATCH(request: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(request, path);
}
export async function DELETE(request: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(request, path);
}
