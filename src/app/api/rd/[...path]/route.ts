import { NextRequest, NextResponse } from "next/server";

const RD_API = "https://api.real-debrid.com/rest/1.0";

type Params = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, { params }: Params) {
  return proxy(req, await params);
}

export async function POST(req: NextRequest, { params }: Params) {
  return proxy(req, await params);
}

export async function PUT(req: NextRequest, { params }: Params) {
  return proxy(req, await params);
}

export async function DELETE(req: NextRequest, { params }: Params) {
  return proxy(req, await params);
}

async function proxy(req: NextRequest, params: { path: string[] }) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing token" }, { status: 401 });
  }

  const path = params.path.join("/");
  const url = new URL(`${RD_API}/${path}`);
  req.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });

  const headers = new Headers();
  headers.set("Authorization", auth);

  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);

  const method = req.method;
  const body =
    method === "GET" || method === "HEAD" || method === "DELETE"
      ? undefined
      : await req.arrayBuffer();

  const upstream = await fetch(url, {
    method,
    headers,
    body: body && body.byteLength > 0 ? body : undefined,
    cache: "no-store",
  });

  const responseHeaders = new Headers();
  const total = upstream.headers.get("X-Total-Count");
  if (total) responseHeaders.set("X-Total-Count", total);
  const upstreamType = upstream.headers.get("Content-Type");
  if (upstreamType) responseHeaders.set("Content-Type", upstreamType);

  const data = await upstream.arrayBuffer();
  // No forzar application/json en respuestas vacías (204 delete/selectFiles).
  if (!upstreamType && data.byteLength > 0) {
    responseHeaders.set("Content-Type", "application/json");
  }

  return new NextResponse(data.byteLength ? data : null, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
