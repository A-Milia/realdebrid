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

export function magnetFromHash(infoHash: string, name?: string): string {
  const hash = infoHash.trim().toLowerCase();
  const dn = name ? `&dn=${encodeURIComponent(name)}` : "";
  return `magnet:?xt=urn:btih:${hash}${dn}`;
}

export function parseRelease(filename: string): {
  query: string;
  year?: string;
  season?: number;
  episode?: number;
  type: MediaType;
} {
  const raw = filename.replace(/\.[a-z0-9]{2,4}$/i, "").replace(/[._]/g, " ");
  const se = raw.match(/\b[Ss](\d{1,2})[Ee](\d{1,2})\b/);
  const yearMatch = raw.match(/\b(19|20)\d{2}\b/);
  const year = yearMatch?.[0];
  let query = raw
    .replace(/\b[Ss]\d{1,2}[Ee]\d{1,2}\b/g, " ")
    .replace(
      /\b(1080p|2160p|720p|480p|4k|uhd|hdr10?|dv|web[- ]?dl|bluray|bdrip|brrip|x264|x265|hevc|av1|aac|dts|atmos|truehd|proper|repack|extended|remux|multi|ita|eng|spa|latinas?|nf|amzn|dsnp)\b/gi,
      " ",
    )
    .replace(/\b(19|20)\d{2}\b/g, " ")
    .replace(/\[[^\]]*\]|\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (se) {
    return {
      query,
      year,
      season: Number(se[1]),
      episode: Number(se[2]),
      type: "series",
    };
  }

  return { query, year, type: "movie" };
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
