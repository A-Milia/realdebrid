"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMediaMatches } from "@/hooks/use-media-matches";
import { daysLeft } from "@/lib/format";
import type { MediaItem } from "@/lib/media";
import { rd } from "@/lib/rd-client";
import type { RdDownload, RdTorrent } from "@/lib/types";
import { useAuth } from "./auth-provider";
import { HostsPanel } from "./hosts-panel";
import { LibraryPanel } from "./library-panel";
import { MediaCard, MediaDetail } from "./media-card";
import { SearchPanel } from "./search-panel";
import { UnrestrictPanel } from "./unrestrict-panel";

export type Tab =
  | "overview"
  | "search"
  | "library"
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

function IconLibrary({ active }: { active?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 4.5h6.5A1.5 1.5 0 0 1 13 6v14l-3.5-2L6 20V6A1.5 1.5 0 0 1 7.5 4.5H5"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinejoin="round"
      />
      <path
        d="M13 6h4.5A1.5 1.5 0 0 1 19 7.5V20l-3-1.7L13 20V6Z"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
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
      try {
        await refreshUser();
      } catch {
        // El listado ya cargó; no bloqueamos la UI por el perfil.
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al cargar";
      // Evita alarmar con códigos crudos si la acción principal ya funcionó.
      if (!/^Error \d+$/i.test(message)) {
        setError(message);
      } else {
        setError("No se pudo actualizar la lista. Pulsa actualizar.");
      }
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
    return {
      downloads: downloads.length,
      torrents: torrents.length,
    };
  }, [downloads, torrents]);

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
    overview: "Inicio",
    search: "Buscar",
    library: "Colección",
    unrestrict: "Abrir enlace",
    hosts: "Hosts",
  };

  const showLibraryFilter = tab === "library";
  const moreActive = tab === "unrestrict" || tab === "hosts" || moreOpen;
  const libraryTotal = downloads.length + torrents.length;

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
              placeholder="Filtrar colección…"
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
              <section className="overview home">
                <div className="hero-line">
                  <h1>Hola, {user.username}</h1>
                  <p>Tu biblioteca Real-Debrid, lista para buscar y añadir.</p>
                </div>

                {!!overviewPosters.length && (
                  <div className="home-hero-rail" aria-label="Destacados">
                    {overviewPosters.slice(0, 6).map((media) => (
                      <button
                        key={`hero-${media.type}-${media.imdbId}`}
                        type="button"
                        className="home-hero-card"
                        onClick={() => setDetail(media)}
                        style={{
                          backgroundImage: media.background || media.poster
                            ? `linear-gradient(180deg, rgba(7,9,12,.15), rgba(7,9,12,.88)), url(${media.background || media.poster})`
                            : undefined,
                        }}
                      >
                        <span className="home-hero-play" aria-hidden>
                          ▶
                        </span>
                        <span className="home-hero-meta">
                          <strong>{media.name}</strong>
                          <small>
                            {media.type === "series" ? "Serie" : "Película"}
                            {media.year ? ` · ${media.year}` : ""}
                          </small>
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                <div className="home-section-head">
                  <h2>Accesos</h2>
                </div>
                <div className="home-shortcuts">
                  <button
                    type="button"
                    className="home-tile tile-search"
                    onClick={() => go("search")}
                  >
                    <span>Buscar</span>
                    <small>Películas y series</small>
                  </button>
                  <button
                    type="button"
                    className="home-tile tile-active"
                    onClick={() => go("library")}
                  >
                    <span>En proceso</span>
                    <small>{stats.torrents} torrents</small>
                  </button>
                  <button
                    type="button"
                    className="home-tile tile-ready"
                    onClick={() => go("library")}
                  >
                    <span>Listos</span>
                    <small>{stats.downloads} archivos</small>
                  </button>
                </div>

                {detail && (
                  <MediaDetail item={detail} onClose={() => setDetail(null)} />
                )}

                {!!overviewPosters.length && (
                  <>
                    <div className="home-section-head">
                      <h2>Añadido recientemente</h2>
                      <button
                        type="button"
                        className="text-link"
                        onClick={() => go("library")}
                      >
                        Ver todo
                      </button>
                    </div>
                    <div className="media-grid home-recent-grid">
                      {overviewPosters.slice(0, 12).map((media) => (
                        <MediaCard
                          key={`${media.type}-${media.imdbId}`}
                          item={media}
                          onClick={() => setDetail(media)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </section>
            )}

            {tab === "search" && (
              <SearchPanel
                token={token}
                onAdded={() => void onRefresh()}
                onGoLibrary={() => go("library")}
              />
            )}

            {tab === "library" && (
              <LibraryPanel
                token={token}
                downloads={downloads}
                torrents={torrents}
                query={query}
                onDownloadsChange={setDownloads}
                onTorrentsChange={setTorrents}
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
          Inicio
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
          className={`bottom-nav-item${tab === "library" ? " active" : ""}`}
          onClick={() => go("library")}
        >
          {libraryTotal > 0 && (
            <span className="nav-count">
              {libraryTotal > 99 ? "99+" : libraryTotal}
            </span>
          )}
          <IconLibrary active={tab === "library"} />
          Colección
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
                Abrir enlace
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
