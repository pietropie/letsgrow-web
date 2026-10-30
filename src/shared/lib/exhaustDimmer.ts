// Copiado de letsgrow-mobile/lib/exhaustDimmer.ts por scripts/sync-shared.mjs. Não edite aqui.
/**
 * Exhaust power dimmer (panel "Exaustão", UX-CORRECOES.md item 2b). It records the power set on the
 * user's controller; it never commands the fan. Angles are degrees clockwise from the top of the knob.
 */

/** 0–100% in steps of 5: the 21 marks of the knob (Figma 2290:9304, asset knob-dots.svg). */
export const POWER_STEP = 5
/** The marks sit every 15° from −150° (0%) to +150° (100%); the 60° at the bottom are a dead zone. */
export const MIN_ANGLE = -150
export const MAX_ANGLE = 150
const DEGREES_PER_PERCENT = (MAX_ANGLE - MIN_ANGLE) / 100
/** A drag never moves more than this between two touch events; a bigger jump means it crossed the dead zone. */
const MAX_JUMP = 50

/** Clamps to 0–100 and rounds to the nearest 5%. */
export function snapPower(pct: number): number {
  return Math.min(100, Math.max(0, Math.round(pct / POWER_STEP) * POWER_STEP))
}

export function powerToAngle(pct: number): number {
  return MIN_ANGLE + snapPower(pct) * DEGREES_PER_PERCENT
}

/** Angle of a touch around the knob center, in (−180, 180]: 0 at the top, 90 on the right. */
export function touchAngle(x: number, y: number, cx: number, cy: number): number {
  return Math.atan2(x - cx, cy - y) * 180 / Math.PI
}

/**
 * Power for a touch angle while dragging. `previous` is the value at the last event (null when the
 * finger has just landed). In the dead zone the value locks on the limit it came from; leaving the dead
 * zone on the other side would jump from 100 to 0 (or back), so the value stays on that limit.
 * Returns null when the finger lands in the dead zone with no value yet.
 */
export function dragPower(angle: number, previous: number | null): number | null {
  if (angle < MIN_ANGLE || angle > MAX_ANGLE) return previous == null ? null : previous >= 50 ? 100 : 0
  const next = snapPower((angle - MIN_ANGLE) / DEGREES_PER_PERCENT)
  return previous != null && Math.abs(next - previous) > MAX_JUMP ? previous : next
}

/** "Haptic" moments: every 5% step, and a stronger one on reaching 0% or 100%. */
export function powerFeedback(previous: number | null, next: number | null): 'none' | 'step' | 'limit' {
  if (next == null || next === previous) return 'none'
  return next === 0 || next === 100 ? 'limit' : 'step'
}

/** Whether the grow has an exhaust to record the power of. */
export function hasExhaust(exhaustType?: string | null): boolean {
  return !!exhaustType && exhaustType !== 'none'
}
