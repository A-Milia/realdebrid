import { NextRequest, NextResponse } from "next/server";

const OAUTH = "https://api.real-debrid.com/oauth/v2";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const upstream = await fetch(`${OAUTH}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const data = await upstream.text();
  return new NextResponse(data, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
