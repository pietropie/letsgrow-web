// Copiado de letsgrow-mobile/lib/diaryEntries.ts por scripts/sync-shared.mjs. Não edite aqui.
import type { EventResponse } from '../types/api'
import { eventTypeLabel } from './plantFacts'

export type DiaryEntry = EventResponse & { photo_urls?: string[]; plant_name?: string | null; plant_nickname?: string | null; strain_name?: string | null; strain_image_url?: string | null }
export type MarkerKind = 'rega' | 'nota' | 'nutricao' | 'foto' | 'outro'
export type DiaryFilter = 'all' | 'photos' | 'notes' | 'waterings'

/** Figma "Dia do calendário": yellow watering, green note, pink nutrition, blue-grey photo. */
export const markerColor: Record<MarkerKind, string> = { rega: '#FFFD98', nota: '#BEE5D1', nutricao: '#FDB6E6', foto: '#C3CAD8', outro: '#E2E1E0' }

export function entryKinds(e: DiaryEntry): MarkerKind[] {
  const kinds: MarkerKind[] = []
  if (e.event_type === 'watering' || e.event_type === 'rega') kinds.push('rega')
  if (e.event_type === 'feeding' || (e.ppm != null && !kinds.includes('rega'))) kinds.push('nutricao')
  if (['note', 'observation'].includes(e.event_type)) kinds.push('nota')
  if (e.photo_urls?.length || e.photo_keys?.length) kinds.push('foto')
  return kinds.length ? kinds : ['outro']
}

export function matchesFilter(e: DiaryEntry, filter: DiaryFilter) {
  const kinds = entryKinds(e)
  return filter === 'all' || (filter === 'photos' && kinds.includes('foto')) || (filter === 'notes' && kinds.includes('nota')) || (filter === 'waterings' && (kinds.includes('rega') || kinds.includes('nutricao')))
}

const decimal = (n: number, digits = 1) => n.toLocaleString('pt-BR', { maximumFractionDigits: digits })
/** Value tags of a record (only fields that were filled). */
export function entryValues(e: DiaryEntry): { label: string; color: string }[] {
  const values: { label: string; color: string }[] = []
  if (e.water_volume_ml != null) values.push({ label: e.water_volume_ml >= 1000 ? `${decimal(e.water_volume_ml / 1000)} L` : `${Math.round(e.water_volume_ml)} ml`, color: markerColor.rega })
  if (e.ph_in != null) values.push({ label: `PH ${decimal(e.ph_in)}`, color: markerColor.nota })
  if (e.ppm != null) values.push({ label: `${Math.round(e.ppm)} PPM`, color: markerColor.nutricao })
  if (e.temperature_c != null) values.push({ label: `${decimal(e.temperature_c)} °C`, color: markerColor.rega })
  if (e.humidity_rh != null) values.push({ label: `${Math.round(e.humidity_rh)}% UR`, color: markerColor.foto })
  if (e.weight_g != null) values.push({ label: `${decimal(e.weight_g)} g`, color: markerColor.outro })
  const photos = e.photo_urls?.length ?? e.photo_keys?.length ?? 0
  if (photos) values.push({ label: photos === 1 ? '1 FOTO' : `${photos} FOTOS`, color: markerColor.foto })
  if (!values.length && ['note', 'observation'].includes(e.event_type)) values.push({ label: 'MANUAL', color: markerColor.outro })
  return values
}

export function entryTitle(e: DiaryEntry) { return (eventTypeLabel[e.event_type] ?? 'Registro').toUpperCase() }

// Kept here for the screens that already import it; it lives in diaryCalendar with the other calendar helpers.
export { dayKey } from './diaryCalendar'
