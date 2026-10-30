// Copiado de letsgrow-mobile/lib/lightSchedule.ts por scripts/sync-shared.mjs. Não edite aqui.
/**
 * Light schedule (UX-CORRECOES.md item 5, Figma 02C J–J6): the time the light turns on plus the minutes of
 * light. The off time is never stored, it is on + minutes (mod 24 h). Local wall-clock time, no time zone.
 */
export const DAY = 1440
/** Dragging on the clock snaps to the absolute 15-min grid (:00, :15, :30, :45). */
export const DRAG_STEP = 15
/** The two handles never get closer than this, on either side. */
export const MIN_GAP = 15

export const PRESETS = [
  { label: '18/6', minutes: 1080 }, { label: '12/12', minutes: 720 }, { label: '20/4', minutes: 1200 }, { label: '24/0', minutes: 1440 },
] as const

const mod = (n: number) => ((n % DAY) + DAY) % DAY
const pad = (n: number) => String(n).padStart(2, '0')

/** Clockwise degrees from 0 h at the top. */
export function minuteToAngle(minute: number): number {
  return mod(minute) / DAY * 360
}

/** Minute of the day for an angle (any range); not snapped. */
export function angleToMinute(angle: number): number {
  return (((angle % 360) + 360) % 360) / 360 * DAY
}

export function snapMinute(minute: number, step = DRAG_STEP): number {
  return mod(Math.round(minute / step) * step)
}

export function offMinute(on: number, light: number): number {
  return mod(on + light)
}

/** "06:00". */
export function formatClock(minute: number): string {
  const m = mod(Math.round(minute))
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
}

/** "06:00", "6:00:00" → minutes; anything else (or 24:00) → null. */
export function parseClock(text?: string | null): number | null {
  const match = text?.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (!match) return null
  const h = Number(match[1]), m = Number(match[2])
  return h < 24 && m < 60 ? h * 60 + m : null
}

/** Digits typed in the time box → "23:4" while typing, "23:45" when complete (Figma J3). */
export function clockDigits(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 4)
  return d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d
}

/** "17h45", "18h", "24h". */
export function durationLabel(minutes: number): string {
  const h = Math.floor(minutes / 60), m = minutes % 60
  return m ? `${h}h${pad(m)}` : `${h}h`
}

/** The text the server derives in photoperiod_hours: "18/6" for whole hours, "17h45/6h15" with minutes. */
export function photoperiodText(light: number): string {
  if (light % 60 === 0) return `${light / 60}/${(DAY - light) / 60}`
  return `${durationLabel(light)}/${durationLabel(DAY - light)}`
}

export function presetFor(light: number | null): (typeof PRESETS)[number] | null {
  return PRESETS.find(p => p.minutes === light) ?? null
}

export type Schedule = { onAt: number | null; light: number | null; incomplete: boolean }

/**
 * From the grow: photoperiod_light_minutes when the server has it, else the legacy "N/M" text (until the
 * backend is deployed). "custom" without minutes is an incomplete schedule (Figma J4): nothing is invented.
 */
export function scheduleFromGrow(grow: { photoperiod_on_at?: string | null; photoperiod_light_minutes?: number | null; photoperiod_hours?: string | null } | null | undefined): Schedule {
  const onAt = parseClock(grow?.photoperiod_on_at)
  let light = grow?.photoperiod_light_minutes ?? null
  if (light == null) {
    const m = grow?.photoperiod_hours?.match(/^(\d{1,2})\/(\d{1,2})$/)
    if (m && Number(m[1]) + Number(m[2]) === 24 && Number(m[1]) > 0) light = Number(m[1]) * 60
  }
  return { onAt, light, incomplete: grow?.photoperiod_hours === 'custom' && light == null }
}

/** Keeps a duration strictly between the two handles' minimum gaps (24/0 is a separate case). */
const clampLight = (light: number) => Math.min(DAY - MIN_GAP, Math.max(MIN_GAP, light))

export type Handle = 'on' | 'off'
/**
 * Dragging one handle to `minute` (already snapped). Moving "on" keeps "off" in place; moving "off" keeps "on".
 * The handles stay at least 15 min apart, and a jump of more than 12 h between two events (crossing the
 * other handle) is ignored, so the duration never flips from 15 min to 23h45.
 */
export function moveHandle(handle: Handle, minute: number, on: number, light: number): { on: number; light: number } {
  const off = offMinute(on, light)
  const next = handle === 'on' ? { on: minute, light: mod(off - minute) } : { on, light: mod(minute - on) }
  if (Math.abs(next.light - light) > DAY / 2) return { on, light }
  const clamped = clampLight(next.light)
  return handle === 'on' ? { on: mod(off - clamped), light: clamped } : { on, light: clamped }
}

/** Dragging the lit arc away from the handles moves both and keeps the duration. */
export function shiftSchedule(startOn: number, grabMinute: number, minute: number): number {
  return snapMinute(startOn + (minute - grabMinute))
}

/** Which handle a touch on the dark part pulls: the nearest one along the ring. */
export function nearestHandle(minute: number, on: number, light: number): Handle {
  const dist = (a: number, b: number) => { const d = mod(a - b); return Math.min(d, DAY - d) }
  return dist(minute, on) <= dist(minute, offMinute(on, light)) ? 'on' : 'off'
}

/** Whether a minute falls on the lit arc (on → off, clockwise). */
export function isLit(minute: number, on: number, light: number): boolean {
  return light >= DAY || mod(minute - on) <= light
}

