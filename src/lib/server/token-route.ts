import { NextRequest, NextResponse } from "next/server";
import { API_URL, isTrustedWrite, setSession } from "./session";

/**
 * Rotas da API que devolvem tokens (entrar, confirmar e-mail): o Next guarda os tokens em cookie e
 * responde só { ok: true }. Erros (401, 403 email_not_verified, 400 código inválido) passam como vieram.
 */
export function tokenRoute(apiPath: string) {
  return async function POST(req: NextRequest) {
    if (!isTrustedWrite(req)) return NextResponse.json({ detail: "Origem não permitida" }, { status: 403 });
    let upstream: Response;
    try {
      upstream = await fetch(`${API_URL}${apiPath}`, {
        method: "POST", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: await req.text(),
      });
    } catch {
      return NextResponse.json({ detail: "Não foi possível falar com o servidor do LetsGrow agora." }, { status: 502 });
    }
    const data = await upstream.json().catch(() => null);
    if (!upstream.ok || !data?.access_token || !data?.refresh_token) {
      return NextResponse.json(data ?? { detail: "Resposta inesperada do servidor." }, { status: upstream.ok ? 502 : upstream.status });
    }
    const res = NextResponse.json({ ok: true });
    setSession(res, data);
    return res;
  };
}
