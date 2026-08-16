import { NextRequest, NextResponse } from "next/server";

const OAUTH = "https://api.real-debrid.com/oauth/v2";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const clientId = searchParams.get("client_id");
  const newCredentials = searchParams.get("new_credentials") || "yes";
  if (!clientId) {
    return NextResponse.json({ error: "client_id required" }, { status: 400 });
  }

  const url = `${OAUTH}/device/code?client_id=${encodeURIComponent(clientId)}&new_credentials=${encodeURIComponent(newCredentials)}`;
  const upstream = await fetch(url, { cache: "no-store" });
  const data = await upstream.text();
  return new NextResponse(data, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
