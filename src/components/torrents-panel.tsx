"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useMediaMatches } from "@/hooks/use-media-matches";
import {
  formatBytes,
  formatDate,
  torrentStatusLabel,
} from "@/lib/format";
import { rd } from "@/lib/rd-client";
import type { RdTorrent } from "@/lib/types";

type Props = {
  token: string;
  items: RdTorrent[];
  query: string;
  onChange: (items: RdTorrent[]) => void;
  onRefresh: () => void;
  embedded?: boolean;
};

type StatusFilter =
  | "all"
  | "downloaded"
  | "active"
  | "waiting"
  | "failed";

export function TorrentsPanel({
  token,
  items,
  query,
  onChange,
  onRefresh,
  embedded = false,
}: Props) {
  const [magnet, setMagnet] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<RdTorrent | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = items.filter((t) => {
      if (q) {
        const hay = `${t.filename} ${t.hash} ${t.status}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      switch (statusFilter) {
        case "downloaded":
          return t.status === "downloaded";
        case "active":
          return t.status === "downloading" || t.status === "queued";
        case "waiting":
          return t.status === "waiting_files_selection";
        case "failed":
          return (
            t.status === "error" ||
            t.status === "magnet_error" ||
            t.status === "dead" ||
            t.status === "virus"
          );
        default:
          return true;
      }
    });

    return [...list].sort(
      (a, b) => new Date(b.added).getTime() - new Date(a.added).getTime(),
    );
  }, [items, query, statusFilter]);

  const matches = useMediaMatches(filtered.map((t) => t.filename));

  async function addMagnet(e: React.FormEvent) {
    e.preventDefault();
    const value = magnet.trim();
    if (!value) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const created = await rd.addMagnet(token, value);
      let info: RdTorrent | null = null;
      try {
        info = await rd.getTorrent(token, created.id);
      } catch {
        setMessage("Añadido a En proceso");
        setMagnet("");
        onRefresh();
        return;
      }
      if (info.status === "waiting_files_selection") {
        setSelectedFiles(info);
        setPicked(new Set((info.files ?? []).map((f) => f.id)));
      } else {
        setMessage("Añadido a En proceso");
        onRefresh();
      }
      setMagnet("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo añadir");
    } finally {
      setBusy(false);
    }
  }

  async function confirmFiles() {
    if (!selectedFiles || !picked.size) return;
    setBusy(true);
    try {
      await rd.selectFiles(
        token,
        selectedFiles.id,
        [...picked].sort((a, b) => a - b).join(","),
      );
      setSelectedFiles(null);
      setMessage("Archivos guardados. Cuando termine, usa «Preparar enlace».");
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al seleccionar");
    } finally {
      setBusy(false);
    }
  }

  async function removeOne(id: string) {
    setBusyId(id);
    setError(null);
    const previous = items;
    onChange(items.filter((t) => t.id !== id));
    try {
      await rd.deleteTorrent(token, id);
      setMessage("Eliminado");
    } catch (err) {
      onChange(previous);
      setError(err instanceof Error ? err.message : "No se pudo borrar");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteFailed() {
    const failed = items.filter((t) =>
      ["error", "magnet_error", "dead", "virus"].includes(t.status),
    );
    if (!failed.length) {
      setMessage("No hay torrents fallidos");
      return;
    }
    setBusy(true);
    const ids = new Set(failed.map((t) => t.id));
    const previous = items;
    onChange(items.filter((t) => !ids.has(t.id)));
    try {
      await Promise.all(failed.map((t) => rd.deleteTorrent(token, t.id)));
      setMessage(`Limpiados ${failed.length} fallidos`);
    } catch (err) {
      onChange(previous);
      setError(err instanceof Error ? err.message : "No se pudo limpiar");
    } finally {
      setBusy(false);
    }
  }

  async function unrestrictLinks(torrent: RdTorrent) {
    if (!torrent.links?.length) return;
    setBusyId(torrent.id);
    setError(null);
    try {
      await Promise.all(torrent.links.map((link) => rd.unrestrict(token, link)));
      setMessage(
        `Listo: ${torrent.links.length} enlace(s) en la pestaña Listos.`,
      );
      onRefresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo preparar el enlace",
      );
    } finally {
      setBusyId(null);
    }
  }

  function toggleFile(id: number) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function openFilePicker(id: string) {
    setBusyId(id);
    try {
      const info = await rd.getTorrent(token, id);
      setSelectedFiles(info);
      setPicked(new Set((info.files ?? []).map((f) => f.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar archivos");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className={embedded ? "panel-embedded" : "panel"}>
      <div className="panel-head">
        <div>
          {!embedded && <h2>En proceso</h2>}
          <p>{filtered.length} de {items.length}</p>
        </div>
        <button
          type="button"
          className="btn secondary compact"
          disabled={busy}
          onClick={() => void deleteFailed()}
        >
          Limpiar fallidos
        </button>
      </div>

      <div className="toolbar">
        {(
          [
            ["all", "Todos"],
            ["active", "Activos"],
            ["downloaded", "Completados"],
            ["waiting", "Elegir archivos"],
            ["failed", "Fallidos"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={statusFilter === id ? "chip active" : "chip"}
            onClick={() => setStatusFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <form className="magnet-form" onSubmit={(e) => void addMagnet(e)}>
        <input
          value={magnet}
          onChange={(e) => setMagnet(e.target.value)}
          placeholder="Pega un magnet://…"
          spellCheck={false}
        />
        <button
          type="submit"
          className="btn primary"
          disabled={busy || !magnet.trim()}
        >
          Añadir
        </button>
      </form>

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
                <div className="item-title-row">
                  <strong className="item-title">
                    {media?.name || item.filename}
                  </strong>
                  <span className={`status status-${item.status}`}>
                    {torrentStatusLabel(item.status)}
                  </span>
                </div>
                {media?.name && (
                  <p className="item-sub">{item.filename}</p>
                )}
                <div className="item-meta">
                  <span>{formatBytes(item.bytes)}</span>
                  <span>{formatDate(item.added)}</span>
                </div>
                <div className="progress item-progress">
                  <div style={{ width: `${Math.min(100, item.progress)}%` }} />
                </div>
                <small className="item-progress-label">
                  {Math.round(item.progress)}%
                </small>
                <div className="item-actions">
                  {item.status === "downloaded" && !!item.links?.length && (
                    <button
                      type="button"
                      className="btn primary compact"
                      disabled={!!busyId}
                      onClick={() => void unrestrictLinks(item)}
                    >
                      {rowBusy ? "…" : "Preparar enlace"}
                    </button>
                  )}
                  {item.status === "waiting_files_selection" && (
                    <button
                      type="button"
                      className="btn secondary compact"
                      disabled={!!busyId}
                      onClick={() => void openFilePicker(item.id)}
                    >
                      Elegir archivos
                    </button>
                  )}
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
          <p className="hint">No hay nada en proceso que coincida.</p>
        )}
      </div>

      {selectedFiles &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="detail-modal file-pick-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Elige archivos"
          >
            <button
              type="button"
              className="detail-backdrop"
              aria-label="Cerrar"
              onClick={() => setSelectedFiles(null)}
            />
            <div className="detail-modal-panel">
              <div className="modal-card file-pick-card">
                <h3>Elige archivos</h3>
                <p className="hint">{selectedFiles.filename}</p>
                <div className="file-list">
                  {(selectedFiles.files ?? []).map((file) => (
                    <label key={file.id} className="file-row">
                      <input
                        type="checkbox"
                        checked={picked.has(file.id)}
                        onChange={() => toggleFile(file.id)}
                      />
                      <span>{file.path}</span>
                      <em>{formatBytes(file.bytes)}</em>
                    </label>
                  ))}
                </div>
                <div className="row gap">
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => setSelectedFiles(null)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn primary"
                    disabled={busy || !picked.size}
                    onClick={() => void confirmFiles()}
                  >
                    Confirmar
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </section>
  );
}
