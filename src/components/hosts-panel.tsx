"use client";

import { useEffect, useMemo, useState } from "react";
import { rd } from "@/lib/rd-client";
import type { RdHostStatus } from "@/lib/types";

type Props = { token: string };

export function HostsPanel({ token }: Props) {
  const [hosts, setHosts] = useState<RdHostStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await rd.getHostsStatus(token);
        if (cancelled) return;
        const list = Object.entries(data ?? {}).map(([id, value]) => ({
          id,
          name: value.name || id,
          status: value.status,
          supported: value.supported,
          check: value.check,
          image: value.image,
        }));
        list.sort((a, b) => a.name.localeCompare(b.name));
        setHosts(list);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Error al cargar hosts");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return hosts;
    return hosts.filter(
      (h) =>
        h.name.toLowerCase().includes(q) ||
        h.id.toLowerCase().includes(q) ||
        (h.status || "").toLowerCase().includes(q),
    );
  }, [hosts, query]);

  const up = filtered.filter((h) => (h.status || "").toLowerCase() === "up").length;

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Hosts</h2>
          <p>
            {up} online de {filtered.length} visibles
          </p>
        </div>
        <input
          className="inline-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filtrar hosts…"
        />
      </div>

      {error && <p className="banner error">{error}</p>}
      {loading ? (
        <div className="skeleton-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton-card" />
          ))}
        </div>
      ) : (
        <div className="hosts-grid">
          {filtered.map((host) => {
            const online = (host.status || "").toLowerCase() === "up";
            return (
              <article
                key={host.id}
                className={`host-card ${online ? "up" : "down"}`}
              >
                <strong>{host.name}</strong>
                <span>{online ? "Online" : host.status || "Down"}</span>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
