// Copiado de letsgrow-mobile/lib/phaseDay.ts por scripts/sync-shared.mjs. Não edite aqui.
import { phases } from '../constants/theme'
import type { EventResponse, PlantResponse } from '../types/api'
import { daysSinceDate } from './dates'
import { dayNumber, phaseStart } from './plantFacts'

/** Day of the current phase (its first day is day 1), only from registered dates or FASE records; else null. */
export function phaseDay(plant: PlantResponse, events: EventResponse[] = []): number | null {
  const start = phaseStart(plant, events)
  return start ? dayNumber(daysSinceDate(start)) : null
}

/** "VEGETATIVO · DIA 22" (Figma 2319:11437), or just the phase when its start is not registered. */
export function phaseTagLabel(plant: PlantResponse, events: EventResponse[] = []): string {
  const day = phaseDay(plant, events)
  return (phases[plant.current_phase]?.label ?? 'Fase não informada').toUpperCase() + (day ? ` · DIA ${day}` : '')
}
