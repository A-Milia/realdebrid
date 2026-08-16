"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  magnetFromHash,
  type MediaItem,
  type TorrentCandidate,
} from "@/lib/media";
import { rd } from "@/lib/rd-client";
import { MediaCard, MediaDetail } from "./media-card";

type Props = {
  token: string;
  onAdded: () => void;
  onGoLibrary?: () => void;
};

const CLIENT_CACHE = "rd.search.v1";

function readClientCache(key: string): MediaItem[] | null {
  try {
    const raw = sessionStorage.getItem(CLIENT_CACHE);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<
      string,
      { at: number; results: MediaItem[] }
    >;
    const hit = map[key];
    if (!hit) return null;
    if (Date.now() - hit.at > 30 * 60 * 1000) return null;
    return hit.results;
  } catch {
    return null;
  }
}

function writeClientCache(key: string, results: MediaItem[]) {
  try {
    const raw = sessionStorage.getItem(CLIENT_CACHE);
    const map = raw
      ? (JSON.parse(raw) as Record<string, { at: number; results: MediaItem[] }>)
      : {};
    map[key] = { at: Date.now(), results };
    const keys = Object.keys(map);
    if (keys.length > 40) {
      keys
        .sort((a, b) => map[a].at - map[b].at)
        .slice(0, keys.length - 40)
        .forEach((k) => delete map[k]);
    }
    sessionStorage.setItem(CLIENT_CACHE, JSON.stringify(map));
  } catch {
    // ignore quota
  }
}

