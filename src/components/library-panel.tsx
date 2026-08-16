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

  const activeCount = torrents.length;
  const readyCount = downloads.length;

  return (
    <section className="panel library-panel">
      <div className="panel-head">
        <div>
          <h2>Colección</h2>
          <p>
            Todo lo que añades desde Buscar llega aquí. Primero se prepara y
            después queda listo para abrir o copiar el enlace.
          </p>
        </div>
      </div>

      <div className="library-explain">
        <div>
          <strong>En proceso</strong>
          <span>Torrents que Real-Debrid está descargando o preparando.</span>
        </div>
        <div>
          <strong>Listos</strong>
          <span>Archivos ya disponibles para copiar el enlace o abrirlos.</span>
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
          En proceso ({activeCount})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={section === "ready"}
          className={section === "ready" ? "chip active" : "chip"}
          onClick={() => setSection("ready")}
        >
          Listos ({readyCount})
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
