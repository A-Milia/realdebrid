"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { MediaItem } from "@/lib/media";

type Props = {
  item: MediaItem;
  selected?: boolean;
  onClick?: () => void;
  footer?: ReactNode;
  compact?: boolean;
};

export function MediaCard({ item, selected, onClick, footer, compact }: Props) {
  return (
    <button
      type="button"
      className={`media-card ${selected ? "selected" : ""} ${compact ? "compact" : ""}`}
      onClick={onClick}
    >
      <div className="poster">
        {item.poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.poster}
            alt=""
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span>Sin póster</span>
        )}
        {item.rating && <em className="rating">{item.rating}</em>}
      </div>
      <div className="meta">
        <strong>{item.name}</strong>
        <small>
          {item.type === "series" ? "Serie" : "Película"}
          {item.year ? ` · ${item.year}` : ""}
        </small>
        {footer}
      </div>
    </button>
  );
}

export function MediaDetail({
  item,
  onClose,
  children,
  title,
}: {
  item: MediaItem;
  onClose?: () => void;
  children?: ReactNode;
  title?: string;
}) {
  useEffect(() => {
    if (!onClose) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (!onClose) {
    return (
      <article
        className="media-detail"
        style={{
          backgroundImage: item.background
            ? `linear-gradient(180deg, rgba(7,9,12,.88), rgba(7,9,12,.97)), url(${item.background})`
            : undefined,
          backgroundColor: "#12161c",
        }}
      >
        <div className="media-detail-inner">
          <div className="detail-poster">
            {item.poster ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.poster}
                alt=""
                loading="eager"
                decoding="async"
                referrerPolicy="no-referrer"
              />
            ) : null}
          </div>
          <div className="detail-copy">
            <h3>{item.name}</h3>
            <p className="detail-sub">
              {item.type === "series" ? "Serie" : "Película"}
              {item.year ? ` · ${item.year}` : ""}
              {item.rating ? ` · ★ ${item.rating}` : ""}
            </p>
            {item.description && (
              <p className="detail-desc">{item.description}</p>
            )}
            {children}
          </div>
        </div>
      </article>
    );
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="detail-modal"
      role="dialog"
      aria-modal="true"
      aria-label={item.name}
    >
      <button
        type="button"
        className="detail-backdrop"
        aria-label="Cerrar"
        onClick={onClose}
      />
      <div className="detail-modal-panel sheet-panel">
        <header className="sheet-top">
          <div className="sheet-top-copy">
            {title && <p className="detail-kicker">{title}</p>}
            <h3>{item.name}</h3>
            <p className="detail-sub">
              {item.type === "series" ? "Serie" : "Película"}
              {item.year ? ` · ${item.year}` : ""}
              {item.rating ? ` · ★ ${item.rating}` : ""}
              {item.genres?.length
                ? ` · ${item.genres.slice(0, 3).join(", ")}`
                : ""}
            </p>
          </div>
          <button
            type="button"
            className="detail-close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <span aria-hidden>×</span>
          </button>
        </header>

        <div className="sheet-body">
          <div className="sheet-media-row">
            <div className="detail-poster">
              {item.poster ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.poster}
                  alt=""
                  loading="eager"
                  decoding="async"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="poster-fallback">Sin póster</span>
              )}
            </div>
            {item.description && (
              <p className="detail-desc sheet-desc">{item.description}</p>
            )}
          </div>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
