import { NextRequest, NextResponse } from "next/server";
import {
  isTmdbConfigured,
  searchCinemeta,
  searchTmdbLight,
} from "@/lib/cinemeta";
import type { MediaItem, MediaType } from "@/lib/media";

export const runtime = "nodejs";

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "public, s-maxage=120, stale-while-revalidate=1800",
    },
  });
}

function normalize(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() || "";
  const type = (req.nextUrl.searchParams.get("type") || "all") as
    | MediaType
    | "all";

  if (q.length < 2) {
    return json({ results: [], providers: { tmdbEnabled: isTmdbConfigured() } });
  }

  try {
    // Cinemeta first (has IMDB → Torrentio). Don't block on TMDB.
    const cinemetaPromise = searchCinemeta(q, type);
    const tmdbPromise = isTmdbConfigured()
      ? searchTmdbLight(q, type)
      : Promise.resolve([] as MediaItem[]);

    const cinemeta = await cinemetaPromise;

    // If Cinemeta already has enough, return immediately and let client paint.
    // Still merge TMDB if it finishes within a short window.
    let tmdb: MediaItem[] = [];
    if (cinemeta.length >= 8) {
      tmdb = await Promise.race([
        tmdbPromise,
        new Promise<MediaItem[]>((resolve) =>
          setTimeout(() => resolve([]), 180),
        ),
      ]);
    } else {
      tmdb = await Promise.race([
        tmdbPromise,
        new Promise<MediaItem[]>((resolve) =>
          setTimeout(() => resolve([]), 900),
        ),
      ]);
    }

    const byImdb = new Map<string, MediaItem>();
    for (const item of cinemeta) {
      if (!item.imdbId.startsWith("tt")) continue;
      byImdb.set(`${item.type}:${item.imdbId}`, item);
    }

    // Enrich Cinemeta hits with TMDB posters/descriptions by fuzzy name+year
    if (tmdb.length) {
      const index = [...byImdb.values()];
      for (const t of tmdb) {
        const n = normalize(t.name);
        const hit = index.find((c) => {
          const cn = normalize(c.name);
          const sameYear = !t.year || !c.year || c.year.includes(t.year);
          return sameYear && (cn === n || cn.includes(n) || n.includes(cn));
        });
        if (hit) {
          byImdb.set(`${hit.type}:${hit.imdbId}`, {
            ...hit,
            poster: hit.poster || t.poster,
            background: hit.background || t.background,
            description: hit.description || t.description,
            rating: hit.rating || t.rating,
          });
        }
      }
    }

    // Prefer IMDB-backed results (torrent-ready). Append leftover TMDB only if thin.
    let results = [...byImdb.values()];
    if (results.length < 6) {
      const extras = tmdb.filter((t) => {
        const n = normalize(t.name);
        return !results.some((r) => normalize(r.name) === n);
      });
      // Mark non-imdb so UI can disable "add" until resolved — filter them out for add flow
      results = [...results, ...extras.filter((e) => e.imdbId.startsWith("tt"))];
    }

    return json({
      results: results.slice(0, 24),
      providers: {
        cinemeta: cinemeta.length,
        tmdb: tmdb.length,
        tmdbEnabled: isTmdbConfigured(),
        cachedFastPath: true,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Search failed" },
      { status: 502 },
    );
  }
}
