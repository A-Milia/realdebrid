"use client";

import { useEffect, useRef, useState } from "react";
import {
  exchangeDeviceToken,
  pollDeviceCredentials,
  startDeviceAuth,
} from "@/lib/rd-client";
import { setStoredCreds } from "@/lib/storage";
import { useAuth } from "./auth-provider";

export function LoginScreen() {
  const { loginWithToken, error } = useAuth();
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [mode, setMode] = useState<"token" | "device" | "admin">("token");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminReady, setAdminReady] = useState(false);
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const brandTapsRef = useRef(0);
  const brandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [device, setDevice] = useState<{
    userCode: string;
    verificationUrl: string;
    deviceCode: string;
  } | null>(null);

  useEffect(() => {
    void fetch("/api/admin/login")
      .then((r) => r.json())
      .then((d: { configured?: boolean }) => setAdminReady(!!d.configured))
      .catch(() => setAdminReady(false));
  }, []);

  useEffect(() => {
    // Secret URL unlock: /?admin=1
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("admin") === "1") setAdminUnlocked(true);
  }, []);

  useEffect(() => {
    if (!device) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const creds = await pollDeviceCredentials(device.deviceCode);
        if (cancelled) return;
        if (!creds) {
          timer = setTimeout(poll, 5000);
          return;
        }
        setStoredCreds({
          clientId: creds.client_id,
          clientSecret: creds.client_secret,
        });
        const tokens = await exchangeDeviceToken(
          creds.client_id,
          creds.client_secret,
          device.deviceCode,
        );
        if (cancelled) return;
        await loginWithToken(tokens.access_token);
      } catch (err) {
        if (!cancelled) {
          setLocalError(err instanceof Error ? err.message : "Error de login");
          setDevice(null);
        }
      }
    };

    timer = setTimeout(poll, 5000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [device, loginWithToken]);

  function onBrandTap() {
    if (brandTimerRef.current) clearTimeout(brandTimerRef.current);
    brandTapsRef.current += 1;
    if (brandTapsRef.current >= 5) {
      setAdminUnlocked(true);
      setMode("admin");
      brandTapsRef.current = 0;
      return;
    }
    brandTimerRef.current = setTimeout(() => {
      brandTapsRef.current = 0;
    }, 2500);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setLocalError(null);
    try {
      await loginWithToken(token);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function onAdminSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setLocalError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: adminPassword }),
      });
      const data = (await res.json()) as { token?: string; error?: string };
      if (!res.ok || !data.token) {
        throw new Error(data.error || "No se pudo entrar como admin");
      }
      await loginWithToken(data.token);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function startDevice() {
    setBusy(true);
    setLocalError(null);
    try {
      const data = await startDeviceAuth();
      setDevice({
        userCode: data.user_code,
        verificationUrl: data.verification_url,
        deviceCode: data.device_code,
      });
      setMode("device");
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <div className="login-bg" aria-hidden />
      <div className="login-panel">
        <button type="button" className="brand-mark brand-tap" onClick={onBrandTap}>
          RealDebrid
        </button>
        <h1>Tu catálogo, sin fricción</h1>
        <p className="lede">
          Entra con tu cuenta de Real-Debrid para ver descargas, torrents y
          buscar contenido con carátulas.
        </p>

        <div className="tabs" role="tablist">
          <button
            type="button"
            className={mode === "token" ? "active" : ""}
            onClick={() => {
              setMode("token");
              setDevice(null);
            }}
          >
            Token
          </button>
          <button
            type="button"
            className={mode === "device" ? "active" : ""}
            onClick={() => void startDevice()}
          >
            Dispositivo
          </button>
          {adminReady && (
            <button
              type="button"
              className={mode === "admin" ? "active" : ""}
              onClick={() => {
                setMode("admin");
                setDevice(null);
                setAdminUnlocked(true);
              }}
            >
              Admin
            </button>
          )}
        </div>

        {mode === "token" ? (
          <form onSubmit={onSubmit} className="stack">
            <label>
              Token de tu cuenta Real-Debrid
              <input
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Pega el token de real-debrid.com/apitoken"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <p className="hint">
              Cópialo en{" "}
              <a
                href="https://real-debrid.com/apitoken"
                target="_blank"
                rel="noreferrer"
              >
                real-debrid.com/apitoken
              </a>
              . Se guarda solo en este navegador.
            </p>
            <button type="submit" className="btn primary" disabled={busy}>
              {busy ? "Entrando…" : "Entrar"}
            </button>
          </form>
        ) : mode === "device" ? (
          <div className="device-box">
            {device ? (
              <>
                <p>Abre Real-Debrid y introduce este código:</p>
                <p className="user-code">{device.userCode}</p>
                <a
                  className="btn primary"
                  href={device.verificationUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir real-debrid.com/device
                </a>
                <p className="hint">Esperando autorización…</p>
              </>
            ) : (
              <button
                type="button"
                className="btn primary"
                onClick={() => void startDevice()}
                disabled={busy}
              >
                Generar código
              </button>
            )}
          </div>
        ) : (
          <form onSubmit={(e) => void onAdminSubmit(e)} className="stack">
            <p className="hint callout">
              Acceso propietario: el token de Real-Debrid ya está en el servidor.
              Solo hace falta tu contraseña de admin.
            </p>
            <label>
              Contraseña de administrador
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Tu contraseña secreta"
                autoComplete="current-password"
                autoFocus
              />
            </label>
            <button
              type="submit"
              className="btn primary"
              disabled={busy || adminPassword.length < 1}
            >
              {busy ? "Entrando…" : "Entrar como admin"}
            </button>
          </form>
        )}

        {!adminReady && (
          <p className="hint admin-hint">
            Admin pendiente: configura RD_ADMIN_TOKEN en Vercel.
          </p>
        )}

        {(localError || error) && (
          <p className="error" role="alert">
            {localError || error}
          </p>
        )}
      </div>
    </div>
  );
}
