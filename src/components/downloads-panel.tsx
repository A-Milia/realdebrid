"use client";

import { useMemo, useState } from "react";
import { useMediaMatches } from "@/hooks/use-media-matches";
import { formatBytes, formatDate } from "@/lib/format";
import type { MediaItem } from "@/lib/media";
import { rd } from "@/lib/rd-client";
import type { RdDownload } from "@/lib/types";
import { MediaCard, MediaDetail } from "./media-card";

type Props = {
  token: string;
  items: RdDownload[];
  query: string;
  onChange: (items: RdDownload[]) => void;
  embedded?: boolean;
};

export function DownloadsPanel({
  token,
  items,
  query,
  onChange,
  embedded = false,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [detail, setDetail] = useState<MediaItem | null>(null);
  const [view, setView] = useState<"posters" | "list">("posters");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (d) =>
        d.filename.toLowerCase().includes(q) ||
        d.host.toLowerCase().includes(q) ||
        d.id.toLowerCase().includes(q),
    );
  }, [items, query]);

  const matches = useMediaMatches(filtered.map((d) => d.filename));

  const posterItems = useMemo(() => {
    const map = new Map<string, { media: MediaItem; download: RdDownload }>();
    for (const d of filtered) {
      const m = matches[d.filename];
      if (!m?.poster) continue;
      const key = `${m.type}:${m.imdbId}`;
      if (!map.has(key)) map.set(key, { media: m, download: d });
    }
    return [...map.values()];
  }, [filtered, matches]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(filtered.map((d) => d.id)));
  }

  async function copyLink(url: string, id: string) {
    await navigator.clipboard.writeText(url);
    setCopied(id);
    setTimeout(() => setCopied(null), 1200);
  }

  async function removeOne(id: string) {
    setBusy(true);
    try {
      await rd.deleteDownload(token, id);
      onChange(items.filter((d) => d.id !== id));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } finally {
      setBusy(false);
    }
  }

  async function removeSelected() {
    if (!selected.size) return;
    setBusy(true);
    try {
      await Promise.all([...selected].map((id) => rd.deleteDownload(token, id)));
      onChange(items.filter((d) => !selected.has(d.id)));
      setSelected(new Set());
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={embedded ? "panel-embedded" : "panel"}>
      <div className="panel-head">
        <div>
          {!embedded && <h2>Listos</h2>}
          <p>
            {embedded
              ? `${filtered.length} archivos listos para abrir o copiar`
              : `${filtered.length} de ${items.length} · ${posterItems.length} con carátula`}
          </p>
        </div>
        <div className="row gap wrap">
          <button
            type="button"
            className={view === "posters" ? "chip active" : "chip"}
            onClick={() => setView("posters")}
          >
            Carátulas
          </button>
          <button
            type="button"
            className={view === "list" ? "chip active" : "chip"}
            onClick={() => setView("list")}
          >
            Lista
          </button>
          <button
            type="button"
            className="btn secondary compact"
            onClick={toggleAll}
            disabled={!filtered.length}
          >
            {selected.size === filtered.length && filtered.length
              ? "Quitar selección"
              : "Seleccionar todo"}
          </button>
          <button
            type="button"
            className="btn danger compact"
            disabled={!selected.size || busy}
            onClick={() => void removeSelected()}
          >
            Borrar ({selected.size})
          </button>
        </div>
      </div>

      {detail && (
        <MediaDetail item={detail} onClose={() => setDetail(null)} />
      )}

      {view === "posters" && (
        <div className="media-grid">
          {posterItems.map(({ media, download }) => (
            <MediaCard
              key={download.id}
              item={media}
              onClick={() => setDetail(media)}
              footer={
                <small className="cell-sub">
                  {formatBytes(download.filesize)} · {download.host}
                </small>
              }
            />
          ))}
          {!posterItems.length && (
            <p className="hint">
              Aún no hay carátulas coincidentes. Cambia a lista o espera a que se
              resuelvan los títulos.
            </p>
          )}
        </div>
      )}

      {view === "list" && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="check" />
                <th />
                <th>Archivo</th>
                <th>Host</th>
                <th>Tamaño</th>
                <th>Fecha</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const media = matches[item.filename];
                return (
                  <tr key={item.id} data-selected={selected.has(item.id)}>
                    <td className="check">
                      <input
                        type="checkbox"
                        checked={selected.has(item.id)}
                        onChange={() => toggle(item.id)}
                      />
                    </td>
                    <td>
                      <div
                        className="thumb"
                        style={{
                          backgroundImage: media?.poster
                            ? `url(${media.poster})`
                            : undefined,
                        }}
                        onClick={() => media && setDetail(media)}
                        role={media ? "button" : undefined}
                      />
                    </td>
                    <td>
                      <div className="cell-title">
                        {media?.name || item.filename}
                      </div>
                      <div className="cell-sub">
                        {media ? item.filename : item.id}
                      </div>
                    </td>
                    <td>
                      <span className="chip">{item.host}</span>
                    </td>
                    <td>{formatBytes(item.filesize)}</td>
                    <td>{formatDate(item.generated)}</td>
                    <td className="actions">
                      <button
                        type="button"
                        className="btn ghost compact"
                        onClick={() => void copyLink(item.download, item.id)}
                      >
                        {copied === item.id ? "Copiado" : "Copiar"}
                      </button>
                      <a
                        className="btn ghost compact"
                        href={item.download}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Abrir
                      </a>
                      <button
                        type="button"
                        className="btn ghost compact danger-text"
                        disabled={busy}
                        onClick={() => void removeOne(item.id)}
                      >
                        Borrar
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!filtered.length && (
                <tr>
                  <td colSpan={7} className="empty">
                    No hay archivos listos que coincidan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
