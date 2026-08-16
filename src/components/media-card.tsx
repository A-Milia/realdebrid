"use client";

import type { ReactNode } from "react";
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
      <div
        className="poster"
        style={{
          backgroundImage: item.poster ? `url(${item.poster})` : undefined,
        }}
      >
        {!item.poster && <span>Sin póster</span>}
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
}: {
  item: MediaItem;
  onClose?: () => void;
  children?: ReactNode;
}) {
  return (
    <article
      className="media-detail"
      style={{
        backgroundImage: item.background
          ? `linear-gradient(90deg, rgba(16,24,32,.92), rgba(16,24,32,.78)), url(${item.background})`
          : undefined,
      }}
    >
      <div className="media-detail-inner">
        <div
          className="detail-poster"
          style={{
            backgroundImage: item.poster ? `url(${item.poster})` : undefined,
          }}
        />
        <div>
          <div className="row gap" style={{ justifyContent: "space-between" }}>
            <h3>{item.name}</h3>
            {onClose && (
              <button type="button" className="btn ghost compact" onClick={onClose}>
                Cerrar
              </button>
            )}
          </div>
          <p className="detail-sub">
            {item.type === "series" ? "Serie" : "Película"}
            {item.year ? ` · ${item.year}` : ""}
            {item.rating ? ` · ★ ${item.rating}` : ""}
            {item.genres?.length ? ` · ${item.genres.slice(0, 3).join(", ")}` : ""}
          </p>
          {item.description && <p className="detail-desc">{item.description}</p>}
          {children}
        </div>
      </div>
    </article>
  );
}
