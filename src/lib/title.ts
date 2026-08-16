/** Agrupa nombres de torrent/descarga por título limpio (idea de DMM). */
import { parseRelease } from "@/lib/media";

function scrub(text: string): string {
  return text
    .replace(/\.[a-z0-9]{2,4}$/i, "")
    .replace(/[._]/g, " ")
    .replace(
      /\b(1080p|2160p|4320p|720p|480p|4k|uhd|hdr10?|dv|web[- ]?dl|webrip|bluray|bdrip|brrip|x264|x265|hevc|av1|aac|dts|atmos|truehd|proper|repack|extended|remux|ai|upscale|upscaled|upscaling|mesc|internal|complete)\b/gi,
      " ",
    )
    .replace(/\b[Ss]\d{1,2}[Ee]\d{1,2}\b/g, " ")
    .replace(/\b(19|20)\d{2}\b/g, " ")
    .replace(/[-–—]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function cleanTitle(filename: string): string {
  const parsed = parseRelease(filename);
  // Para series: título base + episodio → agrupa variantes del mismo capítulo
  if (parsed.type === "series" && parsed.season != null && parsed.episode != null) {
    const base = scrub(parsed.query);
    return `${base} s${String(parsed.season).padStart(2, "0")}e${String(parsed.episode).padStart(2, "0")}`;
  }
  return scrub(parsed.query || filename);
}

export function groupByTitle<T extends { filename: string }>(
  items: T[],
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = cleanTitle(item.filename) || item.filename.toLowerCase();
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  return map;
}
