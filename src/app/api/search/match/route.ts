import { NextRequest, NextResponse } from "next/server";
import { matchTitleToMedia } from "@/lib/cinemeta";
import { parseRelease } from "@/lib/media";

export async function GET(req: NextRequest) {
  const filename = req.nextUrl.searchParams.get("filename")?.trim() || "";
  if (!filename) {
    return NextResponse.json({ match: null });
  }

  const parsed = parseRelease(filename);
  if (parsed.query.length < 2) {
    return NextResponse.json({ match: null, parsed });
  }

  try {
    const match = await matchTitleToMedia(
      parsed.query,
      parsed.type,
      parsed.year,
    );
    return NextResponse.json({ match, parsed });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Match failed",
        match: null,
      },
      { status: 502 },
    );
  }
}
