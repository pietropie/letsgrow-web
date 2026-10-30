import type { NextRequest, NextResponse } from "next/server";

/**
 * Sessão do usuário em cookies httpOnly (decisão em analise-2026-10-16/WEBAPP.md §2.2).
 * O refresh do backend é um JWT de 7 dias sem revogação: ele nunca pode chegar a um script da página.
 */
export const ACCESS_COOKIE = "lg_at";
export const REFRESH_COOKIE = "lg_rt";

export const API_URL = (process.env.API_URL ?? "https://api.letsgrowapp.com.br/api/v1").replace(/\/+$/, "");

export type Tokens = { access_token: string; refresh_token: string };

/** Segundos até o `exp` do JWT (sem conferir a assinatura: isso é do backend). */
function secondsLeft(token: string, fallback: number): number {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    const left = Math.floor(payload.exp - Date.now() / 1000);
    return Number.isFinite(left) && left > 0 ? left : fallback;
  } catch {
    return fallback;
  }
}

const base = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" };

export function setSession(res: NextResponse, tokens: Tokens) {
  // O cookie do access some um pouco antes do token vencer: o BFF renova sem esperar um 401.
  res.cookies.set(ACCESS_COOKIE, tokens.access_token, { ...base, maxAge: Math.max(secondsLeft(tokens.access_token, 30 * 60) - 30, 1) });
  res.cookies.set(REFRESH_COOKIE, tokens.refresh_token, { ...base, maxAge: secondsLeft(tokens.refresh_token, 7 * 24 * 3600) });
}

export function clearSession(res: NextResponse) {
  res.cookies.set(ACCESS_COOKIE, "", { ...base, maxAge: 0 });
  res.cookies.set(REFRESH_COOKIE, "", { ...base, maxAge: 0 });
}

export async function refreshTokens(refreshToken: string): Promise<Tokens | null> {
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST", cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.access_token && data?.refresh_token ? data : null;
  } catch {
    return null;
  }
}

/**
 * CSRF: o cookie é SameSite=Lax e toda escrita precisa do cabeçalho X-LG-Web, que um formulário de outro
 * site não consegue mandar (e um fetch de outro site com ele exige um preflight CORS que não respondemos).
 * Se vier `Origin`, o host tem que ser o deste app.
 */
export function isTrustedWrite(req: NextRequest): boolean {
  if (req.headers.get("x-lg-web") !== "1") return false;
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
