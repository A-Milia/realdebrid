"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { daysLeft, formatBytes, formatRelative } from "@/lib/format";
import { rd } from "@/lib/rd-client";
import type { RdDownload, RdTorrent } from "@/lib/types";
import { useAuth } from "./auth-provider";
import { DownloadsPanel } from "./downloads-panel";
import { HostsPanel } from "./hosts-panel";
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

export function AppShell() {
  const { token, user, logout, refreshUser } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");
  const [query, setQuery] = useState("");
  const [downloads, setDownloads] = useState<RdDownload[]>([]);
  const [torrents, setTorrents] = useState<RdTorrent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      if (e.key === "/" && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        document.getElementById("global-search")?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const stats = useMemo(() => {
    const activeTorrents = torrents.filter(
      (t) => t.status === "downloading" || t.status === "queued",
    ).length;
    const readyTorrents = torrents.filter((t) => t.status === "downloaded").length;
    const totalDownloadBytes = downloads.reduce((sum, d) => sum + (d.filesize || 0), 0);
    return {
      downloads: downloads.length,
      torrents: torrents.length,
      activeTorrents,
      readyTorrents,
      totalDownloadBytes,
    };
  }, [downloads, torrents]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
  }

  if (!user || !token) return null;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="logo-dot" />
          <div>
            <strong>RealDebrid</strong>
            <small>Manager</small>
          </div>
        </div>

        <nav className="nav">
          {(
            [
              ["overview", "Resumen"],
              ["search", "Buscar"],
              ["downloads", "Descargas"],
              ["torrents", "Torrents"],
              ["unrestrict", "Unrestrict"],
              ["hosts", "Hosts"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={tab === id ? "nav-item active" : "nav-item"}
              onClick={() => setTab(id)}
            >
              {label}
              {id === "downloads" && (
                <span className="badge">{stats.downloads}</span>
              )}
              {id === "torrents" && <span className="badge">{stats.torrents}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-user">
          <div className="avatar" style={{ backgroundImage: `url(${user.avatar})` }} />
          <div>
            <strong>{user.username}</strong>
            <small>
              {user.type === "premium"
                ? `${daysLeft(user.expiration)} días premium`
                : user.type}
            </small>
          </div>
          <button type="button" className="btn ghost compact" onClick={logout}>
            Salir
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="search-wrap">
            <kbd>/</kbd>
            <input
              id="global-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar en tu catálogo…"
            />
          </div>
          <button
            type="button"
            className="btn secondary"
            onClick={() => void onRefresh()}
            disabled={refreshing}
          >
            {refreshing ? "Actualizando…" : "Actualizar"}
          </button>
        </header>

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
                    Tu biblioteca Real-Debrid en un solo sitio. Busca, copia y
                    gestiona sin perder el ritmo.
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
                    <small>en cola / descarga</small>
                  </article>
                  <article className="stat">
                    <span>Premium</span>
                    <strong>{daysLeft(user.expiration)}d</strong>
                    <small>{formatRelative(user.expiration)}</small>
                  </article>
                </div>
                <div className="quick-actions">
                  <button type="button" className="btn primary" onClick={() => setTab("search")}>
                    Buscar y añadir
                  </button>
                  <button type="button" className="btn secondary" onClick={() => setTab("unrestrict")}>
                    Desbloquear enlace
                  </button>
                  <button type="button" className="btn secondary" onClick={() => setTab("torrents")}>
                    Añadir magnet
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
              <UnrestrictPanel token={token} onCreated={() => void onRefresh()} />
            )}
            {tab === "hosts" && <HostsPanel token={token} />}
          </>
        )}
      </main>
    </div>
  );
}
