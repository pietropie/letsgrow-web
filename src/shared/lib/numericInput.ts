// Copiado de letsgrow-mobile/lib/numericInput.ts por scripts/sync-shared.mjs. Não edite aqui.
/** Numeric text fields: what may be typed, which keyboard opens and how the text becomes a number. */
export type NumericKind = 'integer' | 'decimal' | 'signed-decimal'

/**
 * Keeps only what the kind allows: digits; for decimals one separator (comma or point, kept as typed);
 * for signed decimals a leading minus. RN's Android EditText accepts any key, so this is the real filter.
 */
export function sanitizeNumericText(text: string, kind: NumericKind): string {
  const negative = kind === 'signed-decimal' && text.trimStart().startsWith('-')
  let out = ''
  let separator = false
  for (const ch of text) {
    if (ch >= '0' && ch <= '9') out += ch
    else if ((ch === ',' || ch === '.') && kind !== 'integer' && !separator) { out += ch; separator = true }
  }
  return negative ? `-${out}` : out
}

/** '' → null; '28,5' → 28.5 (point for the API); a lone '-' or separator → NaN. */
export function parseNumericText(text: string): number | null {
  const value = text.trim().replace(',', '.')
  if (!value) return null
  return /^-?(\d+\.?\d*|\.\d+)$/.test(value) ? Number(value) : NaN
}

/** Android: number-pad = digits only, decimal-pad adds the separator, numeric adds the minus. inputMode serves the web build. */
export function numericKeyboard(kind: NumericKind) {
  if (kind === 'integer') return { keyboardType: 'number-pad', inputMode: 'numeric' } as const
  if (kind === 'decimal') return { keyboardType: 'decimal-pad', inputMode: 'decimal' } as const
  // inputMode would override keyboardType with the unsigned decimal-pad.
  return { keyboardType: 'numeric', inputMode: undefined } as const
}

/** Payload value: the parsed number, or null when the field is blank or holds only '-' / a separator. */
export function toApiNumber(text: string): number | null {
  const value = parseNumericText(text)
  return value != null && Number.isFinite(value) ? value : null
}
