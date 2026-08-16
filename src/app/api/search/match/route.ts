import { NextRequest, NextResponse } from "next/server";
import { getCinemetaMeta, searchCinemeta } from "@/lib/cinemeta";
import { parseRelease, type MediaType } from "@/lib/media";

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
    // Prefer matching the inferred type first
    let results = await searchCinemeta(parsed.query, parsed.type);
    if (!results.length && parsed.type === "movie") {
      results = await searchCinemeta(parsed.query, "series");
    } else if (!results.length) {
      results = await searchCinemeta(parsed.query, "movie");
    }

    let best = results[0] ?? null;
    if (best && parsed.year) {
      const withYear = results.find((r) => r.year?.includes(parsed.year!));
      if (withYear) best = withYear;
    }

    if (best?.imdbId.startsWith("tt")) {
      const full = await getCinemetaMeta(best.imdbId, best.type as MediaType);
      if (full) best = full;
    }

    return NextResponse.json({ match: best, parsed });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Match failed", match: null },
      { status: 502 },
    );
  }
}
