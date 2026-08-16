type Entry<T> = { value: T; expires: number };

const store = new Map<string, Entry<unknown>>();

export function cacheGet<T>(key: string): T | null {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expires) {
    store.delete(key);
    return null;
  }
  return hit.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlMs: number) {
  // Soft cap to avoid unbounded growth on warm lambdas
  if (store.size > 400) {
    const first = store.keys().next().value;
    if (first) store.delete(first);
  }
  store.set(key, { value, expires: Date.now() + ttlMs });
}

export async function cached<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const hit = cacheGet<T>(key);
  if (hit !== null) return hit;
  const value = await loader();
  cacheSet(key, value, ttlMs);
  return value;
}

export function cacheKey(parts: Array<string | number | undefined | null>) {
  return parts.map((p) => String(p ?? "").toLowerCase().trim()).join("|");
}
