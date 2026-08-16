import { NextRequest, NextResponse } from "next/server";
import { fetchTorrentioStreams } from "@/lib/cinemeta";
import { parseTorrentioTitle, type MediaType } from "@/lib/media";

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
      .slice(0, 60);

    return NextResponse.json({ torrents });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Torrent search failed" },
      { status: 502 },
    );
  }
}
