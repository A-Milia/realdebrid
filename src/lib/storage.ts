const TOKEN_KEY = "rd.token";
const CREDS_KEY = "rd.oauth.creds";

export type OAuthCreds = {
  clientId: string;
  clientSecret: string;
};

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(CREDS_KEY);
}

export function getStoredCreds(): OAuthCreds | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(CREDS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as OAuthCreds;
  } catch {
    return null;
  }
}

export function setStoredCreds(creds: OAuthCreds) {
  localStorage.setItem(CREDS_KEY, JSON.stringify(creds));
}
