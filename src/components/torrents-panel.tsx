"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useMediaMatches } from "@/hooks/use-media-matches";
import {
  formatBytes,
  formatDate,
  torrentStatusLabel,
} from "@/lib/format";
import type { MediaItem } from "@/lib/media";
import { rd } from "@/lib/rd-client";
import { cleanTitle } from "@/lib/title";
import type { RdTorrent } from "@/lib/types";
import { titleSimilarity, parseRelease } from "@/lib/media";

type Props = {
  token: string;
  items: RdTorrent[];
  query: string;
  onChange: (items: RdTorrent[]) => void;
  onRefresh: () => void;
  embedded?: boolean;
};

type StatusFilter = "all" | "downloaded" | "active" | "waiting" | "failed";

type TorrentGroup = {
  key: string;
  title: string;
  media?: MediaItem | null;
  torrents: RdTorrent[];
};

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
  const [openGroup, setOpenGroup] = useState<TorrentGroup | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((t) => {
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
            return ["error", "magnet_error", "dead", "virus"].includes(t.status);
          default:
            return true;
        }
      })
      .sort(
        (a, b) => new Date(b.added).getTime() - new Date(a.added).getTime(),
      );
  }, [items, query, statusFilter]);

  const matches = useMediaMatches(filtered.map((t) => t.filename));

  const groups = useMemo(() => {
    const map = new Map<string, TorrentGroup>();
    for (const t of filtered) {
      // Clave estable por nombre limpio (nunca mezclar títulos distintos)
      const key = `file:${cleanTitle(t.filename) || t.id}`;
      const media = matches[t.filename];
      const existing = map.get(key);
      if (existing) {
        existing.torrents.push(t);
      } else {
        // Solo usar metadata si el nombre encaja de verdad
        const parsed = parseRelease(t.filename);
        const ok =
          media &&
          titleSimilarity(parsed.query || cleanTitle(t.filename), media.name) >=
            0.34;
        map.set(key, {
          key,
          title: ok ? media.name : parsed.query || t.filename,
          media: ok ? media : null,
          torrents: [t],
        });
      }
    }
    return [...map.values()];
  }, [filtered, matches]);

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
        setMessage("Añadido");
        setMagnet("");
        onRefresh();
        return;
      }
      if (info.status === "waiting_files_selection") {
        setSelectedFiles(info);
        setPicked(new Set((info.files ?? []).map((f) => f.id)));
      } else {
        setMessage("Añadido");
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
      setMessage("Archivos guardados");
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
    const next = items.filter((t) => t.id !== id);
    onChange(next);
    setOpenGroup((g) =>
      g
        ? {
            ...g,
            torrents: g.torrents.filter((t) => t.id !== id),
          }
        : g,
    );
    try {
      await rd.deleteTorrent(token, id);
      setMessage("Eliminado");
      setOpenGroup((g) => (g && g.torrents.length === 0 ? null : g));
    } catch (err) {
      // Reconciliar: si en servidor ya no está, mantener borrado local.
      try {
        await rd.getTorrent(token, id);
        onChange(previous);
        setError(err instanceof Error ? err.message : "No se pudo borrar");
      } catch {
        setMessage("Eliminado");
        setOpenGroup((g) => (g && g.torrents.length === 0 ? null : g));
      }
    } finally {
      setBusyId(null);
    }
  }

  async function removeGroup(group: TorrentGroup) {
    setBusy(true);
    setError(null);
    const ids = new Set(group.torrents.map((t) => t.id));
    const previous = items;
    onChange(items.filter((t) => !ids.has(t.id)));
    setOpenGroup(null);
    try {
      await Promise.all(group.torrents.map((t) => rd.deleteTorrent(token, t.id)));
      setMessage(`Eliminados ${group.torrents.length}`);
    } catch {
      onRefresh();
      setMessage("Lista actualizada");
    } finally {
      setBusy(false);
      void previous;
    }
  }

  async function unrestrictLinks(torrent: RdTorrent) {
    if (!torrent.links?.length) return;
    setBusyId(torrent.id);
    setError(null);
    try {
      await Promise.all(torrent.links.map((link) => rd.unrestrict(token, link)));
      setMessage("Enlace(s) listos en la pestaña Listos");
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo preparar");
    } finally {
      setBusyId(null);
    }
  }

  async function openFilePicker(id: string) {
    setBusyId(id);
    try {
      const info = await rd.getTorrent(token, id);
      setSelectedFiles(info);
      setPicked(new Set((info.files ?? []).map((f) => f.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar archivos");
    } finally {
      setBusyId(null);
    }
  }

  function groupStatus(group: TorrentGroup) {
    if (group.torrents.some((t) => t.status === "downloaded")) return "downloaded";
    if (group.torrents.some((t) => t.status === "downloading" || t.status === "queued"))
      return "downloading";
    if (group.torrents.some((t) => t.status === "waiting_files_selection"))
      return "waiting_files_selection";
    return group.torrents[0]?.status || "error";
  }

  return (
    <section className={embedded ? "panel-embedded" : "panel"}>
      <div className="panel-head">
        <div>
          {!embedded && <h2>En proceso</h2>}
          <p>
            {groups.length} título{groups.length === 1 ? "" : "s"} ·{" "}
            {filtered.length} enlace{filtered.length === 1 ? "" : "s"}
          </p>
        </div>
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
        {groups.map((group) => {
          const status = groupStatus(group);
          const latest = group.torrents[0];
          const progress = Math.round(
            group.torrents.reduce((s, t) => s + t.progress, 0) /
              group.torrents.length,
          );
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
                    {group.torrents.length} enlace
                    {group.torrents.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="item-meta">
                  <span className={`status status-${status}`}>
                    {torrentStatusLabel(status)}
                  </span>
                  <span>{formatBytes(latest.bytes)}</span>
                </div>
                <div className="progress item-progress">
                  <div style={{ width: `${Math.min(100, progress)}%` }} />
                </div>
                <small className="item-progress-label">
                  Toca para ver todos los enlaces · {progress}%
                </small>
              </div>
            </button>
          );
        })}
        {!groups.length && (
          <p className="hint">No hay nada en proceso que coincida.</p>
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
                    <p className="detail-kicker">Enlaces del título</p>
                    <h3>{openGroup.title}</h3>
                    <p className="detail-sub">
                      {openGroup.torrents.length} enlace
                      {openGroup.torrents.length === 1 ? "" : "s"} en Real-Debrid
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
                  <div className="sheet-media-row">
                    <div
                      className="detail-poster"
                      style={{
                        backgroundImage: openGroup.media?.poster
                          ? `url(${openGroup.media.poster})`
                          : undefined,
                      }}
                    />
                    {openGroup.media?.description ? (
                      <p className="detail-desc sheet-desc">
                        {openGroup.media.description}
                      </p>
                    ) : (
                      <p className="hint">
                        Elige un enlace para preparar o borrar.
                      </p>
                    )}
                  </div>

                  <div className="torrent-list">
                    {openGroup.torrents.map((item) => (
                      <div key={item.id} className="torrent-row">
                        <div className="torrent-copy">
                          <strong>{item.filename}</strong>
                          <small>
                            {torrentStatusLabel(item.status)} ·{" "}
                            {formatBytes(item.bytes)} · {formatDate(item.added)} ·{" "}
                            {Math.round(item.progress)}%
                          </small>
                        </div>
                        <div className="item-actions">
                          {item.status === "downloaded" && !!item.links?.length && (
                            <button
                              type="button"
                              className="btn primary compact"
                              disabled={!!busyId}
                              onClick={() => void unrestrictLinks(item)}
                            >
                              {busyId === item.id ? "…" : "Preparar"}
                            </button>
                          )}
                          {item.status === "waiting_files_selection" && (
                            <button
                              type="button"
                              className="btn secondary compact"
                              disabled={!!busyId}
                              onClick={() => void openFilePicker(item.id)}
                            >
                              Archivos
                            </button>
                          )}
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

                  <button
                    type="button"
                    className="btn danger"
                    style={{ width: "100%", marginTop: "0.85rem" }}
                    disabled={busy}
                    onClick={() => void removeGroup(openGroup)}
                  >
                    Borrar todos los enlaces
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {selectedFiles &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="detail-modal file-pick-modal" role="dialog" aria-modal="true">
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
                        onChange={() =>
                          setPicked((prev) => {
                            const next = new Set(prev);
                            if (next.has(file.id)) next.delete(file.id);
                            else next.add(file.id);
                            return next;
                          })
                        }
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
