import type { MediaItem, MediaType } from "@/lib/media";
import { titleSimilarity } from "@/lib/media";
import { cacheKey, cached } from "@/lib/server-cache";

const CINEMETA = "https://v3-cinemeta.strem.io";
const TORRENTIO = "https://torrentio.strem.fun";
const UA = "RealDebridManager/1.0";

const SEARCH_TTL = 30 * 60 * 1000;
const META_TTL = 24 * 60 * 60 * 1000;
const STREAM_TTL = 10 * 60 * 1000;

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

async function fetchJson<T>(
  url: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<T | null> {
  const timeoutMs = init?.timeoutMs ?? 3500;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: { "User-Agent": UA, ...(init?.headers || {}) },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function searchCinemeta(
  query: string,
  type: MediaType | "all" = "all",
): Promise<MediaItem[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  return cached(cacheKey(["cinemeta", type, q]), SEARCH_TTL, async () => {
    const types: MediaType[] = type === "all" ? ["movie", "series"] : [type];
    const encoded = encodeURIComponent(q);

    const results = await Promise.all(
      types.map(async (t) => {
        const data = await fetchJson<{ metas?: CinemetaMeta[] }>(
          `${CINEMETA}/catalog/${t}/top/search=${encoded}.json`,
          { timeoutMs: 2800, next: { revalidate: 1800 } },
        );
        return (data?.metas ?? [])
          .map((m) => mapMeta(m, t))
          .filter((m): m is MediaItem => !!m && m.imdbId.startsWith("tt"));
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
    return merged.slice(0, 24);
  });
}

/** Light TMDB search — no per-result external_ids (that made DMM-like slowness). */
export async function searchTmdbLight(
  query: string,
  type: MediaType | "all" = "all",
): Promise<MediaItem[]> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return [];
  const q = query.trim();
  if (q.length < 2) return [];

  return cached(cacheKey(["tmdb-light", type, q]), SEARCH_TTL, async () => {
    const kinds =
      type === "all"
        ? (["movie", "tv"] as const)
        : type === "series"
          ? (["tv"] as const)
          : (["movie"] as const);

    const batches = await Promise.all(
      kinds.map(async (kind) => {
        const url = new URL(`https://api.themoviedb.org/3/search/${kind}`);
        url.searchParams.set("api_key", key);
        url.searchParams.set("query", q);
        url.searchParams.set("include_adult", "false");
        url.searchParams.set("language", "es-ES");
        const data = await fetchJson<{
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
        }>(url.toString(), { timeoutMs: 2200, next: { revalidate: 1800 } });

        return (data?.results ?? []).slice(0, 8).map((r) => {
          const mediaType: MediaType = kind === "tv" ? "series" : "movie";
          const year = (r.release_date || r.first_air_date || "").slice(0, 4);
          const id = `tmdb:${kind}:${r.id}`;
          return {
            id,
            imdbId: id,
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
          } satisfies MediaItem;
        });
      }),
    );

    return batches.flat();
  });
}

export async function getCinemetaMeta(
  imdbId: string,
  type: MediaType,
): Promise<MediaItem | null> {
  return cached(cacheKey(["meta", type, imdbId]), META_TTL, async () => {
    const data = await fetchJson<{ meta?: CinemetaMeta }>(
      `${CINEMETA}/meta/${type}/${encodeURIComponent(imdbId)}.json`,
      { timeoutMs: 3000, next: { revalidate: 86400 } },
    );
    return data?.meta ? mapMeta(data.meta, type) : null;
  });
}

export async function matchTitleToMedia(
  query: string,
  preferred: MediaType,
  year?: string,
): Promise<MediaItem | null> {
  return cached(
    cacheKey(["match-v3", preferred, year, query]),
    SEARCH_TTL,
    async () => {
      const q = query.trim();
      if (q.length < 2) return null;

      let results = await searchCinemeta(q, preferred);
      if (!results.length) {
        results = await searchCinemeta(
          q,
          preferred === "movie" ? "series" : "movie",
        );
      }
      if (!results.length) return null;

      // Ranking por similitud de título (evita “Upscale…” por una palabra suelta)
      const scored = results
        .map((r) => ({
          item: r,
          score: titleSimilarity(q, r.name) + (year && r.year?.includes(year) ? 0.15 : 0),
        }))
        .sort((a, b) => b.score - a.score);

      const best = scored[0];
      // Umbral: al menos un token fuerte en común
      if (!best || best.score < 0.34) return null;

      // Catalog search a veces no trae description → meta completa
      if (!best.item.description && best.item.imdbId.startsWith("tt")) {
        const full = await getCinemetaMeta(best.item.imdbId, best.item.type);
        if (full) return { ...best.item, ...full, description: full.description || best.item.description };
      }
      return best.item;
    },
  );
}

export async function fetchTorrentioStreams(
  imdbId: string,
  type: MediaType,
  season?: number,
  episode?: number,
) {
  const key = cacheKey(["torrentio", type, imdbId, season, episode]);
  return cached(key, STREAM_TTL, async () => {
    let path = `stream/${type}/${imdbId}.json`;
    if (type === "series" && season != null && episode != null) {
      path = `stream/series/${imdbId}:${season}:${episode}.json`;
    }
    const data = await fetchJson<{
      streams?: Array<{
        name?: string;
        title?: string;
        infoHash?: string;
        fileIdx?: number;
        behaviorHints?: { filename?: string };
      }>;
    }>(`${TORRENTIO}/${path}`, {
      timeoutMs: 12000,
      next: { revalidate: 600 },
    });
    if (!data) throw new Error("Torrentio no respondió a tiempo");
    return data;
  });
}

export function isTmdbConfigured() {
  return Boolean(process.env.TMDB_API_KEY);
}

/** @deprecated use searchTmdbLight — kept name for older imports */
export const searchTmdb = searchTmdbLight;
