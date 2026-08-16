import { NextRequest, NextResponse } from "next/server";
import { isTmdbConfigured, searchCinemeta, searchTmdb } from "@/lib/cinemeta";
import type { MediaItem, MediaType } from "@/lib/media";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() || "";
  const type = (req.nextUrl.searchParams.get("type") || "all") as
    | MediaType
    | "all";

  if (q.length < 2) {
    return NextResponse.json({ results: [], tmdbEnabled: isTmdbConfigured() });
  }

  try {
    const [cinemeta, tmdb] = await Promise.all([
      searchCinemeta(q, type),
      searchTmdb(q, type),
    ]);

    const byImdb = new Map<string, MediaItem>();
    for (const item of [...cinemeta, ...tmdb]) {
      if (!item.imdbId.startsWith("tt")) continue;
      const key = `${item.type}:${item.imdbId}`;
      const prev = byImdb.get(key);
      if (!prev) {
        byImdb.set(key, item);
        continue;
      }
      // Prefer richer description/poster
      byImdb.set(key, {
        ...prev,
        ...item,
        poster: item.poster || prev.poster,
        background: item.background || prev.background,
        description: item.description || prev.description,
        rating: item.rating || prev.rating,
        genres: item.genres?.length ? item.genres : prev.genres,
      });
    }

    return NextResponse.json({
      results: [...byImdb.values()].slice(0, 40),
      providers: {
        cinemeta: cinemeta.length,
        tmdb: tmdb.length,
        tmdbEnabled: isTmdbConfigured(),
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Search failed" },
      { status: 502 },
    );
  }
}
