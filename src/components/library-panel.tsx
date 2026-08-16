"use client";

import { useState } from "react";
import type { RdDownload, RdTorrent } from "@/lib/types";
import { DownloadsPanel } from "./downloads-panel";
import { TorrentsPanel } from "./torrents-panel";

type Props = {
  token: string;
  downloads: RdDownload[];
  torrents: RdTorrent[];
  query: string;
  onDownloadsChange: (items: RdDownload[]) => void;
  onTorrentsChange: (items: RdTorrent[]) => void;
  onRefresh: () => void;
  initialSection?: "active" | "ready";
};

export function LibraryPanel({
  token,
  downloads,
  torrents,
  query,
  onDownloadsChange,
  onTorrentsChange,
  onRefresh,
  initialSection = "active",
}: Props) {
  const [section, setSection] = useState<"active" | "ready">(initialSection);

  return (
    <section className="panel library-panel">
      <div className="panel-head">
        <div>
          <h2>Colección</h2>
          <p>
            En proceso = descargando. Listos = ya puedes abrir o copiar el
            enlace.
          </p>
        </div>
      </div>

      <div className="toolbar library-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={section === "active"}
          className={section === "active" ? "chip active" : "chip"}
          onClick={() => setSection("active")}
        >
          En proceso ({torrents.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={section === "ready"}
          className={section === "ready" ? "chip active" : "chip"}
          onClick={() => setSection("ready")}
        >
          Listos ({downloads.length})
        </button>
      </div>

      {section === "active" ? (
        <TorrentsPanel
          token={token}
          items={torrents}
          query={query}
          onChange={onTorrentsChange}
          onRefresh={onRefresh}
          embedded
        />
      ) : (
        <DownloadsPanel
          token={token}
          items={downloads}
          query={query}
          onChange={onDownloadsChange}
          embedded
        />
      )}
    </section>
  );
}
