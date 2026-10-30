import { NextRequest, NextResponse } from "next/server";
import { REFRESH_COOKIE } from "@/lib/server/session";

/** Telas abertas sem sessão. As de entrar e criar conta mandam quem já entrou para o Início. */
const PUBLIC = ["/entrar", "/criar-conta", "/confirmar-email", "/esqueci-a-senha", "/nova-senha", "/termos", "/privacidade", "/excluir-conta", "/offline"];
const GUEST_ONLY = ["/entrar", "/criar-conta"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const signedIn = Boolean(request.cookies.get(REFRESH_COOKIE)?.value);

  if (!signedIn && !PUBLIC.includes(pathname)) {
    const login = new URL("/entrar", request.url);
    if (pathname !== "/") login.searchParams.set("de", pathname + search);
    return NextResponse.redirect(login);
  }
  if (signedIn && GUEST_ONLY.includes(pathname)) return NextResponse.redirect(new URL("/", request.url));
  return NextResponse.next();
}

export const config = {
  // Fora: API do Next, arquivos do build e qualquer arquivo com extensão (ícones, manifest, sw.js).
  matcher: ["/((?!api|_next/static|_next/image|.*\\.[a-zA-Z0-9]+$).*)"],
};
