"use client";

import { useState } from "react";
import { formatBytes } from "@/lib/format";
import { rd } from "@/lib/rd-client";
import type { UnrestrictResult } from "@/lib/types";

type Props = {
  token: string;
  onCreated: () => void;
};

export function UnrestrictPanel({ token, onCreated }: Props) {
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<UnrestrictResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = link.trim();
    if (!value) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const data = await rd.unrestrict(token, value);
      setResult(data);
      setLink("");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo desbloquear");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!result) return;
    await navigator.clipboard.writeText(result.download);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <section className="panel narrow">
      <div className="panel-head">
        <div>
          <h2>Unrestrict</h2>
          <p>Pega un enlace de hoster y obtén el download directo.</p>
        </div>
      </div>

      <form className="stack" onSubmit={(e) => void onSubmit(e)}>
        <label>
          Enlace
          <textarea
            value={link}
            onChange={(e) => setLink(e.target.value)}
            rows={4}
            placeholder="https://…"
            spellCheck={false}
          />
        </label>
        <button
          type="submit"
          className="btn primary"
          disabled={busy || !link.trim()}
        >
          {busy ? "Procesando…" : "Desbloquear"}
        </button>
      </form>

      {error && <p className="banner error">{error}</p>}

      {result && (
        <article className="result-card">
          <h3>{result.filename}</h3>
          <p>
            {result.host} · {formatBytes(result.filesize)}
          </p>
          <div className="row gap">
            <button
              type="button"
              className="btn secondary"
              onClick={() => void copy()}
            >
              {copied ? "Copiado" : "Copiar enlace"}
            </button>
            <a
              className="btn primary"
              href={result.download}
              target="_blank"
              rel="noreferrer"
            >
              Abrir / stream
            </a>
          </div>
        </article>
      )}
    </section>
  );
}
