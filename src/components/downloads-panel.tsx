"use client";

import { useMemo, useState } from "react";
import { formatBytes, formatDate } from "@/lib/format";
import { rd } from "@/lib/rd-client";
import type { RdDownload } from "@/lib/types";

type Props = {
  token: string;
  items: RdDownload[];
  query: string;
  onChange: (items: RdDownload[]) => void;
};

export function DownloadsPanel({ token, items, query, onChange }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

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
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Descargas</h2>
          <p>{filtered.length} de {items.length} en tu historial</p>
        </div>
        <div className="row gap">
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

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="check" />
              <th>Archivo</th>
              <th>Host</th>
              <th>Tamaño</th>
              <th>Fecha</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.id} data-selected={selected.has(item.id)}>
                <td className="check">
                  <input
                    type="checkbox"
                    checked={selected.has(item.id)}
                    onChange={() => toggle(item.id)}
                  />
                </td>
                <td>
                  <div className="cell-title">{item.filename}</div>
                  <div className="cell-sub">{item.id}</div>
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
                  <a className="btn ghost compact" href={item.download} target="_blank" rel="noreferrer">
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
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={6} className="empty">
                  No hay descargas que coincidan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
