import type { MediaItem, MediaType } from "@/lib/media";

const CINEMETA = "https://v3-cinemeta.strem.io";
const TORRENTIO = "https://torrentio.strem.fun";
const UA = "RealDebridManager/1.0";

type CinemetaMeta = {
  id?: string;
  imdb_id?: string;
  type?: string;
  name?: string;
  poster?: string;
  background?: string;
  releaseInfo?: string;
  year?: string;
  description?: string;
  imdbRating?: string;
  genres?: string[];
  genre?: string[];
};

function mapMeta(m: CinemetaMeta, fallbackType?: MediaType): MediaItem | null {
  const imdbId = m.imdb_id || m.id;
  if (!imdbId || !m.name) return null;
  const type = (m.type === "series" ? "series" : "movie") as MediaType;
  return {
    id: imdbId,
    imdbId,
    type: fallbackType ?? type,
    name: m.name,
    poster: m.poster,
    background: m.background,
    year: m.releaseInfo || m.year,
    description: m.description,
    rating: m.imdbRating,
    genres: m.genres || m.genre,
  };
}

export async function searchCinemeta(
  query: string,
  type: MediaType | "all" = "all",
): Promise<MediaItem[]> {
  const q = encodeURIComponent(query.trim());
  if (!q) return [];

  const types: MediaType[] =
    type === "all" ? ["movie", "series"] : [type];

  const results = await Promise.all(
    types.map(async (t) => {
      const url = `${CINEMETA}/catalog/${t}/top/search=${q}.json`;
      const res = await fetch(url, {
        headers: { "User-Agent": UA },
        next: { revalidate: 3600 },
      });
      if (!res.ok) return [] as MediaItem[];
      const data = (await res.json()) as { metas?: CinemetaMeta[] };
      return (data.metas ?? [])
        .map((m) => mapMeta(m, t))
        .filter((m): m is MediaItem => !!m);
    }),
  );

  const seen = new Set<string>();
  const merged: MediaItem[] = [];
  for (const item of results.flat()) {
    const key = `${item.type}:${item.imdbId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  return merged;
}

export async function getCinemetaMeta(
  imdbId: string,
  type: MediaType,
): Promise<MediaItem | null> {
  const url = `${CINEMETA}/meta/${type}/${encodeURIComponent(imdbId)}.json`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    next: { revalidate: 86400 },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { meta?: CinemetaMeta };
  return data.meta ? mapMeta(data.meta, type) : null;
}

/** Optional TMDB enrichment when TMDB_API_KEY is set. */
export async function searchTmdb(
  query: string,
  type: MediaType | "all" = "all",
): Promise<MediaItem[]> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return [];

  const kinds =
    type === "all"
      ? (["movie", "tv"] as const)
      : type === "series"
        ? (["tv"] as const)
        : (["movie"] as const);

  const out: MediaItem[] = [];
  for (const kind of kinds) {
    const url = new URL(`https://api.themoviedb.org/3/search/${kind}`);
    url.searchParams.set("api_key", key);
    url.searchParams.set("query", query);
    url.searchParams.set("include_adult", "false");
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) continue;
    const data = (await res.json()) as {
      results?: Array<{
        id: number;
        title?: string;
        name?: string;
        overview?: string;
        poster_path?: string | null;
        backdrop_path?: string | null;
        release_date?: string;
        first_air_date?: string;
        vote_average?: number;
      }>;
    };

    for (const r of data.results ?? []) {
      const mediaType: MediaType = kind === "tv" ? "series" : "movie";
      const year = (r.release_date || r.first_air_date || "").slice(0, 4);
      out.push({
        id: `tmdb:${kind}:${r.id}`,
        imdbId: `tmdb:${kind}:${r.id}`,
        type: mediaType,
        name: r.title || r.name || "Sin título",
        poster: r.poster_path
          ? `https://image.tmdb.org/t/p/w342${r.poster_path}`
          : undefined,
        background: r.backdrop_path
          ? `https://image.tmdb.org/t/p/w780${r.backdrop_path}`
          : undefined,
        year: year || undefined,
        description: r.overview,
        rating: r.vote_average ? r.vote_average.toFixed(1) : undefined,
      });
    }
  }
  return out;
}

export async function fetchTorrentioStreams(
  imdbId: string,
  type: MediaType,
  season?: number,
  episode?: number,
) {
  let path = `stream/${type}/${imdbId}.json`;
  if (type === "series" && season != null && episode != null) {
    path = `stream/series/${imdbId}:${season}:${episode}.json`;
  }
  const res = await fetch(`${TORRENTIO}/${path}`, {
    headers: { "User-Agent": UA },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Torrentio error ${res.status}`);
  }
  return (await res.json()) as {
    streams?: Array<{
      name?: string;
      title?: string;
      infoHash?: string;
      fileIdx?: number;
      behaviorHints?: { filename?: string };
    }>;
  };
}
