/** Agrupa nombres de torrent/descarga por título limpio (idea de DMM). */
export function cleanTitle(filename: string): string {
  return filename
    .replace(/\.[a-z0-9]{2,4}$/i, "")
    .replace(/[._]/g, " ")
    .replace(
      /\b(1080p|2160p|720p|480p|4k|uhd|hdr|dv|web[- ]?dl|bluray|x264|x265|hevc|aac|dts|proper|repack|extended|remux)\b/gi,
      "",
    )
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
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
