import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE, API_URL, REFRESH_COOKIE, clearSession, isTrustedWrite, refreshTokens, setSession, type Tokens } from "@/lib/server/session";

/**
 * BFF: repassa /api/bff/<caminho> para <API_URL>/<caminho> com o JWT do cookie.
 * - Status, corpo e X-Total-Count chegam ao navegador como a API mandou.
 * - Em 401 renova uma vez pelo refresh e repete; se não der, apaga a sessão.
 * - O corpo é repassado em stream (SSE do Bobby). O `request.signal` fecha a chamada à API quando o
 *   navegador desiste, e o backend devolve a reserva sem cobrar.
 */
export const dynamic = "force-dynamic";

/** Rotas que devolvem tokens no corpo: só pelas rotas de /api/auth, que os guardam em cookie. */
const TOKEN_ROUTES = new Set(["auth/login", "auth/verify-email", "auth/refresh", "auth/google"]);
const PASS_REQUEST = ["content-type", "accept"];
const PASS_RESPONSE = ["content-type", "x-total-count", "content-disposition", "retry-after"];

async function handle(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  if (TOKEN_ROUTES.has(path.join("/"))) return NextResponse.json({ detail: "Não encontrado" }, { status: 404 });
  if (req.method !== "GET" && !isTrustedWrite(req)) return NextResponse.json({ detail: "Origem não permitida" }, { status: 403 });

  const url = `${API_URL}/${path.map(encodeURIComponent).join("/")}${req.nextUrl.search}`;
  const body = req.method === "GET" || req.method === "DELETE" ? undefined : await req.arrayBuffer();
  const forward = (token?: string) => {
    const headers = new Headers();
    for (const name of PASS_REQUEST) { const v = req.headers.get(name); if (v) headers.set(name, v); }
    if (token) headers.set("authorization", `Bearer ${token}`);
    return fetch(url, { method: req.method, headers, body, signal: req.signal, cache: "no-store", redirect: "manual" });
  };

  const refresh = req.cookies.get(REFRESH_COOKIE)?.value;
  let access = req.cookies.get(ACCESS_COOKIE)?.value;
  let renewed: Tokens | null = null;
  let refreshFailed = false;
  // O cookie do access some antes do token vencer: renova antes, sem gastar uma ida que daria 401.
  if (!access && refresh) {
    renewed = await refreshTokens(refresh);
    refreshFailed = !renewed;
    access = renewed?.access_token;
  }

  let upstream: Response;
  try {
    upstream = await forward(access);
    if (upstream.status === 401 && refresh && !renewed && !refreshFailed) {
      renewed = await refreshTokens(refresh);
      refreshFailed = !renewed;
      if (renewed) upstream = await forward(renewed.access_token);
    }
  } catch {
    if (req.signal.aborted) return new NextResponse(null, { status: 499 });
    return NextResponse.json({ detail: "Não foi possível falar com o servidor do LetsGrow agora." }, { status: 502 });
  }

  const headers = new Headers();
  for (const name of PASS_RESPONSE) { const v = upstream.headers.get(name); if (v) headers.set(name, v); }
  // no-transform: a compressão do Next não pode segurar o SSE em buffer.
  headers.set("cache-control", "no-store, no-transform");
  if (headers.get("content-type")?.startsWith("text/event-stream")) headers.set("x-accel-buffering", "no");

  const res = new NextResponse(upstream.body, { status: upstream.status, headers });
  if (renewed) setSession(res, renewed);
  else if (refreshFailed || (upstream.status === 401 && !refresh)) clearSession(res);
  return res;
}

export { handle as GET, handle as POST, handle as PATCH, handle as PUT, handle as DELETE };