/** "6 horas", "23 horas e 45 minutos", "meia-noite" — for the screen reader. */
export function spokenClock(minute: number): string {
  const m = mod(minute), h = Math.floor(m / 60), mi = m % 60
  if (m === 0) return 'meia-noite'
  const hours = h === 1 ? 'uma hora' : `${h} horas`
  return mi ? `${hours} e ${mi} ${mi === 1 ? 'minuto' : 'minutos'}` : hours
}

/** "às 6 horas", "à uma hora", "à meia-noite". */
export function atClock(minute: number): string {
  const m = mod(minute)
  return m === 0 ? 'à meia-noite' : Math.floor(m / 60) === 1 ? `à ${spokenClock(m)}` : `às ${spokenClock(m)}`
}

export function spokenDuration(minutes: number): string {
  const h = Math.floor(minutes / 60), m = minutes % 60
  const hours = h ? (h === 1 ? '1 hora' : `${h} horas`) : ''
  const mins = m ? `${m} ${m === 1 ? 'minuto' : 'minutos'}` : ''
  return [hours, mins].filter(Boolean).join(' e ')
}

/** "Luz liga às 6 horas e desliga às 23 horas e 45 minutos: 17 horas e 45 minutos de luz." */
export function scheduleSummary(onAt: number | null, light: number | null): string {
  if (light == null || (onAt == null && light < DAY)) return 'Programação de luz não definida.'
  if (light >= DAY) return 'Luz ligada 24 horas por dia.'
  return `Luz liga ${atClock(onAt!)} e desliga ${atClock(offMinute(onAt!, light))}: ${spokenDuration(light)} de luz.`
}

/** "Limpar programação" (UX item 5b, Figma J7): only with something registered, never for the legacy incomplete "custom". */
export function canClearSchedule(grow: { photoperiod_on_at?: string | null; photoperiod_light_minutes?: number | null; photoperiod_hours?: string | null } | null | undefined): boolean {
  const s = scheduleFromGrow(grow)
  return !s.incomplete && (s.onAt != null || s.light != null)
}

/** The PATCH that removes the whole schedule; photoperiod_hours is derived by the server. */
export const CLEAR_SCHEDULE = { photoperiod_on_at: null, photoperiod_light_minutes: null } as const

/** Whether the server's answer really has no schedule left (it could keep a field it does not know). */
export function scheduleCleared(grow: { photoperiod_on_at?: string | null; photoperiod_light_minutes?: number | null; photoperiod_hours?: string | null }): boolean {
  const s = scheduleFromGrow(grow)
  return s.onAt == null && s.light == null
}

export type LightNow = 'on' | 'off' | 'none'
/**
 * What the schedule says right now (timer center, UX item 2a revised 2026-10-21): "on" inside on_at → on_at +
 * minutes (through midnight; the off minute is already dark), "off" outside it, "none" without a complete
 * schedule (no minutes, no on time unless 24/0, the incomplete legacy "custom", or after clearing).
 */
export function lightNow(onAt: number | null, light: number | null, minute: number): LightNow {
  if (light == null || light <= 0) return 'none'
  if (light >= DAY) return 'on'
  if (onAt == null) return 'none'
  return mod(minute - onAt) < light ? 'on' : 'off'
}

/**
 * Panel timer ring (UX item 2c): in the light period the dark arc is the light already gone in this cycle
 * (on_at → now) and the light arc what is left (now → off). In the dark period the whole next light period is
 * light. 24/0 is a full dark ring with only "now"; without a schedule there is nothing to draw. Minutes of day.
 */
export type DialProgress =
  | { kind: 'none' }
  | { kind: 'full'; now: number }
  | { kind: 'cycle'; lit: boolean; on: number; elapsed: number; remaining: number; now: number }
export function dialProgress(onAt: number | null, light: number | null, minute: number): DialProgress {
  const now = mod(minute), state = lightNow(onAt, light, now)
  if (state === 'none') return { kind: 'none' }
  if (light! >= DAY) return { kind: 'full', now }
  const elapsed = state === 'on' ? mod(now - onAt!) : 0
  return { kind: 'cycle', lit: state === 'on', on: onAt!, elapsed, remaining: light! - elapsed, now }
}

/** "desde as 6 horas", "desde a uma hora", "desde a meia-noite". */
function sinceClock(minute: number): string {
  const m = mod(minute)
  return m === 0 ? 'desde a meia-noite' : Math.floor(m / 60) === 1 ? `desde a ${spokenClock(m)}` : `desde as ${spokenClock(m)}`
}
const singular = (minutes: number) => minutes === 1 || minutes === 60

/** Spoken progress of the panel timer (UX item 2c, "Rótulo acessível"). */
export function progressSummary(onAt: number | null, light: number | null, minute: number): string {
  const p = dialProgress(onAt, light, minute)
  if (p.kind === 'none') return 'Sem programação de luz.'
  if (p.kind === 'full') return 'Luz ligada o dia todo.'
  if (p.lit) return `Luz ligada ${sinceClock(p.on)}, desliga ${atClock(p.on + light!)}; ${singular(p.remaining) ? 'falta' : 'faltam'} ${spokenDuration(p.remaining)}.`
  const until = mod(p.on - p.now)
  return `Luz apagada; liga ${atClock(p.on)}, em ${spokenDuration(until)}.`
}
