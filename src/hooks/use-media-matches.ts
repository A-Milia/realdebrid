"use client";

import { useEffect, useMemo, useState } from "react";
import type { MediaItem } from "@/lib/media";

const CACHE_KEY = "rd.mediaMatch.v1";

type CacheMap = Record<string, MediaItem | null>;

function loadCache(): CacheMap {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}") as CacheMap;
  } catch {
    return {};
  }
}

function saveCache(map: CacheMap) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(map));
}

export function useMediaMatches(filenames: string[]) {
  const [matches, setMatches] = useState<CacheMap>({});

  const unique = useMemo(() => {
    const set = new Set(filenames.filter(Boolean));
    return [...set].slice(0, 80);
  }, [filenames]);

  useEffect(() => {
    let cancelled = false;
    const cache = loadCache();
    setMatches(cache);

    const missing = unique.filter((f) => !(f in cache));
    if (!missing.length) return;

    (async () => {
      const next = { ...cache };
      // Limit concurrency
      const chunk = 4;
      for (let i = 0; i < missing.length; i += chunk) {
        const batch = missing.slice(i, i + chunk);
        await Promise.all(
          batch.map(async (filename) => {
            try {
              const res = await fetch(
                `/api/search/match?filename=${encodeURIComponent(filename)}`,
              );
              const data = (await res.json()) as { match: MediaItem | null };
              next[filename] = data.match;
            } catch {
              next[filename] = null;
            }
          }),
        );
        if (!cancelled) {
          setMatches({ ...next });
          saveCache(next);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [unique]);

  return matches;
}
