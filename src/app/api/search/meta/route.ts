import { NextRequest, NextResponse } from "next/server";
import { getCinemetaMeta } from "@/lib/cinemeta";
import type { MediaType } from "@/lib/media";

export async function GET(req: NextRequest) {
  const imdbId = req.nextUrl.searchParams.get("imdbId")?.trim();
  const type = (req.nextUrl.searchParams.get("type") || "movie") as MediaType;
  if (!imdbId) {
    return NextResponse.json({ error: "imdbId required" }, { status: 400 });
  }
  const meta = await getCinemetaMeta(imdbId, type);
  return NextResponse.json({ meta });
}
