/**
 * Proteção da API, fase 1 (16 nov): o BFF chama a API pelo endereço público, então a API veria todos os usuários do
 * web com um IP só. Com o segredo compartilhado, cada chamada leva o IP do navegador e a chave do BFF; o backend só
 * confia no IP quando a chave confere. Sem `BFF_SHARED_SECRET`, nenhum dos dois cabeçalhos vai.
 * Só do servidor: o segredo nunca vai para o cliente nem para um log. Lib pura, testada em tests/bffHeaders.test.cjs.
 */
export const CLIENT_IP_HEADER = "X-LetsGrow-Client-IP";
export const BFF_KEY_HEADER = "X-LetsGrow-BFF-Key";

type HeaderSource = { get(name: string): string | null } | null | undefined;

/** O Traefik entrega `x-forwarded-for` só com o IP do cliente; se vier uma lista, vale o último (o que ele pôs). */
export function clientIp(headers: HeaderSource): string | null {
  const forwarded = headers?.get("x-forwarded-for");
  if (forwarded) {
    const last = forwarded.split(",").map(s => s.trim()).filter(Boolean).pop();
    if (last) return last;
  }
  return headers?.get("x-real-ip")?.trim() || null;
}

export function bffHeaders(incoming: HeaderSource, secret: string | undefined): Record<string, string> {
  if (!secret) return {};
  const ip = clientIp(incoming);
  return { [BFF_KEY_HEADER]: secret, ...(ip ? { [CLIENT_IP_HEADER]: ip } : {}) };
}
