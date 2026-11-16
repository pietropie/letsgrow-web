/**
 * Entrada no painel (UX item 25; Figma 2431:23980, W7p, W8p, L2e, L4–L6): o que cada erro do backend vira na tela.
 * O erro geral vai na caixa vermelha com o marcador rosa (título curto) e uma frase que diz o que fazer; o de campo
 * marca a caixa do campo. Lib pura (sem imports), testada em tests/entry.test.cjs. Os textos do servidor
 * (letsgrow-backend app/api/v1/auth.py) estão conferidos: 401 "Credenciais inválidas", 403 "Conta inativa",
 * 409 "Email ou username já em uso", 400 "Código inválido ou expirado", 403 "email_not_verified".
 */
export type EntryField = "email" | "password" | "confirmation" | "code" | "adult";
export type EntryError = { title: string; body?: string; fields: EntryField[] };

type Raw = { response?: { status?: number; data?: { detail?: unknown } } } | null | undefined;

function status(err: unknown) { return (err as Raw)?.response?.status; }
function detail(err: unknown): string | null {
  const d = (err as Raw)?.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) { const m = (d[0] as { msg?: unknown })?.msg; return typeof m === "string" ? m : null; }
  return null;
}
function offline(err: unknown) { return !status(err) && err instanceof Error && /conexão/i.test(err.message); }

const NETWORK: EntryError = { title: "Sem conexão", body: "Confira sua internet e tente de novo.", fields: [] };
const BUSY: EntryError = { title: "Muitas tentativas", body: "Espere um pouco e tente de novo.", fields: [] };

export function loginError(err: unknown): EntryError {
  const s = status(err);
  if (offline(err)) return NETWORK;
  if (s === 401) return { title: "E-mail ou senha incorretos", body: "Confira os dados e tente de novo. Se esqueceu a senha, dá para criar outra em um minuto.", fields: ["email", "password"] };
  if (s === 403 && detail(err) === "Conta inativa") return { title: "Conta inativa", body: "Esta conta foi desativada e não pode entrar.", fields: [] };
  if (s === 429) return BUSY;
  return { title: "Não foi possível entrar", body: detail(err) ?? "Tente de novo em instantes.", fields: [] };
}

export function registerError(err: unknown): EntryError {
  const s = status(err);
  if (offline(err)) return NETWORK;
  if (s === 409) return { title: "E-mail já cadastrado", body: "Entre com este e-mail ou recupere a senha.", fields: ["email"] };
  if (s === 429) return BUSY;
  if (s === 422) return { title: "Confira os dados", body: detail(err) ?? "Algum campo não foi aceito.", fields: [] };
  return { title: "Não foi possível criar a conta", body: detail(err) ?? "Tente de novo em instantes.", fields: [] };
}

/** Confirmar e-mail e redefinir senha: o código errado ou vencido marca o mostrador. */
export function codeError(err: unknown): EntryError {
  const s = status(err);
  if (offline(err)) return NETWORK;
  if (s === 429) return BUSY;
  if (s === 400 || s === 404 || /código/i.test(detail(err) ?? "")) return { title: "Código inválido ou expirado", body: "Confira os 6 dígitos ou peça um novo código.", fields: ["code"] };
  if (s === 422 && /senha/i.test(detail(err) ?? "")) return { title: "Senha curta", body: detail(err)!, fields: ["password"] };
  return { title: "Não foi possível confirmar", body: detail(err) ?? "Tente de novo em instantes.", fields: [] };
}

/** Validação antes de enviar, com o mesmo formato dos erros do servidor. */
export function localError(title: string, fields: EntryField[], body?: string): EntryError {
  return { title, body, fields };
}

/** Seis células do mostrador: o dígito ou vazio. */
export function codeCells(code: string): (string | null)[] {
  const digits = code.replace(/\D/g, "").slice(0, 6);
  return Array.from({ length: 6 }, (_, i) => digits[i] ?? null);
}
