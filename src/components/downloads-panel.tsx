"use client";

import { useMemo, useState } from "react";
import { useMediaMatches } from "@/hooks/use-media-matches";
import { formatBytes, formatDate } from "@/lib/format";
import { rd } from "@/lib/rd-client";
import type { RdDownload } from "@/lib/types";

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
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    try {
      await rd.deleteDownload(token, id);
      setMessage("Eliminado");
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
            {filtered.length} archivo{filtered.length === 1 ? "" : "s"} para
            abrir o copiar
          </p>
        </div>
      </div>

      {message && <p className="banner ok">{message}</p>}
      {error && <p className="banner error">{error}</p>}

      <div className="item-stack">
        {filtered.map((item) => {
          const media = matches[item.filename];
          const rowBusy = busyId === item.id;
          return (
            <article key={item.id} className="item-card">
              <div
                className="item-poster"
                style={{
                  backgroundImage: media?.poster
                    ? `url(${media.poster})`
                    : undefined,
                }}
              />
              <div className="item-body">
                <strong className="item-title">
                  {media?.name || item.filename}
                </strong>
                {media?.name && <p className="item-sub">{item.filename}</p>}
                <div className="item-meta">
                  <span className="chip">{item.host}</span>
                  <span>{formatBytes(item.filesize)}</span>
                  <span>{formatDate(item.generated)}</span>
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
                    {rowBusy ? "…" : "Borrar"}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
        {!filtered.length && (
          <p className="hint">No hay archivos listos que coincidan.</p>
        )}
      </div>
    </section>
  );
}
