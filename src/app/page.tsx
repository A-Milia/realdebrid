"use client";

import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { LoginScreen } from "@/components/login-screen";

export default function HomePage() {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <div className="login">
        <div className="login-panel">
          <p className="brand-mark">RealDebrid</p>
          <h1>Cargando…</h1>
          <p className="lede">Preparando tu biblioteca.</p>
        </div>
      </div>
    );
  }

  if (!token) return <LoginScreen />;
  return <AppShell />;
}
