/**
 * Cliente do navegador. Tudo passa por /api/bff (src/app/api/bff), que guarda o JWT em cookie httpOnly:
 * o navegador nunca vê o token. Os erros têm o formato do axios ({ response: { status, data } }) para
 * src/shared/lib/errors.ts funcionar igual ao mobile.
 */
export const WEB_HEADER = "X-LG-Web";

export class ApiError extends Error {
  response: { status: number; data: unknown };
  constructor(status: number, data: unknown) {
    super(`HTTP ${status}`);
    this.name = "ApiError";
    this.response = { status, data };
  }
}

/** `stayOn401`: páginas públicas (excluir-conta) tratam a sessão vencida sem sair da tela. */
type Options = { method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"; body?: unknown; signal?: AbortSignal; stayOn401?: boolean };

async function readBody(res: Response): Promise<unknown> {
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

/** Sessão vencida em qualquer chamada: volta para Entrar e depois para a mesma tela. */
function toLogin() {
  if (typeof window === "undefined" || window.location.pathname === "/entrar") return;
  const back = window.location.pathname + window.location.search;
  window.location.assign(`/entrar?de=${encodeURIComponent(back)}`);
}

export async function request(path: string, { method = "GET", body, signal, stayOn401 = false }: Options = {}): Promise<{ data: unknown; headers: Headers }> {
  let res: Response;
  try {
    res = await fetch(`/api/bff${path}`, {
      method, signal, cache: "no-store",
      headers: { [WEB_HEADER]: "1", ...(body !== undefined && { "Content-Type": "application/json" }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new Error("Sem conexão com o servidor. Confira sua internet e tente de novo.");
  }
  const data = await readBody(res);
  if (res.status === 401 && !stayOn401 && !path.startsWith("/auth/")) toLogin();
  if (!res.ok) throw new ApiError(res.status, data);
  return { data, headers: res.headers };
}

export async function api<T>(path: string, options?: Options): Promise<T> {
  return (await request(path, options)).data as T;
}

/** Entrar e confirmar e-mail vão por rotas próprias, que gravam os cookies. */
export async function authAction<T = unknown>(action: "login" | "verify-email" | "logout", body?: unknown): Promise<T> {
  const res = await fetch(`/api/auth/${action}`, {
    method: "POST", cache: "no-store",
    headers: { [WEB_HEADER]: "1", "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const data = await readBody(res);
  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}
