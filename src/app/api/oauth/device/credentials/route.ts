import { NextRequest, NextResponse } from "next/server";

const OAUTH = "https://api.real-debrid.com/oauth/v2";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const clientId = searchParams.get("client_id");
  const code = searchParams.get("code");
  if (!clientId || !code) {
    return NextResponse.json(
      { error: "client_id and code required" },
      { status: 400 },
    );
  }

  const url = `${OAUTH}/device/credentials?client_id=${encodeURIComponent(clientId)}&code=${encodeURIComponent(code)}`;
  const upstream = await fetch(url, { cache: "no-store" });
  const data = await upstream.text();
  return new NextResponse(data || null, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
