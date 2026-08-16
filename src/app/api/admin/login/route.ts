import { NextRequest, NextResponse } from "next/server";
import {
  adminRateLimit,
  getAdminConfig,
  safeEqualString,
} from "@/lib/admin";

export const runtime = "nodejs";

export async function GET() {
  const { configured } = getAdminConfig();
  return NextResponse.json({ configured });
}

export async function POST(req: NextRequest) {
  const { configured, password, token } = getAdminConfig();
  if (!configured) {
    return NextResponse.json(
      {
        error:
          "Admin no configurado. Añade ADMIN_PASSWORD y RD_ADMIN_TOKEN en Vercel.",
      },
      { status: 503 },
    );
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  const limit = adminRateLimit(ip);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Demasiados intentos. Espera unos minutos." },
      { status: 429 },
    );
  }

  let body: { password?: string };
  try {
    body = (await req.json()) as { password?: string };
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const attempt = body.password?.trim() || "";
  if (!attempt || !safeEqualString(attempt, password)) {
    return NextResponse.json(
      { error: "Contraseña incorrecta" },
      { status: 401 },
    );
  }

  // Token only after successful auth — never shipped in the JS bundle.
  return NextResponse.json({
    ok: true,
    token,
  });
}
