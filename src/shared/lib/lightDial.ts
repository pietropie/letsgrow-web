// Copiado de letsgrow-mobile/lib/lightDial.ts por scripts/sync-shared.mjs. Não edite aqui.
/** 24 h light dial (panel "Iluminação"): where the last light reading sits and whether it is still current. */

/** A reading older than this no longer stands for "now": its pointer turns gray. */
export const LIGHT_READING_STALE_HOURS = 24

/** Local hour of the day as a fraction, 0 ≤ h < 24 (09:40 → 9.666…). */
export function dialHour(date: Date): number {
  return date.getHours() + date.getMinutes() / 60
}

/** Clockwise degrees from 0 h at the top: one full turn per 24 h. */
export function dialAngle(hour: number): number {
  return (((hour % 24) + 24) % 24) / 24 * 360
}

/** Pointer for the last reading, or null when there is none (or its date is invalid). */
export function lightReadingPointer(observedAt: string | null | undefined, now: Date = new Date()): { hour: number; stale: boolean } | null {
  if (!observedAt) return null
  const date = new Date(observedAt)
  if (!Number.isFinite(date.getTime())) return null
  return { hour: dialHour(date), stale: now.getTime() - date.getTime() > LIGHT_READING_STALE_HOURS * 3600000 }
}
