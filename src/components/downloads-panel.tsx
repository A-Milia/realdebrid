"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useMediaMatches } from "@/hooks/use-media-matches";
import { formatBytes, formatDate } from "@/lib/format";
import type { MediaItem } from "@/lib/media";
import { rd } from "@/lib/rd-client";
import { cleanTitle } from "@/lib/title";
import type { RdDownload } from "@/lib/types";
import { titleSimilarity, parseRelease } from "@/lib/media";

type Props = {
  token: string;
  items: RdDownload[];
  query: string;
  onChange: (items: RdDownload[]) => void;
  embedded?: boolean;
};

type DownloadGroup = {
  key: string;
  title: string;
  media?: MediaItem | null;
  downloads: RdDownload[];
};

export function DownloadsPanel({
  token,
  items,
  query,
  onChange,
  embedded = false,
}: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openGroup, setOpenGroup] = useState<DownloadGroup | null>(null);

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

  const groups = useMemo(() => {
    const map = new Map<string, DownloadGroup>();
    for (const d of filtered) {
      const key = `file:${cleanTitle(d.filename) || d.id}`;
      const media = matches[d.filename];
      const existing = map.get(key);
      if (existing) {
        existing.downloads.push(d);
      } else {
        const parsed = parseRelease(d.filename);
        const ok =
          media &&
          titleSimilarity(parsed.query || cleanTitle(d.filename), media.name) >=
            0.34;
        map.set(key, {
          key,
          title: ok ? media.name : parsed.query || d.filename,
          media: ok ? media : null,
          downloads: [d],
        });
      }
    }
    return [...map.values()];
  }, [filtered, matches]);

  async function copyLink(url: string, id: string) {
    await navigator.clipboard.writeText(url);
    setCopied(id);
    setTimeout(() => setCopied(null), 1200);
  }

  async function removeOne(id: string) {
    setBusyId(id);
    setError(null);
    const previous = items;
    onChange(items.filter((d) => d.id !== id));
    setOpenGroup((g) =>
      g ? { ...g, downloads: g.downloads.filter((d) => d.id !== id) } : g,
    );
    try {
      await rd.deleteDownload(token, id);
      setMessage("Eliminado");
      setOpenGroup((g) => (g && g.downloads.length === 0 ? null : g));
    } catch (err) {
      onChange(previous);
      setError(err instanceof Error ? err.message : "No se pudo borrar");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className={embedded ? "panel-embedded" : "panel"}>
      <div className="panel-head">
        <div>
          {!embedded && <h2>Listos</h2>}
          <p>
            {groups.length} título{groups.length === 1 ? "" : "s"} ·{" "}
            {filtered.length} archivo{filtered.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      {message && <p className="banner ok">{message}</p>}
      {error && <p className="banner error">{error}</p>}

      <div className="item-stack">
        {groups.map((group) => {
          const first = group.downloads[0];
          return (
            <button
              key={group.key}
              type="button"
              className="item-card item-card-btn"
              onClick={() => setOpenGroup(group)}
            >
              <div
                className="item-poster"
                style={{
                  backgroundImage: group.media?.poster
                    ? `url(${group.media.poster})`
                    : undefined,
                }}
              />
              <div className="item-body">
                <div className="item-title-row">
                  <strong className="item-title">{group.title}</strong>
                  <span className="link-count">
                    {group.downloads.length} archivo
                    {group.downloads.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="item-meta">
                  <span className="chip">{first.host}</span>
                  <span>{formatBytes(first.filesize)}</span>
                </div>
                <small className="item-progress-label">
                  Toca para copiar o abrir
                </small>
              </div>
            </button>
          );
        })}
        {!groups.length && (
          <p className="hint">No hay archivos listos que coincidan.</p>
        )}
      </div>

      {openGroup &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="detail-modal" role="dialog" aria-modal="true">
            <button
              type="button"
              className="detail-backdrop"
              aria-label="Cerrar"
              onClick={() => setOpenGroup(null)}
            />
            <div className="detail-modal-panel">
              <div className="sheet-scroll">
                <header className="sheet-top">
                  <div className="sheet-top-copy">
                    <p className="detail-kicker">Archivos listos</p>
                    <h3>{openGroup.title}</h3>
                    <p className="detail-sub">
                      {openGroup.downloads.length} archivo
                      {openGroup.downloads.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="detail-close"
                    onClick={() => setOpenGroup(null)}
                    aria-label="Cerrar"
                  >
                    <span aria-hidden>×</span>
                  </button>
                </header>
                <div className="sheet-body">
                  <div className="torrent-list">
                    {openGroup.downloads.map((item) => (
                      <div key={item.id} className="torrent-row">
                        <div className="torrent-copy">
                          <strong>{item.filename}</strong>
                          <small>
                            {item.host} · {formatBytes(item.filesize)} ·{" "}
                            {formatDate(item.generated)}
                          </small>
                        </div>
                        <div className="item-actions">
                          <button
                            type="button"
                            className="btn secondary compact"
                            onClick={() => void copyLink(item.download, item.id)}
                          >
                            {copied === item.id ? "Copiado" : "Copiar"}
                          </button>
                          <a
                            className="btn primary compact"
                            href={item.download}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Abrir
                          </a>
                          <button
                            type="button"
                            className="btn ghost compact danger-text"
                            disabled={!!busyId}
                            onClick={() => void removeOne(item.id)}
                          >
                            Borrar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </section>
  );
}
