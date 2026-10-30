// Copiado de letsgrow-mobile/lib/plantFacts.ts por scripts/sync-shared.mjs. Não edite aqui.
import type { EventResponse, PlantResponse } from '../types/api'

// Facts derived only from what the user registered. Nothing here estimates growth or dates.
const WATERING = new Set(['watering', 'rega'])
const FEEDING = new Set(['feeding'])
export const isWatering = (e: EventResponse) => WATERING.has(e.event_type)
export const isFeeding = (e: EventResponse) => FEEDING.has(e.event_type) || (e.ppm != null && WATERING.has(e.event_type))

export const eventTypeLabel: Record<string, string> = {
  watering: 'Rega', rega: 'Rega', feeding: 'Nutrição', environment: 'Ambiente', reading: 'Ambiente', note: 'Nota', observation: 'Observação',
  symptom: 'Sintoma', problem: 'Problema', training: 'Treino', topping: 'Topping', pruning: 'Poda', defoliation: 'Desfolha', transplant: 'Transplante',
  flip: 'Flip', germination: 'Germinação', seedling: 'Muda', veg: 'Vegetativa', harvest: 'Colheita', drying: 'Secagem', curing: 'Cura', trichome_reading: 'Tricomas', photo: 'Foto', light: 'Luz', phase: 'Fase',
}

const byDateDesc = (a: EventResponse, b: EventResponse) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
export function sortedEvents(events: EventResponse[] = []) { return [...events].sort(byDateDesc) }
export function latest(events: EventResponse[] = [], match: (e: EventResponse) => boolean) { return sortedEvents(events).find(match) ?? null }

export function photoStats(events: EventResponse[] = []) {
  const withPhotos = sortedEvents(events).filter(e => e.photo_keys?.length)
  return { count: withPhotos.reduce((n, e) => n + (e.photo_keys?.length ?? 0), 0), last: withPhotos[0]?.event_date ?? null, events: withPhotos }
}

/** Mean days between registered waterings; null with fewer than two. */
export function wateringInterval(events: EventResponse[] = []): { days: number; count: number } | null {
  const dates = events.filter(isWatering).map(e => new Date(e.event_date).getTime()).filter(Number.isFinite).sort((a, b) => a - b)
  if (dates.length < 2) return null
  const days = (dates[dates.length - 1] - dates[0]) / 86400000 / (dates.length - 1)
  return { days: Math.max(1, Math.round(days)), count: dates.length }
}

export function eventsInLastDays(events: EventResponse[] = [], days = 7, now = Date.now()) {
  return events.filter(e => now - new Date(e.event_date).getTime() <= days * 86400000).length
}

const ORDER = ['germination', 'seedling', 'veg', 'flower', 'late_flower', 'harvest', 'drying', 'curing']
export function nextPhase(phase: string): string | null {
  const i = ORDER.indexOf(phase)
  return i >= 0 && i < ORDER.length - 1 ? ORDER[i + 1] : null
}

/** Whether the plant has anything beyond its name: drives the compact Figma variant ("Planta Sol"). */
export function hasPlantDetails(plant: PlantResponse) {
  return !!(plant.strain_name?.trim() || plant.strain_type !== 'unknown' || plant.seed_type !== 'unknown' || plant.genetics || plant.pot_label || plant.pot_volume_liters || plant.substrate || plant.germination_date || (plant.current_phase && plant.current_phase !== 'unknown'))
}

/** "1 planta", "2 plantas". */
export const plantCount = (n: number) => `${n} ${n === 1 ? 'planta' : 'plantas'}`

/** "Planta Sol" → "Sol" for "Abrir diário da Sol". */
export function shortPlantName(name: string) { return name.replace(/^planta\s+/i, '').trim() || name }

/** "Fase" in Informações da planta (QA 2026-10-18 nº 3). The screen adds any other stored phase while it is current. */
export const phaseOptions = [
  { value: 'unknown', label: 'Não sei' }, { value: 'germination', label: 'Germinação' }, { value: 'seedling', label: 'Muda' },
  { value: 'veg', label: 'Vegetativa' }, { value: 'flower', label: 'Floração' }, { value: 'harvest', label: 'Colheita' },
]

/**
 * Phase icon (Figma page "Components", sets "Fases" 155:1690 and 157:1808). Only germination, seedling,
 * veg and flowering have one; harvest, drying, curing and "unknown" show no icon (none in the Figma).
 */
export type PhaseIconKey = 'germination' | 'seedling' | 'veg' | 'flower'
const PHASE_ICON: Record<string, PhaseIconKey> = { germination: 'germination', seedling: 'seedling', veg: 'veg', flower: 'flower', late_flower: 'flower' }
/** Label under the icon, as in the Figma card variants (GÉRMEN, MUDA, VEGA, FLORA). */
export const PHASE_ICON_LABEL: Record<PhaseIconKey, string> = { germination: 'GÉRMEN', seedling: 'MUDA', veg: 'VEGA', flower: 'FLORA' }
export function phaseIcon(phase?: string | null): PhaseIconKey | null {
  return (phase && PHASE_ICON[phase]) || null
}

const PHASE_START_EVENT: Record<string, string> = { germination: 'germination', seedling: 'seedling', veg: 'veg', flower: 'flip', late_flower: 'flip', harvest: 'harvest' }
/** Start of the current phase, only from what was registered: the plant's own date, else the latest FASE record of that phase. */
export function phaseStart(plant: PlantResponse, events: EventResponse[] = []): string | null {
  const own: Record<string, string | null> = { germination: plant.germination_date, flower: plant.flip_date, late_flower: plant.flip_date, harvest: plant.harvest_date }
  const type = PHASE_START_EVENT[plant.current_phase]
  return own[plant.current_phase] ?? (type ? latest(events, e => e.event_type === type)?.event_date ?? null : null)
}

export const strainTypeOptions =[{ value: 'unknown', label: 'Não sei' }, { value: 'photo', label: 'Fotoperiódica' }, { value: 'auto', label: 'Automática' }] as const

/**
 * Day N of a period, counting its first day as day 1: the Figma uses the same number for "TEMPO 22 dias",
 * "22 dias nesta fase" and "DIA 22" (2160:6740, 2287:8821, 2319:11437). Every count on the plant uses it
 * (QA 2026-10-20 nº 2).
 */
export function dayNumber(daysSince: number): number { return Math.max(0, daysSince) + 1 }
export const dayCount = (n: number) => `${n} ${n === 1 ? 'dia' : 'dias'}`

/** Strain percentages are free text from the strain bank ("17–20%", "20", "Alto"): add "%" only to a bare number or range. */
export function percentText(value?: string | number | null): string | null {
  const text = value == null ? '' : String(value).trim()
  if (!text) return null
  return /^[\d.,\s–-]+$/.test(text) ? `${text}%` : text
}
