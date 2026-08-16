import type {
  RdDownload,
  RdHostStatus,
  RdTorrent,
  RdUser,
  UnrestrictResult,
} from "./types";

const OPEN_SOURCE_CLIENT_ID = "X245A4XAIBGVM";

type RequestOptions = {
  method?: string;
  body?: BodyInit | null;
  form?: Record<string, string>;
  headers?: HeadersInit;
  raw?: boolean;
};

async function rdFetch<T>(
  token: string,
  path: string,
  options: RequestOptions = {},
): Promise<{ data: T; total: number | null }> {
  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${token}`);

  let body = options.body ?? null;
  if (options.form) {
    const form = new URLSearchParams();
    for (const [key, value] of Object.entries(options.form)) {
      form.set(key, value);
    }
    body = form;
    headers.set("Content-Type", "application/x-www-form-urlencoded");
  }

  const res = await fetch(`/api/rd${path}`, {
    method: options.method ?? "GET",
    headers,
    body,
    cache: "no-store",
  });

  if (!res.ok) {
    let message = `Error ${res.status}`;
    try {
      const data = (await res.json()) as { error?: string; error_code?: number };
      message = data.error || message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const totalHeader = res.headers.get("X-Total-Count");
  const total = totalHeader ? Number(totalHeader) : null;

  if (res.status === 204) return { data: undefined as T, total };
  const text = await res.text();
  if (!text) return { data: undefined as T, total };
  return { data: JSON.parse(text) as T, total };
}

async function collectPages<T>(
  token: string,
  basePath: string,
  limit = 500,
  maxPages = 20,
): Promise<T[]> {
  const first = await rdFetch<T[]>(
    token,
    `${basePath}${basePath.includes("?") ? "&" : "?"}page=1&limit=${limit}`,
  );
  const items = [...(first.data ?? [])];
  const total = first.total ?? items.length;
  const pages = Math.min(maxPages, Math.ceil(total / limit));
  if (pages <= 1) return items;

  const rest = await Promise.all(
    Array.from({ length: pages - 1 }, (_, i) =>
      rdFetch<T[]>(
        token,
        `${basePath}${basePath.includes("?") ? "&" : "?"}page=${i + 2}&limit=${limit}`,
      ),
    ),
  );
  for (const page of rest) items.push(...(page.data ?? []));
  return items;
}

export const rd = {
  getUser: async (token: string) => (await rdFetch<RdUser>(token, "/user")).data,

  getDownloads: (token: string) => collectPages<RdDownload>(token, "/downloads"),

  deleteDownload: async (token: string, id: string) => {
    await rdFetch<void>(token, `/downloads/delete/${id}`, { method: "DELETE" });
  },

  getTorrents: (token: string, filter?: "active") =>
    collectPages<RdTorrent>(
      token,
      filter ? `/torrents?filter=${filter}` : "/torrents",
    ),

  getTorrent: async (token: string, id: string) =>
    (await rdFetch<RdTorrent>(token, `/torrents/info/${id}`)).data,

  addMagnet: async (token: string, magnet: string) =>
    (
      await rdFetch<{ id: string; uri: string }>(token, "/torrents/addMagnet", {
        method: "POST",
        form: { magnet },
      })
    ).data,

  selectFiles: async (token: string, id: string, files: string) => {
    await rdFetch<void>(token, `/torrents/selectFiles/${id}`, {
      method: "POST",
      form: { files },
    });
  },

  deleteTorrent: async (token: string, id: string) => {
    await rdFetch<void>(token, `/torrents/delete/${id}`, { method: "DELETE" });
  },

  unrestrict: async (token: string, link: string) =>
    (
      await rdFetch<UnrestrictResult>(token, "/unrestrict/link", {
        method: "POST",
        form: { link },
      })
    ).data,

  getHostsStatus: async (token: string) =>
    (await rdFetch<Record<string, RdHostStatus>>(token, "/hosts/status")).data,

  getTraffic: async (token: string) =>
    (
      await rdFetch<
        Record<string, { left: number; bytes: number; links: number }>
      >(token, "/traffic")
    ).data,
};

export async function startDeviceAuth() {
  const res = await fetch(
    `/api/oauth/device/code?client_id=${OPEN_SOURCE_CLIENT_ID}&new_credentials=yes`,
  );
  if (!res.ok) throw new Error("No se pudo iniciar el login con Real-Debrid");
  return (await res.json()) as {
    device_code: string;
    user_code: string;
    interval: number;
    expires_in: number;
    verification_url: string;
  };
}

export async function pollDeviceCredentials(deviceCode: string) {
  const res = await fetch(
    `/api/oauth/device/credentials?client_id=${OPEN_SOURCE_CLIENT_ID}&code=${deviceCode}`,
  );
  if (res.status === 204 || res.status === 400) return null;
  if (!res.ok) throw new Error("Error al obtener credenciales");
  return (await res.json()) as { client_id: string; client_secret: string };
}

export async function exchangeDeviceToken(
  clientId: string,
  clientSecret: string,
  deviceCode: string,
) {
  const res = await fetch("/api/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: deviceCode,
      grant_type: "http://oauth.net/grant_type/device/1.0",
    }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || "No se pudo obtener el token");
  }
  return (await res.json()) as {
    access_token: string;
    expires_in: number;
    refresh_token: string;
    token_type: string;
  };
}

export { OPEN_SOURCE_CLIENT_ID };
