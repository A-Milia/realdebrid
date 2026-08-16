"use client";

import { useState } from "react";
import { magnetFromHash, type MediaItem, type TorrentCandidate } from "@/lib/media";
import { rd } from "@/lib/rd-client";
import { MediaCard, MediaDetail } from "./media-card";

type Props = {
  token: string;
  onAdded: () => void;
};

export function SearchPanel({ token, onAdded }: Props) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | "movie" | "series">("all");
  const [results, setResults] = useState<MediaItem[]>([]);
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [torrents, setTorrents] = useState<TorrentCandidate[]>([]);
  const [season, setSeason] = useState(1);
  const [episode, setEpisode] = useState(1);
  const [busy, setBusy] = useState(false);
  const [loadingTorrents, setLoadingTorrents] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [filePick, setFilePick] = useState<{
    id: string;
    files: Array<{ id: number; path: string; bytes: number }>;
  } | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [tmdbEnabled, setTmdbEnabled] = useState<boolean | null>(null);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 2) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    setSelected(null);
    setTorrents([]);
    try {
      const res = await fetch(
        `/api/search/media?q=${encodeURIComponent(q)}&type=${kind}`,
      );
      const data = (await res.json()) as {
        results?: MediaItem[];
        error?: string;
        providers?: { tmdbEnabled?: boolean };
      };
      if (!res.ok) throw new Error(data.error || "Error de búsqueda");
      setResults(data.results ?? []);
      if (typeof data.providers?.tmdbEnabled === "boolean") {
        setTmdbEnabled(data.providers.tmdbEnabled);
      }
      if (!(data.results ?? []).length) setMessage("Sin resultados");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function loadTorrents(item: MediaItem, s = season, ep = episode) {
    setSelected(item);
    setLoadingTorrents(true);
    setError(null);
    setTorrents([]);
    try {
      const params = new URLSearchParams({
        imdbId: item.imdbId,
        type: item.type,
      });
      if (item.type === "series") {
        params.set("season", String(s));
        params.set("episode", String(ep));
      }
      const res = await fetch(`/api/search/torrents?${params}`);
      const data = (await res.json()) as {
        torrents?: TorrentCandidate[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "No se pudieron cargar torrents");
      setTorrents(data.torrents ?? []);
      if (!(data.torrents ?? []).length) {
        setMessage("No hay torrents para este título");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoadingTorrents(false);
    }
  }

  async function addTorrent(t: TorrentCandidate) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const magnet = magnetFromHash(t.infoHash, t.title);
      const created = await rd.addMagnet(token, magnet);
      const info = await rd.getTorrent(token, created.id);
      if (info.status === "waiting_files_selection" && info.files?.length) {
        setFilePick({
          id: info.id,
          files: info.files.map((f) => ({
            id: f.id,
            path: f.path,
            bytes: f.bytes,
          })),
        });
        setPicked(new Set(info.files.map((f) => f.id)));
        setMessage("Elige archivos para empezar la descarga en Real-Debrid");
      } else {
        setMessage(`Añadido a Real-Debrid: ${info.filename || t.title}`);
        onAdded();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo añadir");
    } finally {
      setBusy(false);
    }
  }

  async function confirmFiles() {
    if (!filePick || !picked.size) return;
    setBusy(true);
    try {
      await rd.selectFiles(
        token,
        filePick.id,
        [...picked].sort((a, b) => a - b).join(","),
      );
      setFilePick(null);
      setMessage("Archivos seleccionados — aparece en tu biblioteca");
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al seleccionar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Buscar y añadir</h2>
          <p>
            Busca películas o series, elige un torrent y se añade a tu Real-Debrid.
            {tmdbEnabled === true && " TMDB activo en el servidor."}
            {tmdbEnabled === false &&
              " Carátulas vía Cinemeta (TMDB no configurado en Vercel)."}
          </p>
        </div>
      </div>

      <form className="search-form" onSubmit={(e) => void search(e)}>
        <div className="toolbar">
          {(
            [
              ["all", "Todo"],
              ["movie", "Películas"],
              ["series", "Series"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={kind === id ? "chip active" : "chip"}
              onClick={() => setKind(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="magnet-form">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ej. Matrix, Breaking Bad…"
            autoFocus
          />
          <button type="submit" className="btn primary" disabled={busy || query.trim().length < 2}>
            {busy ? "Buscando…" : "Buscar"}
          </button>
        </div>
      </form>

      {error && <p className="banner error">{error}</p>}
      {message && <p className="banner ok">{message}</p>}

      {!!results.length && (
        <div className="media-grid">
          {results.map((item) => (
            <MediaCard
              key={`${item.type}-${item.imdbId}`}
              item={item}
              selected={selected?.imdbId === item.imdbId && selected.type === item.type}
              onClick={() => void loadTorrents(item)}
            />
          ))}
        </div>
      )}

      {selected && (
        <MediaDetail item={selected} onClose={() => setSelected(null)}>
          {selected.type === "series" && (
            <div className="row gap wrap" style={{ margin: "0.8rem 0" }}>
              <label className="inline-field">
                Temporada
                <input
                  type="number"
                  min={1}
                  value={season}
                  onChange={(e) => setSeason(Number(e.target.value) || 1)}
                />
              </label>
              <label className="inline-field">
                Episodio
                <input
                  type="number"
                  min={1}
                  value={episode}
                  onChange={(e) => setEpisode(Number(e.target.value) || 1)}
                />
              </label>
              <button
                type="button"
                className="btn secondary compact"
                onClick={() => void loadTorrents(selected, season, episode)}
              >
                Actualizar torrents
              </button>
            </div>
          )}

          {loadingTorrents ? (
            <p className="hint">Cargando torrents…</p>
          ) : (
            <div className="torrent-list">
              {torrents.map((t) => (
                <div key={t.infoHash} className="torrent-row">
                  <div>
                    <strong>{t.title}</strong>
                    <small>
                      {[t.quality, t.size, t.seeds ? `${t.seeds} seeds` : null, t.source]
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                  </div>
                  <button
                    type="button"
                    className="btn primary compact"
                    disabled={busy}
                    onClick={() => void addTorrent(t)}
                  >
                    Añadir a RD
                  </button>
                </div>
              ))}
              {!torrents.length && !loadingTorrents && (
                <p className="hint">No hay resultados de torrent.</p>
              )}
            </div>
          )}
        </MediaDetail>
      )}

      {filePick && (
        <div className="modal-card">
          <h3>Selecciona archivos</h3>
          <div className="file-list">
            {filePick.files.map((f) => (
              <label key={f.id} className="file-row">
                <input
                  type="checkbox"
                  checked={picked.has(f.id)}
                  onChange={() =>
                    setPicked((prev) => {
                      const next = new Set(prev);
                      if (next.has(f.id)) next.delete(f.id);
                      else next.add(f.id);
                      return next;
                    })
                  }
                />
                <span>{f.path}</span>
              </label>
            ))}
          </div>
          <div className="row gap">
            <button type="button" className="btn secondary" onClick={() => setFilePick(null)}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn primary"
              disabled={!picked.size || busy}
              onClick={() => void confirmFiles()}
            >
              Confirmar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
