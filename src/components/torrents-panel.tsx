"use client";

import { useMemo, useState } from "react";
import {
  formatBytes,
  formatDate,
  torrentStatusLabel,
} from "@/lib/format";
import { rd } from "@/lib/rd-client";
import { cleanTitle } from "@/lib/title";
import type { RdTorrent } from "@/lib/types";

type Props = {
  token: string;
  items: RdTorrent[];
  query: string;
  onChange: (items: RdTorrent[]) => void;
  onRefresh: () => void;
};

type SortKey = "added" | "filename" | "bytes" | "progress" | "status";
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
}: Props) {
  const [magnet, setMagnet] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<RdTorrent | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("added");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [groupDupes, setGroupDupes] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

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

    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "filename") cmp = a.filename.localeCompare(b.filename);
      else if (sortKey === "bytes") cmp = a.bytes - b.bytes;
      else if (sortKey === "progress") cmp = a.progress - b.progress;
      else if (sortKey === "status") cmp = a.status.localeCompare(b.status);
      else cmp = new Date(a.added).getTime() - new Date(b.added).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });

    if (groupDupes) {
      const seen = new Set<string>();
      const dupes: RdTorrent[] = [];
      for (const t of list) {
        const key = cleanTitle(t.filename);
        if (seen.has(key)) dupes.push(t);
        else seen.add(key);
      }
      return dupes;
    }

    return list;
  }, [items, query, statusFilter, sortKey, sortDir, groupDupes]);

  async function addMagnet(e: React.FormEvent) {
    e.preventDefault();
    const value = magnet.trim();
    if (!value) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const created = await rd.addMagnet(token, value);
      const info = await rd.getTorrent(token, created.id);
      if (info.status === "waiting_files_selection") {
        setSelectedFiles(info);
        setPicked(new Set((info.files ?? []).map((f) => f.id)));
      } else {
        setMessage("Torrent añadido");
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
      setMessage("Archivos seleccionados");
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al seleccionar");
    } finally {
      setBusy(false);
    }
  }

  async function removeOne(id: string) {
    setBusy(true);
    try {
      await rd.deleteTorrent(token, id);
      onChange(items.filter((t) => t.id !== id));
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
      await Promise.all([...selected].map((id) => rd.deleteTorrent(token, id)));
      onChange(items.filter((t) => !selected.has(t.id)));
      setSelected(new Set());
      setMessage(`Eliminados ${selected.size}`);
    } finally {
      setBusy(false);
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
    try {
      await Promise.all(failed.map((t) => rd.deleteTorrent(token, t.id)));
      const ids = new Set(failed.map((t) => t.id));
      onChange(items.filter((t) => !ids.has(t.id)));
      setMessage(`Limpiados ${failed.length} fallidos`);
    } finally {
      setBusy(false);
    }
  }

  async function unrestrictLinks(torrent: RdTorrent) {
    if (!torrent.links?.length) return;
    setBusy(true);
    setError(null);
    try {
      await Promise.all(torrent.links.map((link) => rd.unrestrict(token, link)));
      setMessage(`Desbloqueados ${torrent.links.length} enlaces`);
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al unrestrict");
    } finally {
      setBusy(false);
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

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "filename" || key === "status" ? "asc" : "desc");
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Torrents</h2>
          <p>
            {filtered.length} de {items.length}
          </p>
        </div>
        <div className="row gap wrap">
          <button
            type="button"
            className="btn secondary compact"
            disabled={busy}
            onClick={() => void deleteFailed()}
          >
            Limpiar fallidos
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

      <div className="toolbar">
        {(
          [
            ["all", "Todos"],
            ["downloaded", "Listos"],
            ["active", "Activos"],
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
        <button
          type="button"
          className={groupDupes ? "chip active" : "chip"}
          onClick={() => setGroupDupes((v) => !v)}
        >
          Solo duplicados
        </button>
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

      {selectedFiles && (
        <div className="modal-card">
          <h3>Selecciona archivos</h3>
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
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="check" />
              <th>
                <button type="button" className="th-btn" onClick={() => toggleSort("filename")}>
                  Torrent
                </button>
              </th>
              <th>
                <button type="button" className="th-btn" onClick={() => toggleSort("status")}>
                  Estado
                </button>
              </th>
              <th>
                <button type="button" className="th-btn" onClick={() => toggleSort("progress")}>
                  Progreso
                </button>
              </th>
              <th>
                <button type="button" className="th-btn" onClick={() => toggleSort("bytes")}>
                  Tamaño
                </button>
              </th>
              <th>
                <button type="button" className="th-btn" onClick={() => toggleSort("added")}>
                  Añadido
                </button>
              </th>
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
                    onChange={() =>
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (next.has(item.id)) next.delete(item.id);
                        else next.add(item.id);
                        return next;
                      })
                    }
                  />
                </td>
                <td>
                  <div className="cell-title">{item.filename}</div>
                  <div className="cell-sub mono">{item.hash.slice(0, 12)}…</div>
                </td>
                <td>
                  <span className={`status status-${item.status}`}>
                    {torrentStatusLabel(item.status)}
                  </span>
                </td>
                <td>
                  <div className="progress">
                    <div style={{ width: `${Math.min(100, item.progress)}%` }} />
                  </div>
                  <small>{Math.round(item.progress)}%</small>
                </td>
                <td>{formatBytes(item.bytes)}</td>
                <td>{formatDate(item.added)}</td>
                <td className="actions">
                  {item.status === "downloaded" && !!item.links?.length && (
                    <button
                      type="button"
                      className="btn ghost compact"
                      disabled={busy}
                      onClick={() => void unrestrictLinks(item)}
                    >
                      Unrestrict
                    </button>
                  )}
                  {item.status === "waiting_files_selection" && (
                    <button
                      type="button"
                      className="btn ghost compact"
                      onClick={() => {
                        void rd.getTorrent(token, item.id).then((info) => {
                          setSelectedFiles(info);
                          setPicked(new Set((info.files ?? []).map((f) => f.id)));
                        });
                      }}
                    >
                      Archivos
                    </button>
                  )}
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
                <td colSpan={7} className="empty">
                  No hay torrents que coincidan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
