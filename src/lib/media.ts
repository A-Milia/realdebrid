export type MediaType = "movie" | "series";

export type MediaItem = {
  id: string;
  imdbId: string;
  type: MediaType;
  name: string;
  poster?: string;
  background?: string;
  year?: string;
  description?: string;
  rating?: string;
  genres?: string[];
};

export type TorrentCandidate = {
  infoHash: string;
  title: string;
  quality?: string;
  size?: string;
  seeds?: string;
  source?: string;
  filename?: string;
  fileIdx?: number;
};

const JUNK =
  /\b(1080p|2160p|4320p|720p|480p|4k|uhd|hdr10?|dv|dolby|vision|web[- ]?dl|webrip|bluray|bdrip|brrip|dvdrip|hdtv|x264|x265|h\.?265|hevc|av1|aac|dts|atmos|truehd|proper|repack|extended|remux|multi|ita|eng|spa|latinas?|nf|amzn|dsnp|ai|upscale|upscaled|upscaling|mesc|repack|internal|limited|complete|pack)\b/gi;

export function magnetFromHash(infoHash: string, name?: string): string {
  const hash = infoHash.trim().toLowerCase();
  const dn = name ? `&dn=${encodeURIComponent(name)}` : "";
  return `magnet:?xt=urn:btih:${hash}${dn}`;
}

function scrub(text: string): string {
  return text
    .replace(/[._]/g, " ")
    .replace(JUNK, " ")
    .replace(/\[[^\]]*\]|\([^)]*\)/g, " ")
    .replace(/\b(19|20)\d{2}\b/g, " ")
    .replace(/[-–—]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseRelease(filename: string): {
  query: string;
  year?: string;
  season?: number;
  episode?: number;
  type: MediaType;
} {
  const raw = filename.replace(/\.[a-z0-9]{2,4}$/i, "");
  const yearMatch = raw.match(/\b((?:19|20)\d{2})\b/);
  const year = yearMatch?.[1];

  // Serie: quedarnos con el título ANTES de SxxExx (evita “Ai Upscale”, títulos de episodio, etc.)
  const se = raw.match(/^(.*?)[\s._-]*[Ss](\d{1,2})[Ee](\d{1,2})\b/);
  if (se) {
    const query = scrub(se[1]);
    return {
      query: query || scrub(raw),
      year,
      season: Number(se[2]),
      episode: Number(se[3]),
      type: "series",
    };
  }

  return {
    query: scrub(raw),
    year,
    type: "movie",
  };
}

/** Tokens significativos para comparar títulos. */
export function titleTokens(value: string): string[] {
  return scrub(value)
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

/** Similitud 0–1 por solapamiento de tokens (Jaccard suave). */
export function titleSimilarity(a: string, b: string): number {
  const ta = new Set(titleTokens(a));
  const tb = new Set(titleTokens(b));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  return inter / Math.max(ta.size, tb.size);
}

export function parseTorrentioTitle(title: string): {
  name: string;
  size?: string;
  seeds?: string;
  source?: string;
} {
  const lines = title.split("\n").map((l) => l.trim()).filter(Boolean);
  const name = lines[0] || title;
  const meta = lines.slice(1).join(" ");
  const size = meta.match(/💾\s*([0-9.]+\s*[KMGT]B)/i)?.[1];
  const seeds = meta.match(/👤\s*(\d+)/)?.[1];
  const source = meta.match(/⚙️\s*(\S+)/)?.[1];
  return { name, size, seeds, source };
}