export function SearchPanel({ token, onAdded, onGoLibrary }: Props) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | "movie" | "series">("all");
  const [results, setResults] = useState<MediaItem[]>([]);
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [torrents, setTorrents] = useState<TorrentCandidate[]>([]);
  const [season, setSeason] = useState(1);
  const [episode, setEpisode] = useState(1);
  const [busy, setBusy] = useState(false);
  const [addingHash, setAddingHash] = useState<string | null>(null);
  const [loadingTorrents, setLoadingTorrents] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [filePick, setFilePick] = useState<{
    id: string;
    files: Array<{ id: number; path: string; bytes: number }>;
  } | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [tmdbEnabled, setTmdbEnabled] = useState<boolean | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);

  const abortSearch = useRef<AbortController | null>(null);
  const abortTorrents = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqId = useRef(0);

  const runSearch = useCallback(
    async (raw: string, mediaType: typeof kind, fromSubmit = false) => {
      const q = raw.trim();
      if (q.length < 2) {
        setResults([]);
        setBusy(false);
        return;
      }

      const cacheKey = `${mediaType}:${q.toLowerCase()}`;
      const cached = readClientCache(cacheKey);
      if (cached?.length) {
        setResults(cached);
        setBusy(false);
        setElapsedMs(0);
      } else {
        setBusy(true);
      }

      abortSearch.current?.abort();
      const ctrl = new AbortController();
      abortSearch.current = ctrl;
      const id = ++reqId.current;
      const started = performance.now();
      setError(null);
      if (fromSubmit) setMessage(null);

      try {
        const res = await fetch(
          `/api/search/media?q=${encodeURIComponent(q)}&type=${mediaType}`,
          { signal: ctrl.signal },
        );
        const data = (await res.json()) as {
          results?: MediaItem[];
          error?: string;
          providers?: { tmdbEnabled?: boolean };
        };
        if (id !== reqId.current) return;
        if (!res.ok) throw new Error(data.error || "Error de búsqueda");
        const next = data.results ?? [];
        setResults(next);
        writeClientCache(cacheKey, next);
        setElapsedMs(Math.round(performance.now() - started));
        if (typeof data.providers?.tmdbEnabled === "boolean") {
          setTmdbEnabled(data.providers.tmdbEnabled);
        }
        if (!next.length) setMessage("Sin resultados");
      } catch (err) {
        if (ctrl.signal.aborted) return;
        if (id !== reqId.current) return;
        setError(err instanceof Error ? err.message : "Error");
      } finally {
        if (id === reqId.current) setBusy(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setElapsedMs(null);
      return;
    }
    debounceRef.current = setTimeout(() => {
      void runSearch(q, kind);
    }, 280);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, kind, runSearch]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSelected(null);
    setTorrents([]);
    await runSearch(query, kind, true);
  }

  async function loadTorrents(item: MediaItem, s = season, ep = episode) {
    if (!item.imdbId.startsWith("tt")) {
      setError("Este resultado no tiene IMDB; elige otra carátula.");
      return;
    }
    setSelected(item);
    setLoadingTorrents(true);
    setError(null);
    setMessage(null);
    setTorrents([]);
    abortTorrents.current?.abort();
    const ctrl = new AbortController();
    abortTorrents.current = ctrl;

    try {
      const params = new URLSearchParams({
        imdbId: item.imdbId,
        type: item.type,
      });
      if (item.type === "series") {
        params.set("season", String(s));
        params.set("episode", String(ep));
      }
      const res = await fetch(`/api/search/torrents?${params}`, {
        signal: ctrl.signal,
      });
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
      if (ctrl.signal.aborted) return;
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoadingTorrents(false);
    }
  }

  async function addTorrent(t: TorrentCandidate) {
    setAddingHash(t.infoHash);
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const magnet = magnetFromHash(t.infoHash, t.title);
      const created = await rd.addMagnet(token, magnet);
      let info: Awaited<ReturnType<typeof rd.getTorrent>> | null = null;
      try {
        info = await rd.getTorrent(token, created.id);
      } catch {
        // El magnet ya está en RD; a veces /info falla un momento.
        setMessage("Añadido a tu colección. Aparecerá en «En proceso».");
        onAdded();
        return;
      }
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
        setMessage("Elige qué archivos quieres guardar");
      } else {
        setMessage("Añadido a tu colección. Aparecerá en «En proceso».");
        onAdded();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo añadir");
    } finally {
      setBusy(false);
      setAddingHash(null);
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
      setMessage("Guardado. Lo verás en Colección → En proceso.");
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al seleccionar");
    } finally {
      setBusy(false);
    }
  }

  function closeDetail() {
    setSelected(null);
    setTorrents([]);
    setFilePick(null);
    setMessage(null);
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Buscar</h2>
          <p>
            Elige una película o serie. Se abre con los enlaces para añadirla.
            {elapsedMs != null && elapsedMs > 0 && <> · {elapsedMs} ms</>}
            {elapsedMs === 0 && <> · caché</>}
            {tmdbEnabled === true && <> · TMDB</>}
          </p>
        </div>
      </div>

      <form className="search-form" onSubmit={(e) => void onSubmit(e)}>
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
            placeholder="Empieza a escribir…"
            autoFocus
            autoComplete="off"
            enterKeyHint="search"
            inputMode="search"
          />
          <button
            type="submit"
            className="btn primary"
            disabled={busy || query.trim().length < 2}
          >
            {busy ? "…" : "Buscar"}
          </button>
        </div>
      </form>

      {error && !selected && <p className="banner error">{error}</p>}
      {message && !selected && <p className="banner ok">{message}</p>}

      {busy && !results.length && (
        <div className="media-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton-card" style={{ minHeight: 220 }} />
          ))}
        </div>
      )}

      {!!results.length && (
        <div className="media-grid">
          {results.map((item) => (
            <MediaCard
              key={`${item.type}-${item.imdbId}`}
              item={item}
              selected={
                selected?.imdbId === item.imdbId && selected.type === item.type
              }
              onClick={() => void loadTorrents(item)}
            />
          ))}
        </div>
      )}

      {selected && (
        <MediaDetail
          item={selected}
          title="Añadir a tu colección"
          onClose={closeDetail}
        >
          {selected.type === "series" && (
            <div className="row gap wrap episode-pick">
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
                Buscar episodio
              </button>
            </div>
          )}

          {error && <p className="banner error">{error}</p>}
          {message && <p className="banner ok">{message}</p>}

          <div className="torrent-section-head">
            <h4>Enlaces disponibles</h4>
            <p>Pulsa «Añadir» en el que quieras guardar en Real-Debrid.</p>
          </div>

          {loadingTorrents ? (
            <div className="torrent-list">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="skeleton-card"
                  style={{ minHeight: 72, borderRadius: 14 }}
                />
              ))}
            </div>
          ) : (
            <div className="torrent-list">
              {torrents.map((t) => {
                const adding = addingHash === t.infoHash;
                return (
                  <div key={t.infoHash} className="torrent-row">
                    <div className="torrent-copy">
                      <strong title={t.title}>{t.title}</strong>
                      <small>
                        {[
                          t.quality,
                          t.size,
                          t.seeds ? `${t.seeds} seeds` : null,
                          t.source,
                        ]
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
                      {adding ? "Añadiendo…" : "Añadir"}
                    </button>
                  </div>
                );
              })}
              {!torrents.length && !loadingTorrents && (
                <p className="hint">No hay enlaces para este título.</p>
              )}
            </div>
          )}

          {onGoLibrary &&
            message &&
            /colecci[oó]n/i.test(message) && (
            <button
              type="button"
              className="btn secondary"
              style={{ marginTop: "0.85rem", width: "100%" }}
              onClick={() => {
                closeDetail();
                onGoLibrary();
              }}
            >
              Ver mi colección
            </button>
          )}
        </MediaDetail>
      )}

      {filePick &&
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
              onClick={() => setFilePick(null)}
            />
            <div className="detail-modal-panel">
              <div className="modal-card file-pick-card">
                <h3>Elige archivos</h3>
                <p className="hint">
                  Marca lo que quieres guardar. Luego aparecerá en tu colección.
                </p>
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
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => setFilePick(null)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn primary"
                    disabled={!picked.size || busy}
                    onClick={() => void confirmFiles()}
                  >
                    Guardar en colección
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
