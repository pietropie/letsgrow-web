// Copiado de letsgrow-mobile/lib/homeClimate.ts por scripts/sync-shared.mjs. Não edite aqui.
/**
 * The new Início (UX item 11, Figma "Início 2026" H1–H9): weather outside × the environment inside, what needs
 * attention, the selected environment and the place where it is. Pure: no runtime imports, so the Node tests cover it.
 */

const WEEKDAY = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTH_LONG = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const MONTH_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const pad = (n: number) => String(n).padStart(2, '0')
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
const localDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

/** "Ter, 27 de outubro" under the greeting (H1). */
export function greetingDate(now = new Date()): string {
  return `${WEEKDAY[now.getDay()]}, ${now.getDate()} de ${MONTH_LONG[now.getMonth()]}`
}

/** "12:17" today, "19 out" before (the reading's own date stays visible when it is old). */
export function stamp(iso?: string | null, now = new Date()): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return sameDay(d, now) ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`
}

// ── Weather card states (GET /weather?grow_id=) ──────────────────────────────────────────────────────────────────

export type Weather = {
  temperature: number; feels_like?: number; humidity: number; weather_code: number; weather_description: string; is_day: boolean
  temp_max?: number | null; temp_min?: number | null; precipitation_probability_max?: number | null; fetched_at?: string | null
  /** IANA zone of the place and its offset ("America/Sao_Paulo", -10800). */
  timezone?: string | null; utc_offset_seconds?: number | null
  /**
   * Bobby tip "lá fora × dentro" (rules R1–R7 of bob_weather.py, never the LLM): only for an indoor environment, weather
   * under 1 h old and a reading inside from the last 6 h; null otherwise.
   */
  weather_tip?: WeatherTip | null
}
/** Chat source format; kinds: weather, environment_reading, event, sensor_reading, target, plant (phase), light_schedule. */
export type TipSource = { kind: string; id?: string; title: string; date?: string | null }
export type WeatherTip = { rule_id: string; title: string; body: string; severity: 'info' | 'attention'; sources: TipSource[]; cta_prompt: string }
export type WeatherCard = 'loading' | 'ok' | 'no_location' | 'unavailable' | 'not_found'

/**
 * State of the weather card from the request: 409 = the environment has no place (H2); 404 = not this account's
 * environment; 502/504, network and any other failure = the service did not answer (H5).
 */
export function weatherCard(result: { pending?: boolean; data?: unknown; status?: number | null; failed?: boolean }): WeatherCard {
  if (result.data) return 'ok'
  if (!result.failed) return 'loading'
  if (result.status === 409) return 'no_location'
  if (result.status === 404) return 'not_found'
  return 'unavailable'
}

/** Whole degrees and points, as the Figma draws them ("31°", "45%"). */
export const whole = (v: number) => Math.round(v)

/**
 * "máx 33° · mín 19°"; empty without the day's range. The humidity left this line (user's request of 2026-11-01):
 * it shows in its own display, next to the temperature.
 */
export function outdoorLine(w: Pick<Weather, 'temp_max' | 'temp_min'>): string {
  return w.temp_max != null && w.temp_min != null ? `máx ${whole(w.temp_max)}° · mín ${whole(w.temp_min)}°` : ''
}

export type CompareRow = { text: string; tag: string; tone: 'cooler' | 'warmer' | 'same' | 'more' | 'less' }
/**
 * Outside × inside, only facts (H1): "31 °C lá fora → 25 °C dentro" with "6 °C MAIS FRESCO DENTRO", and
 * "45 % lá fora → 60 % dentro" with "+15 PONTOS DENTRO". A side without a value has no row.
 */
export function compareClimate(out: { t: number; rh: number }, inside: { t: number | null; rh: number | null }): { temperature: CompareRow | null; humidity: CompareRow | null } {
  const ot = whole(out.t), orh = whole(out.rh)
  let temperature: CompareRow | null = null
  if (inside.t != null) {
    const it = whole(inside.t), d = it - ot
    temperature = { text: `${ot} °C lá fora → ${it} °C dentro`, tone: d < 0 ? 'cooler' : d > 0 ? 'warmer' : 'same',
      tag: d < 0 ? `${-d} °C MAIS FRESCO DENTRO` : d > 0 ? `${d} °C MAIS QUENTE DENTRO` : 'MESMA TEMPERATURA' }
  }
  let humidity: CompareRow | null = null
  if (inside.rh != null) {
    const irh = whole(inside.rh), d = irh - orh
    humidity = { text: `${orh} % lá fora → ${irh} % dentro`, tone: d > 0 ? 'more' : d < 0 ? 'less' : 'same',
      tag: d > 0 ? `+${d} ${d === 1 ? 'PONTO' : 'PONTOS'} DENTRO` : d < 0 ? `−${-d} ${d === -1 ? 'PONTO' : 'PONTOS'} DENTRO` : 'MESMA UMIDADE' }
  }
  return { temperature, humidity }
}

const SOURCE_TEXT: Record<string, string> = { manual: 'registro manual', sensor: 'sensor' }
/**
 * The line under the block (H1, H3). With the Bobby tip the rule is named; without it, where each side comes from:
 * "Lá fora: Open-Meteo · 12:30. Dentro: registro manual · 12:17. A comparação não liga nem regula equipamentos."
 */
export function climateFooter(opts: { fetchedAt?: string | null; inside?: { source?: string | null; observedAt?: string | null } | null; tip: boolean; now?: Date }): string {
  if (opts.tip) return 'A dica é uma regra do Bobby com os dados acima. Não liga nem regula equipamentos.'
  const out = ['Lá fora: Open-Meteo', stamp(opts.fetchedAt, opts.now)].filter(Boolean).join(' · ')
  const src = opts.inside?.source ? SOURCE_TEXT[opts.inside.source] ?? opts.inside.source : null
  const inside = src ? ['Dentro: ' + src, stamp(opts.inside?.observedAt, opts.now)].filter(Boolean).join(' · ') + '. ' : ''
  return `${out}. ${inside}A comparação não liga nem regula equipamentos.`
}

/** "Com base em: …" of the Bobby tip, from its sources (the chat format): each title with its time. */
export function tipBasis(sources: TipSource[], now = new Date()): string {
  const items = sources.map(s => { const at = stamp(s.date, now); return at ? `${s.title} às ${at}` : s.title })
  return items.length ? `Com base em: ${items.join(' · ')}` : ''
}

/** Day or night, and the WMO code: only the Figma's partly cloudy day icon exists; the night uses the panel's moon. */
export function weatherIcon(w: Pick<Weather, 'is_day' | 'weather_code'>): 'day' | 'night' | null {
  if (!w.is_day) return 'night'
  return w.weather_code <= 3 ? 'day' : null
}

// ── Precisa de atenção ───────────────────────────────────────────────────────────────────────────────────────────

export type AttentionItem = { key: string; title: string; tag: 'AMBIENTE' | 'REGA' | 'BOBBY'; meta: string; target: { kind: 'grow' | 'diary' | 'observation'; id: string } }
type Reading = { value: number | null; source?: string | null; observed_at?: string | null }
type Alert = { alert_id: string; plant_id: string; plant_name: string; action?: string; message: string; tier: string; evidence?: unknown[] }

/** A reading older than this does not raise an item (the same gate as the Bobby tip, rule R8). */
export const STALE_MS = 6 * 3600_000
/** Distance from the target that counts as outside it: 2 °C and 3 points (the spec's rules R6 and R1). */
export const TEMP_MARGIN = 2, RH_MARGIN = 3
const TIER_ORDER: Record<string, number> = { critical: 0, anomaly: 1, attention: 2, warning: 2, info: 3 }

/**
 * Up to three items and the total (H1): readings outside the defined target, then Bobby's alerts of the environment's
 * plants by tier. Watering alerts become REGA (with the last watering), temperature/humidity alerts AMBIENTE (unless
 * the app already raised that indicator) and the others BOBBY.
 */
export function attentionItems(input: {
  growId: string; growName: string
  temperature: Reading; humidity: Reading; targetTemp?: number | null; targetRh?: number | null
  alerts: Alert[]; lastWatering?: Record<string, string | null | undefined>; now?: Date
}): { items: AttentionItem[]; total: number } {
  const now = input.now ?? new Date()
  const fresh = (r: Reading) => r.value != null && !!r.observed_at && now.getTime() - new Date(r.observed_at).getTime() <= STALE_MS
  const out: AttentionItem[] = []
  const raised = new Set<string>()
  const reading = (metric: 'temperature' | 'humidity', r: Reading, target: number | null | undefined, margin: number, unit: string, label: string) => {
    if (target == null || !fresh(r)) return
    const d = r.value! - target
    if (Math.abs(d) <= margin) return
    raised.add(metric)
    const src = r.source ? `${r.source === 'sensor' ? 'sensor' : 'manual'} ${stamp(r.observed_at, now)}` : stamp(r.observed_at, now)
    out.push({ key: `range-${metric}`, tag: 'AMBIENTE', title: `${label} da ${input.growName} ${d > 0 ? 'acima' : 'abaixo'} da faixa`,
      meta: [`${whole(r.value!)}${unit}`, `faixa ${whole(target)}${unit}`, src].filter(Boolean).join(' · '), target: { kind: 'grow', id: input.growId } })
  }
  reading('temperature', input.temperature, input.targetTemp, TEMP_MARGIN, ' °C', 'Temperatura')
  reading('humidity', input.humidity, input.targetRh, RH_MARGIN, ' %', 'Umidade')
  const alerts = [...input.alerts].sort((a, b) => (TIER_ORDER[a.tier] ?? 9) - (TIER_ORDER[b.tier] ?? 9))
  for (const a of alerts) {
    if ((a.action === 'temperature' || a.action === 'humidity') && raised.has(a.action)) continue
    if (a.action === 'watering') {
      const last = input.lastWatering?.[a.plant_id]
      const days = last ? Math.round((localDay(now) - localDay(new Date(last))) / 86400000) : null
      const when = last ? [days === 0 ? 'hoje' : days === 1 ? 'ontem' : `há ${days} dias`, stamp(last, now)].join(' · ') : null
      out.push({ key: a.alert_id, tag: 'REGA', title: `Rega da ${a.plant_name}`, meta: when ? `última ${when}` : a.message, target: { kind: 'diary', id: a.plant_id } })
    } else if (a.action === 'temperature' || a.action === 'humidity') {
      out.push({ key: a.alert_id, tag: 'AMBIENTE', title: a.message, meta: a.plant_name, target: { kind: 'grow', id: input.growId } })
    } else {
      const n = a.evidence?.length ?? 0
      out.push({ key: a.alert_id, tag: 'BOBBY', title: a.message, meta: n ? `Bobby · ${n} ${n === 1 ? 'registro' : 'registros'}` : `Bobby · ${a.plant_name}`, target: { kind: 'observation', id: a.plant_id } })
    }
  }
  return { items: out.slice(0, 3), total: out.length }
}

// ── Environment picker (H7) and place ────────────────────────────────────────────────────────────────────────────

/** "Campinas, SP · 2 plantas · 25 ° · 60 %", or "Sem local · 1 planta · sem leitura". */
export function growChoiceLine(g: { location_label?: string | null; lat?: number | null; active_plant_count: number }, t: number | null, rh: number | null): string {
  const place = g.location_label || (g.lat != null ? 'Local do ambiente' : 'Sem local')
  const plants = `${g.active_plant_count} ${g.active_plant_count === 1 ? 'planta' : 'plantas'}`
  const reading = t == null && rh == null ? 'sem leitura' : [t != null && `${whole(t)} °`, rh != null && `${whole(rh)} %`].filter(Boolean).join(' · ')
  return [place, plants, reading].join(' · ')
}

/** The environment shown: the remembered one while it is active, else the first. One at a time (user decision 4). */
export function pickGrow<G extends { id: string }>(grows: G[], remembered: string | null): G | null {
  return grows.find(g => g.id === remembered) ?? grows[0] ?? null
}

/** Coordinates go up with 2 decimals (≈1 km), as the server keeps them. */
export const roundCoord = (v: number) => Math.round(v * 100) / 100

const BR_STATES: Record<string, string> = {
  'Acre': 'AC', 'Alagoas': 'AL', 'Amapá': 'AP', 'Amazonas': 'AM', 'Bahia': 'BA', 'Ceará': 'CE', 'Distrito Federal': 'DF',
  'Espírito Santo': 'ES', 'Goiás': 'GO', 'Maranhão': 'MA', 'Mato Grosso': 'MT', 'Mato Grosso do Sul': 'MS', 'Minas Gerais': 'MG',
  'Pará': 'PA', 'Paraíba': 'PB', 'Paraná': 'PR', 'Pernambuco': 'PE', 'Piauí': 'PI', 'Rio de Janeiro': 'RJ', 'Rio Grande do Norte': 'RN',
  'Rio Grande do Sul': 'RS', 'Rondônia': 'RO', 'Roraima': 'RR', 'Santa Catarina': 'SC', 'São Paulo': 'SP', 'Sergipe': 'SE', 'Tocantins': 'TO',
}
/**
 * Name of a place from the device's reverse geocoding (the server does not reverse geocode), written like the
 * server's labels: "Campinas, SP" in Brazil, "City, Region" elsewhere; null when there is no city.
 */
export function placeLabel(a: { city?: string | null; subregion?: string | null; district?: string | null; region?: string | null; isoCountryCode?: string | null; country?: string | null } | null | undefined): string | null {
  const name = a?.city || a?.subregion || a?.district
  if (!name) return null
  const region = a?.isoCountryCode === 'BR' ? (a.region ? BR_STATES[a.region] ?? a.region : null) : a?.region || a?.country
  return (region && region !== name ? `${name}, ${region}` : name).slice(0, 120)
}

/** "último registro {quando}" (UX item 9, U5); null while the server does not send `last_event_at`. */
export function lastRecordLine(lastEventAt: string | null | undefined, now = new Date()): string | null {
  if (lastEventAt === undefined) return null
  if (lastEventAt === null) return 'nenhum registro ainda'
  const d = new Date(lastEventAt)
  const days = Math.round((localDay(now) - localDay(d)) / 86400000)
  if (days <= 0) return `último registro hoje às ${pad(d.getHours())}:${pad(d.getMinutes())}`
  if (days === 1) return 'último registro ontem'
  if (days < 7) return `último registro há ${days} dias`
  return `último registro em ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}${d.getFullYear() !== now.getFullYear() ? ` ${d.getFullYear()}` : ''}`
}

/**
 * After the "use my location" tap (H2/H3): granted reads the position once; denied goes straight to the city search
 * (H4) without asking again; denied for good also offers the device settings, and the search stays available.
 */
export function locationOutcome(permission: { status: string; canAskAgain?: boolean }): 'locate' | 'search' | 'search_with_settings' {
  if (permission.status === 'granted') return 'locate'
  return permission.canAskAgain === false ? 'search_with_settings' : 'search'
}
