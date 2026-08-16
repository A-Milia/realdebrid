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

function upgradePoster(poster?: string, imdbId?: string): string | undefined {
  if (imdbId?.startsWith("tt")) {
    return `https://images.metahub.space/poster/medium/${imdbId}/img`;
  }
  if (!poster) return undefined;
  return poster.replace("/poster/small/", "/poster/medium/");
}

function mapMeta(m: CinemetaMeta, fallbackType?: MediaType): MediaItem | null {
  const imdbId = m.imdb_id || m.id;
  if (!imdbId || !m.name) return null;
  const type = (m.type === "series" ? "series" : "movie") as MediaType;
  return {
    id: imdbId,
    imdbId,
    type: fallbackType ?? type,
    name: m.name,
    poster: upgradePoster(m.poster, imdbId),
    background:
      m.background ||
      (imdbId.startsWith("tt")
        ? `https://images.metahub.space/background/medium/${imdbId}/img`
        : undefined),
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

async function tmdbExternalImdb(
  kind: "movie" | "tv",
  id: number,
  apiKey: string,
): Promise<string | null> {
  const res = await fetch(
    `https://api.themoviedb.org/3/${kind}/${id}/external_ids?api_key=${apiKey}`,
    { next: { revalidate: 86400 } },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { imdb_id?: string | null };
  return data.imdb_id || null;
}

/** TMDB search with IMDB resolution for Torrentio compatibility. */
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

    const top = (data.results ?? []).slice(0, 10);
    const withImdb = await Promise.all(
      top.map(async (r) => {
        const imdb = await tmdbExternalImdb(kind, r.id, key);
        const mediaType: MediaType = kind === "tv" ? "series" : "movie";
        const year = (r.release_date || r.first_air_date || "").slice(0, 4);
        const imdbId = imdb || `tmdb:${kind}:${r.id}`;
        return {
          id: imdbId,
          imdbId,
          type: mediaType,
          name: r.title || r.name || "Sin título",
          poster: r.poster_path
            ? `https://image.tmdb.org/t/p/w500${r.poster_path}`
            : upgradePoster(undefined, imdb || undefined),
          background: r.backdrop_path
            ? `https://image.tmdb.org/t/p/w1280${r.backdrop_path}`
            : undefined,
          year: year || undefined,
          description: r.overview,
          rating: r.vote_average ? r.vote_average.toFixed(1) : undefined,
        } satisfies MediaItem;
      }),
    );
    out.push(...withImdb);
  }
  return out;
}

export async function matchTitleToMedia(
  query: string,
  preferred: MediaType,
  year?: string,
): Promise<MediaItem | null> {
  let results = await searchCinemeta(query, preferred);
  if (!results.length) {
    results = await searchCinemeta(
      query,
      preferred === "movie" ? "series" : "movie",
    );
  }
  if (!results.length) {
    results = await searchTmdb(query, preferred);
  }
  if (!results.length) {
    results = await searchTmdb(
      query,
      preferred === "movie" ? "series" : "movie",
    );
  }
  if (!results.length) return null;

  let best = results[0];
  if (year) {
    const withYear = results.find((r) => r.year?.includes(year));
    if (withYear) best = withYear;
  }

  if (best.imdbId.startsWith("tt")) {
    const full = await getCinemetaMeta(best.imdbId, best.type);
    if (full) return full;
  }
  return best;
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

export function isTmdbConfigured() {
  return Boolean(process.env.TMDB_API_KEY);
}
