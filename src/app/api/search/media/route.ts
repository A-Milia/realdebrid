import { NextRequest, NextResponse } from "next/server";
import { searchCinemeta, searchTmdb } from "@/lib/cinemeta";
import type { MediaType } from "@/lib/media";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() || "";
  const type = (req.nextUrl.searchParams.get("type") || "all") as
    | MediaType
    | "all";

  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const [cinemeta, tmdb] = await Promise.all([
      searchCinemeta(q, type),
      searchTmdb(q, type),
    ]);

    // Prefer Cinemeta (has IMDB ids for Torrentio). Append TMDB-only extras.
    const byKey = new Map(cinemeta.map((m) => [`${m.type}:${m.name}:${m.year}`, m]));
    for (const item of tmdb) {
      const key = `${item.type}:${item.name}:${item.year}`;
      if (!byKey.has(key) && item.imdbId.startsWith("tt")) {
        byKey.set(key, item);
      }
      // Skip pure TMDB ids without IMDB — can't query Torrentio reliably
    }

    return NextResponse.json({
      results: [...byKey.values()].slice(0, 40),
      providers: {
        cinemeta: cinemeta.length,
        tmdb: tmdb.length,
        tmdbEnabled: Boolean(process.env.TMDB_API_KEY),
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Search failed" },
      { status: 502 },
    );
  }
}
