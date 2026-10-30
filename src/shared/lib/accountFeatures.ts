// Copiado de letsgrow-mobile/lib/accountFeatures.ts por scripts/sync-shared.mjs. Não edite aqui.
import type { BobEvidence, CreditHistoryItem, NotificationPreferences } from '../types/features'

// Same output as lib/dates.ts. Kept local so `node --test` loads this file without a bundler.
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const pad = (n: number) => String(n).padStart(2, '0')
function validDate(iso?: string | null): Date | null {
  if (!iso) return null
  const date = new Date(iso)
  return Number.isFinite(date.getTime()) ? date : null
}
function shortDayMonth(iso?: string | null): string | null {
  const date = validDate(iso)
  return date ? `${date.getDate()} ${MONTHS[date.getMonth()]}` : null
}
function dayMonthTime(iso?: string | null): string | null {
  const date = validDate(iso)
  return date ? `${shortDayMonth(iso)} · ${pad(date.getHours())}:${pad(date.getMinutes())}` : null
}

// ── Base da observação ──────────────────────────────────────────────────────

const VALUE_LABELS: Record<string, (v: number) => string> = {
  temperature_c: v => `Temperatura: ${formatNumber(v)} °C`,
  humidity_rh: v => `Umidade: ${formatNumber(v)}%`,
  ppm: v => `PPM: ${formatNumber(v)}`,
  ph_in: v => `pH: ${formatNumber(v)}`,
  ec_out: v => `EC de saída: ${formatNumber(v)} mS/cm`,
  water_volume_ml: v => `Volume: ${formatNumber(v)} ml`,
}

const EVENT_LABELS: Record<string, string> = {
  watering: 'Rega', rega: 'Rega', feeding: 'Nutrição', nutrients: 'Nutrição', note: 'Nota', observation: 'Observação',
  environment: 'Ambiente', training: 'Treino', topping: 'Topping', flip: 'Virada para flora', defoliation: 'Desfolha',
}

const PHASE_LABELS: Record<string, string> = { veg: 'vegetativa', flower: 'floração', seedling: 'muda', unknown: 'não informada' }

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace('.', ',')
}

/** "14 out · 18:20" for dated records; plant data has no observation time. */
export function evidenceTitle(e: BobEvidence): string {
  if (e.kind === 'plant') return 'Dados cadastrados na planta'
  return dayMonthTime(e.observed_at) ?? 'Data não informada'
}

/** Lines shown under each record, only with the values the record actually has. */
export function evidenceLines(e: BobEvidence): string[] {
  const lines: string[] = []
  if (e.kind === 'event' && typeof e.values.event_type === 'string') lines.push(EVENT_LABELS[e.values.event_type] ?? 'Registro do diário')
  for (const [key, format] of Object.entries(VALUE_LABELS)) {
    const value = e.values[key]
    if (typeof value === 'number' && Number.isFinite(value)) lines.push(format(value))
  }
  if (e.kind === 'plant') {
    const { current_phase, germination_date, flip_date, expected_harvest_days } = e.values
    if (typeof current_phase === 'string') lines.push(`Fase: ${PHASE_LABELS[current_phase] ?? current_phase}`)
    if (typeof germination_date === 'string') lines.push(`Germinação: ${shortDayMonth(germination_date + 'T12:00:00')}`)
    if (typeof flip_date === 'string') lines.push(`Início da flora: ${shortDayMonth(flip_date + 'T12:00:00')}`)
    if (typeof expected_harvest_days === 'number') lines.push(`Previsão de colheita: ${expected_harvest_days} dias de flora`)
  }
  if (typeof e.values.notes === 'string' && e.values.notes) lines.push(`“${e.values.notes}”`)
  return lines
}

export function evidenceSource(e: BobEvidence): string {
  if (e.kind === 'sensor_reading' || e.source === 'sensor') return 'Fonte: sensor'
  if (e.kind === 'plant') return 'Fonte: cadastro da planta'
  return 'Fonte: registro manual'
}

/** First record the user can correct by hand (sensor readings cannot be edited). */
export function firstManualEvidence(list: BobEvidence[]): BobEvidence | null {
  return list.find(e => e.kind === 'environment_reading' || (e.kind === 'event' && !!e.plant_id) || e.kind === 'plant') ?? null
}

