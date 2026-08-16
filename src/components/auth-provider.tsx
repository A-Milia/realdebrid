"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { rd } from "@/lib/rd-client";
import {
  clearStoredToken,
  getStoredToken,
  setStoredToken,
} from "@/lib/storage";
import type { RdUser } from "@/lib/types";

type AuthState = {
  token: string | null;
  user: RdUser | null;
  loading: boolean;
  error: string | null;
  loginWithToken: (token: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<RdUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const bootstrap = useCallback(async (stored: string) => {
    setLoading(true);
    setError(null);
    try {
      const me = await rd.getUser(stored);
      setToken(stored);
      setUser(me);
      setStoredToken(stored);
    } catch (err) {
      clearStoredToken();
      setToken(null);
      setUser(null);
      setError(err instanceof Error ? err.message : "Token inválido");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const stored = getStoredToken();
    if (!stored) {
      setLoading(false);
      return;
    }
    void bootstrap(stored);
  }, [bootstrap]);

  const loginWithToken = useCallback(
    async (value: string) => {
      const clean = value.trim();
      if (!clean) throw new Error("Introduce un token");
      await bootstrap(clean);
    },
    [bootstrap],
  );

  const logout = useCallback(() => {
    clearStoredToken();
    setToken(null);
    setUser(null);
    setError(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!token) return;
    const me = await rd.getUser(token);
    setUser(me);
  }, [token]);

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      error,
      loginWithToken,
      logout,
      refreshUser,
    }),
    [token, user, loading, error, loginWithToken, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
