import { NextRequest, NextResponse } from "next/server";
import { fetchTorrentioStreams } from "@/lib/cinemeta";
import { parseTorrentioTitle, type MediaType } from "@/lib/media";

export const runtime = "nodejs";

function qualityScore(q?: string) {
  const s = (q || "").toLowerCase();
  if (s.includes("2160") || s.includes("4k") || s.includes("uhd")) return 400;
  if (s.includes("1080")) return 300;
  if (s.includes("720")) return 200;
  if (s.includes("480")) return 100;
  return 0;
}

export async function GET(req: NextRequest) {
  const imdbId = req.nextUrl.searchParams.get("imdbId")?.trim();
  const type = (req.nextUrl.searchParams.get("type") || "movie") as MediaType;
  const season = req.nextUrl.searchParams.get("season");
  const episode = req.nextUrl.searchParams.get("episode");

  if (!imdbId?.startsWith("tt")) {
    return NextResponse.json(
      { error: "Se necesita un IMDB id (tt…)" },
      { status: 400 },
    );
  }

  try {
    const data = await fetchTorrentioStreams(
      imdbId,
      type,
      season ? Number(season) : undefined,
      episode ? Number(episode) : undefined,
    );

    const torrents = (data.streams ?? [])
      .filter((s) => !!s.infoHash)
      .map((s) => {
        const parsed = parseTorrentioTitle(s.title || s.name || "");
        const quality = (s.name || "").split("\n")[1]?.trim();
        return {
          infoHash: s.infoHash!,
          title: parsed.name,
          quality,
          size: parsed.size,
          seeds: parsed.seeds,
          source: parsed.source,
          filename: s.behaviorHints?.filename,
          fileIdx: s.fileIdx,
        };
      })
      .sort((a, b) => {
        const seedDiff = Number(b.seeds || 0) - Number(a.seeds || 0);
        if (seedDiff) return seedDiff;
        return qualityScore(b.quality) - qualityScore(a.quality);
      })
      .slice(0, 40);

    return NextResponse.json(
      { torrents },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
        },
      },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Torrent search failed" },
      { status: 502 },
    );
  }
}
