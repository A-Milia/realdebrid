import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { cacheGet, cacheSet } from "@/lib/server-cache";

export function hashSecret(value: string) {
  return createHash("sha256").update(value).digest();
}

export function safeEqualString(a: string, b: string) {
  const ha = hashSecret(a);
  const hb = hashSecret(b);
  return timingSafeEqual(ha, hb);
}

export function getAdminConfig() {
  const password = process.env.ADMIN_PASSWORD?.trim() || "";
  const token = process.env.RD_ADMIN_TOKEN?.trim() || "";
  return {
    configured: Boolean(password && token),
    password,
    token,
  };
}

/** Simple per-IP rate limit for admin login attempts. */
export function adminRateLimit(ip: string, max = 8, windowMs = 15 * 60 * 1000) {
  const key = `admin-rl:${ip}`;
  const now = Date.now();
  const state = cacheGet<{ count: number; start: number }>(key) || {
    count: 0,
    start: now,
  };

  if (now - state.start > windowMs) {
    const fresh = { count: 1, start: now };
    cacheSet(key, fresh, windowMs);
    return { ok: true, remaining: max - 1 };
  }

  if (state.count >= max) {
    return { ok: false, remaining: 0 };
  }

  const next = { count: state.count + 1, start: state.start };
  cacheSet(key, next, windowMs - (now - state.start));
  return { ok: true, remaining: max - next.count };
}

export function newSessionId() {
  return randomBytes(24).toString("hex");
}