/** True when the cited records come from different moments or sources (Figma note under the list). */
export function mixedEvidence(list: BobEvidence[]): boolean {
  const dated = list.filter(e => e.observed_at)
  return new Set(dated.map(e => e.observed_at)).size > 1 || new Set(list.map(evidenceSource)).size > 1
}

// ── Acompanhamento ──────────────────────────────────────────────────────────

/** "19:00" → "19:00"; "7:5" or "25:00" → null. */
export function parseClock(text: string): string | null {
  const m = text.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const [h, mi] = [Number(m[1]), Number(m[2])]
  return h < 24 && mi < 60 ? `${String(h).padStart(2, '0')}:${m[2]}` : null
}

/** "21:00 às 08:00" → { start, end }; empty → null (no quiet hours); anything else → 'invalid'. */
export function parseQuietRange(text: string): { start: string; end: string } | null | 'invalid' {
  const value = text.trim()
  if (!value) return null
  const m = value.match(/^(\S+)\s*(?:às|as|a|-|–)\s*(\S+)$/i)
  if (!m) return 'invalid'
  const start = parseClock(m[1])
  const end = parseClock(m[2])
  if (!start || !end || start === end) return 'invalid'
  return { start, end }
}

export function quietRangeText(prefs: Pick<NotificationPreferences, 'quiet_start' | 'quiet_end'>): string {
  return prefs.quiet_start && prefs.quiet_end ? `${prefs.quiet_start} às ${prefs.quiet_end}` : ''
}

function minutes(clock: string): number {
  const [h, m] = clock.split(':').map(Number)
  return h * 60 + m
}

/** Same rule as the server: [start, end) and the window may cross midnight. */
export function clockInQuietRange(clock: string, range: { start: string; end: string }): boolean {
  const [t, s, e] = [minutes(clock), minutes(range.start), minutes(range.end)]
  return s < e ? t >= s && t < e : t >= s || t < e
}

export function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo'
  } catch {
    return 'America/Sao_Paulo'
  }
}

// ── Créditos ────────────────────────────────────────────────────────────────

export function formatBRL(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`
}

export function validityText(days: number | null): string {
  if (days == null) return 'Sem prazo de validade'
  if (days % 365 === 0) return `Validade: ${days / 365 === 1 ? '12 meses' : `${days / 365} anos`} após a compra`
  if (days % 30 === 0) return `Validade: ${days / 30} ${days / 30 === 1 ? 'mês' : 'meses'} após a compra`
  return `Validade: ${days} dias após a compra`
}

/** Card texts for one history entry, following "Histórico de créditos" (2160:8625). */
export function historyCard(item: CreditHistoryItem): { title: string; body: string; meta: string } {
  const day = shortDayMonth(item.occurred_at) ?? ''
  const plural = (n: number) => `${n} ${n === 1 ? 'crédito' : 'créditos'}`
  if (item.type === 'task') {
    const cost = item.cost ?? 0
    if (item.status === 'released') return {
      title: `Tentativa anterior · ${day}`,
      body: `Reserva de ${plural(cost)} liberada`,
      meta: `${item.failure_reason ?? 'Sem entrega'} · consumo final: 0`,
    }
    if (item.status === 'reserved') return { title: `${item.title} · ${day}`, body: `${plural(cost)} reservados`, meta: 'Em andamento' }
    return { title: `${item.title} · ${day}`, body: `${plural(cost)} utilizados`, meta: 'Concluído' }
  }
  const signed = item.amount > 0 ? `+${plural(item.amount)}` : `−${plural(-item.amount)}`
  const meta = { grant_plan: 'Créditos do plano', purchase: 'Compra avulsa', expire: 'Validade encerrada', adjust: 'Ajuste da equipe' }[item.type]
  return { title: `${item.title} · ${day}`, body: signed, meta }
}

/** Error code sent by the server for credit checks (402/409 with detail.code). */
export function creditErrorCode(error: unknown): string | null {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
  return detail && typeof detail === 'object' && typeof (detail as { code?: unknown }).code === 'string'
    ? (detail as { code: string }).code
    : null
}
