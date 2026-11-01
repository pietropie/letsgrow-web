// Copiado de letsgrow-mobile/lib/errors.ts por scripts/sync-shared.mjs. Não edite aqui.
/**
 * Extrai uma mensagem de erro segura para exibição a partir de um erro do Axios.
 *
 * O backend (FastAPI) pode retornar `detail` em formatos diferentes:
 * - string simples: "Credenciais inválidas"
 * - array de erros de validação do Pydantic: [{ type, loc, msg, input, ctx }, ...]
 *
 * Renderizar esses objetos diretamente como children do React causa o erro
 * "Objects are not valid as a React child". Esta função sempre retorna uma string.
 */
export function getErrorMessage(error: unknown, fallback = 'Algo deu errado. Tente novamente.'): string {
  const detail = (error as any)?.response?.data?.detail

  if (typeof detail === 'string') return detail

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => (item && typeof item === 'object' ? item.msg : item))
      .filter((msg) => typeof msg === 'string')
    if (messages.length > 0) return messages.join('\n')
  }

  if (detail && typeof detail === 'object' && typeof detail.msg === 'string') {
    return detail.msg
  }

  // Erros de créditos/pagamentos: {code, message}
  if (detail && typeof detail === 'object' && typeof detail.message === 'string') {
    return detail.message
  }

  const message = (error as any)?.message
  if (typeof message === 'string' && message.length > 0) return message

  return fallback
}

/**
 * Mensagem de limite de plano (403 de app/services/subscription.py: grows, vasos, plantas,
 * consultas do Bobby, sensores), exatamente como o backend enviou. Outros 403 (conta inativa,
 * e-mail não verificado, item de outro usuário) não citam plano nem upgrade e retornam null.
 */
export function planLimitMessage(error: unknown): string | null {
  const response = (error as { response?: { status?: number; data?: { detail?: unknown } } })?.response
  const detail = response?.data?.detail
  if (response?.status !== 403 || typeof detail !== 'string') return null
  return /\bplano\b|\bupgrade\b/i.test(detail) ? detail : null
}

/**
 * Motivo enviado pelo servidor quando ele recusou o pedido (4xx com `detail` legível).
 * Sem resposta (rede, timeout) ou 5xx é falha técnica: retorna null para a tela usar o texto genérico.
 */
export function rejectionMessage(error: unknown): string | null {
  const status = (error as { response?: { status?: number } })?.response?.status
  if (typeof status !== 'number' || status < 400 || status >= 500) return null
  const message = getErrorMessage({ response: (error as { response?: unknown }).response }, '')
  return message || null
}
