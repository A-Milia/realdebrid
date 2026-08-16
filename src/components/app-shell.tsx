"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMediaMatches } from "@/hooks/use-media-matches";
import { daysLeft, formatBytes } from "@/lib/format";
import type { MediaItem } from "@/lib/media";
import { rd } from "@/lib/rd-client";
import type { RdDownload, RdTorrent } from "@/lib/types";
import { useAuth } from "./auth-provider";
import { DownloadsPanel } from "./downloads-panel";
import { HostsPanel } from "./hosts-panel";
import { MediaCard, MediaDetail } from "./media-card";
import { SearchPanel } from "./search-panel";
import { TorrentsPanel } from "./torrents-panel";
import { UnrestrictPanel } from "./unrestrict-panel";

export type Tab =
  | "overview"
  | "search"
  | "downloads"
  | "torrents"
  | "unrestrict"
  | "hosts";

function IconHome({ active }: { active?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconSearch({ active }: { active?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle
        cx="11"
        cy="11"
        r="6.5"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
      />
      <path
        d="m16 16 4 4"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconDownloads({ active }: { active?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 4v10m0 0 4-4m-4 4-4-4M5 18h14"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconTorrents({ active }: { active?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3v10m0 0 3.5-3.5M12 13 8.5 9.5M7 14.5c-2 1-3 2.4-3 4 0 1.4 2.7 2.5 8 2.5s8-1.1 8-2.5c0-1.6-1-3-3-4"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconMore({ active }: { active?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="6" cy="12" r={active ? 1.7 : 1.5} fill="currentColor" />
      <circle cx="12" cy="12" r={active ? 1.7 : 1.5} fill="currentColor" />
      <circle cx="18" cy="12" r={active ? 1.7 : 1.5} fill="currentColor" />
    </svg>
  );
}

function IconRefresh() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M20 12a8 8 0 1 1-2.2-5.5M20 5v5h-5"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconLink() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 12a4 4 0 0 0 4 4l2.5-2.5a3.5 3.5 0 0 0-5-5L9 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M15 12a4 4 0 0 0-4 0L8.5 14.5a3.5 3.5 0 0 0 5 5L15 18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconHosts() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3.5"
        y="5"
        width="17"
        height="5"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <rect
        x="3.5"
        y="14"
        width="17"
        height="5"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="7" cy="7.5" r="0.9" fill="currentColor" />
      <circle cx="7" cy="16.5" r="0.9" fill="currentColor" />
    </svg>
  );
}

export function AppShell() {
  const { token, user, logout, refreshUser } = useAuth();
  const [tab, setTab] = useState<Tab>("search");
  const [query, setQuery] = useState("");
  const [downloads, setDownloads] = useState<RdDownload[]>([]);
  const [torrents, setTorrents] = useState<RdTorrent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<MediaItem | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const [d, t] = await Promise.all([
        rd.getDownloads(token),
        rd.getTorrents(token),
      ]);
      setDownloads(d ?? []);
      setTorrents(t ?? []);
      await refreshUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, refreshUser]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (
        e.key === "/" &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        document.getElementById("global-search")?.focus();
      }
      if (e.key === "Escape") setMoreOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const libraryFilenames = useMemo(
    () => [
      ...torrents.map((t) => t.filename),
      ...downloads.map((d) => d.filename),
    ],
    [torrents, downloads],
  );
  const libraryMatches = useMediaMatches(libraryFilenames, 150);

  const overviewPosters = useMemo(() => {
    const map = new Map<string, MediaItem>();
    for (const filename of libraryFilenames) {
      const m = libraryMatches[filename];
      if (m?.poster) map.set(`${m.type}:${m.imdbId}`, m);
    }
    return [...map.values()].slice(0, 18);
  }, [libraryFilenames, libraryMatches]);

  const stats = useMemo(() => {
    const activeTorrents = torrents.filter(
      (t) => t.status === "downloading" || t.status === "queued",
    ).length;
    const readyTorrents = torrents.filter(
      (t) => t.status === "downloaded",
    ).length;
    const totalDownloadBytes = downloads.reduce(
      (sum, d) => sum + (d.filesize || 0),
      0,
    );
    return {
      downloads: downloads.length,
      torrents: torrents.length,
      activeTorrents,
      readyTorrents,
      totalDownloadBytes,
      withCovers: overviewPosters.length,
    };
  }, [downloads, torrents, overviewPosters.length]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
  }

  function go(next: Tab) {
    setTab(next);
    setMoreOpen(false);
    setDetail(null);
  }

  const titles: Record<Tab, string> = {
    overview: "Resumen",
    search: "Buscar",
    downloads: "Descargas",
    torrents: "Torrents",
    unrestrict: "Unrestrict",
    hosts: "Hosts",
  };

  const showLibraryFilter = tab === "downloads" || tab === "torrents";
  const moreActive = tab === "unrestrict" || tab === "hosts" || moreOpen;

  if (!user || !token) return null;

  return (
    <div className="shell">
      <header className="top-chrome">
        <div className="top-brand">
          <span className="logo-dot" />
          <div>
            <strong>{titles[tab]}</strong>
            <small>RealDebrid</small>
          </div>
        </div>
        <div className="top-actions">
          <button
            type="button"
            className="icon-btn"
            aria-label="Actualizar"
            onClick={() => void onRefresh()}
            disabled={refreshing}
          >
            <IconRefresh />
          </button>
        </div>
      </header>

      <main className="main">
        <div
          className={`filter-bar${showLibraryFilter ? " visible" : ""}`}
        >
          <div className="search-wrap">
            <kbd>/</kbd>
            <input
              id="global-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filtrar biblioteca…"
              inputMode="search"
              enterKeyHint="search"
            />
          </div>
        </div>

        {error && (
          <p className="banner error" role="alert">
            {error}
          </p>
        )}

        {loading ? (
          <div className="skeleton-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton-card" />
            ))}
          </div>
        ) : (
          <>
            {tab === "overview" && (
              <section className="overview">
                <div className="hero-line">
                  <h1>Hola, {user.username}</h1>
                  <p>
                    Biblioteca con carátulas. Busca y añade a Real-Debrid desde
                    el móvil.
                  </p>
                </div>
                <div className="stat-grid">
                  <article className="stat">
                    <span>Descargas</span>
                    <strong>{stats.downloads}</strong>
                    <small>{formatBytes(stats.totalDownloadBytes)}</small>
                  </article>
                  <article className="stat">
                    <span>Torrents</span>
                    <strong>{stats.torrents}</strong>
                    <small>{stats.readyTorrents} listos</small>
                  </article>
                  <article className="stat">
                    <span>Activos</span>
                    <strong>{stats.activeTorrents}</strong>
                    <small>cola / descarga</small>
                  </article>
                  <article className="stat">
                    <span>Carátulas</span>
                    <strong>{stats.withCovers}</strong>
                    <small>detectadas</small>
                  </article>
                </div>

                {detail && (
                  <MediaDetail item={detail} onClose={() => setDetail(null)} />
                )}

                {!!overviewPosters.length && (
                  <>
                    <h2 className="section-title">Tu biblioteca</h2>
                    <div className="media-grid">
                      {overviewPosters.map((media) => (
                        <MediaCard
                          key={`${media.type}-${media.imdbId}`}
                          item={media}
                          onClick={() => setDetail(media)}
                        />
                      ))}
                    </div>
                  </>
                )}

                <div className="quick-actions">
                  <button
                    type="button"
                    className="btn primary"
                    onClick={() => go("search")}
                  >
                    Buscar y añadir
                  </button>
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => go("downloads")}
                  >
                    Descargas
                  </button>
                </div>
              </section>
            )}

            {tab === "search" && (
              <SearchPanel token={token} onAdded={() => void onRefresh()} />
            )}

            {tab === "downloads" && (
              <DownloadsPanel
                token={token}
                items={downloads}
                query={query}
                onChange={setDownloads}
              />
            )}
            {tab === "torrents" && (
              <TorrentsPanel
                token={token}
                items={torrents}
                query={query}
                onChange={setTorrents}
                onRefresh={() => void onRefresh()}
              />
            )}
            {tab === "unrestrict" && (
              <UnrestrictPanel
                token={token}
                onCreated={() => void onRefresh()}
              />
            )}
            {tab === "hosts" && <HostsPanel token={token} />}
          </>
        )}
      </main>

      <nav className="bottom-nav" aria-label="Principal">
        <button
          type="button"
          className={`bottom-nav-item${tab === "overview" ? " active" : ""}`}
          onClick={() => go("overview")}
        >
          <IconHome active={tab === "overview"} />
          Resumen
        </button>
        <button
          type="button"
          className={`bottom-nav-item${tab === "search" ? " active" : ""}`}
          onClick={() => go("search")}
        >
          <IconSearch active={tab === "search"} />
          Buscar
        </button>
        <button
          type="button"
          className={`bottom-nav-item${tab === "downloads" ? " active" : ""}`}
          onClick={() => go("downloads")}
        >
          {stats.downloads > 0 && (
            <span className="nav-count">
              {stats.downloads > 99 ? "99+" : stats.downloads}
            </span>
          )}
          <IconDownloads active={tab === "downloads"} />
          Descargas
        </button>
        <button
          type="button"
          className={`bottom-nav-item${tab === "torrents" ? " active" : ""}`}
          onClick={() => go("torrents")}
        >
          {stats.torrents > 0 && (
            <span className="nav-count">
              {stats.torrents > 99 ? "99+" : stats.torrents}
            </span>
          )}
          <IconTorrents active={tab === "torrents"} />
          Torrents
        </button>
        <button
          type="button"
          className={`bottom-nav-item${moreActive ? " active" : ""}`}
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
        >
          <IconMore active={moreActive} />
          Más
        </button>
      </nav>

      {moreOpen && (
        <>
          <button
            type="button"
            className="sheet-backdrop"
            aria-label="Cerrar"
            onClick={() => setMoreOpen(false)}
          />
          <div className="sheet" role="dialog" aria-label="Más opciones">
            <div className="sheet-handle" />
            <div className="sheet-user">
              <div
                className="avatar"
                style={{ backgroundImage: `url(${user.avatar})` }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong>{user.username}</strong>
                <small>
                  {user.type === "premium"
                    ? `${daysLeft(user.expiration)} días premium`
                    : user.type}
                </small>
              </div>
              <button
                type="button"
                className="btn danger compact"
                onClick={logout}
              >
                Salir
              </button>
            </div>
            <div className="sheet-actions">
              <button
                type="button"
                className={`sheet-action${tab === "unrestrict" ? " active" : ""}`}
                onClick={() => go("unrestrict")}
              >
                <IconLink />
                Unrestrict link
              </button>
              <button
                type="button"
                className={`sheet-action${tab === "hosts" ? " active" : ""}`}
                onClick={() => go("hosts")}
              >
                <IconHosts />
                Estado de hosts
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
