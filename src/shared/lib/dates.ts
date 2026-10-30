// Copiado de letsgrow-mobile/lib/dates.ts por scripts/sync-shared.mjs. Não edite aqui.
function localDateFromIso(dateString: string): Date {
  const [datePart] = dateString.split('T')
  const [year, month, day] = datePart.split('-').map(Number)

  if (!year || !month || !day) return new Date(dateString)

  return new Date(year, month - 1, day)
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function daysSinceDate(dateString: string): number {
  const start = startOfLocalDay(localDateFromIso(dateString)).getTime()
  const today = startOfLocalDay(new Date()).getTime()
  return Math.max(0, Math.floor((today - start) / 86400000))
}

export function daysAgoToLocalDate(daysString: string): string | null {
  const days = parseInt(daysString, 10)
  if (Number.isNaN(days) || days < 0) return null

  const date = startOfLocalDay(new Date())
  date.setDate(date.getDate() - days)

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function todayLocalDate(): string {
  return daysAgoToLocalDate('0')!
}

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
function validDate(iso?: string | null): Date | null {
  if (!iso) return null
  const date = new Date(iso)
  return Number.isFinite(date.getTime()) ? date : null
}
const pad = (n: number) => String(n).padStart(2, '0')

/** "14 out" — Figma short date. Null when the source date is missing or invalid. */
export function shortDayMonth(iso?: string | null): string | null {
  const date = validDate(iso)
  return date ? `${date.getDate()} ${MONTHS[date.getMonth()]}` : null
}

/** "14 out · 18:20" — Figma date with time, local timezone. */
export function dayMonthTime(iso?: string | null, separator = ' · '): string | null {
  const date = validDate(iso)
  return date ? `${shortDayMonth(iso)}${separator}${pad(date.getHours())}:${pad(date.getMinutes())}` : null
}

/** "15 out 2026 · 09:40" — form fields in the Figma. */
export function fullDateTime(iso?: string | null): string | null {
  const date = validDate(iso)
  return date ? `${shortDayMonth(iso)} ${date.getFullYear()} · ${pad(date.getHours())}:${pad(date.getMinutes())}` : null
}

/** "26/07/2026" → "2026-07-26"; null for empty or impossible dates (never guessed). */
export function parseBrDate(text: string): string | null | 'invalid' {
  const value = text.trim()
  if (!value) return null
  const m = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return 'invalid'
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const date = new Date(y, mo - 1, d)
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d || date.getTime() > Date.now()) return 'invalid'
  return `${y}-${pad(mo)}-${pad(d)}`
}
export function formatBrDate(iso?: string | null): string {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}

/** "15/10/2026 09:40" → Date (local); null for empty, impossible or future dates (never guessed). */
export function parseBrDateTime(text: string, now = new Date()): Date | null {
  const m = text.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const [d, mo, y, h, mi] = m.slice(1).map(Number)
  const date = new Date(y, mo - 1, d, h, mi)
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d || date.getHours() !== h || date.getMinutes() !== mi) return null
  return date.getTime() <= now.getTime() + 5 * 60_000 ? date : null
}

/** Date → "15/10/2026 09:40" (local), the editable counterpart of fullDateTime. */
export function brDateTimeText(date: Date): string {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
