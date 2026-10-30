// Copiado de letsgrow-mobile/lib/growEquipment.ts por scripts/sync-shared.mjs. Não edite aqui.
import type { GrowResponse } from '../types/api'

// Registered equipment only: these describe what the user filled in, never live state.
const lightTypes: Record<string, string> = { led_quantum_board: 'LED quantum board', led_cob: 'LED COB', hps_hid: 'HPS/HID', cmh: 'CMH', fluorescent: 'Fluorescente', other: 'Outra luminária' }
const exhaustTypes: Record<string, string> = { inline_fan: 'Exaustor inline', axial_fan: 'Exaustor axial', pc_fans: 'Coolers', none: 'Sem exaustão' }
const locations: Record<string, string> = { copa: 'COPA', base: 'BASE' }

export const growTypeLabel: Record<string, string> = { indoor: 'Interno', outdoor: 'Externo', greenhouse: 'Estufa' }

export function lightDescription(grow?: GrowResponse | null): string | null {
  if (!grow) return null
  const parts = [grow.light_type ? lightTypes[grow.light_type] ?? grow.light_type : null, grow.lighting_watts ? `${grow.lighting_watts} W` : null].filter(Boolean)
  return parts.length ? parts.join(' · ') : null
}

/** "18/6" → { on: 18, off: 6 }. Custom or missing programs return null. */
export function photoperiod(grow?: GrowResponse | null): { on: number; off: number } | null {
  // Minute precision (e.g. 17.75/6.25) from photoperiod_light_minutes; the "N/M" text until the backend is deployed.
  const minutes = grow?.photoperiod_light_minutes
  if (minutes != null && minutes > 0 && minutes <= 1440) return { on: minutes / 60, off: (1440 - minutes) / 60 }
  const match = grow?.photoperiod_hours?.match(/^(\d{1,2})\/(\d{1,2})$/)
  if (!match) return null
  const on = Number(match[1]), off = Number(match[2])
  return on + off === 24 ? { on, off } : null
}

export function exhaustDescription(grow?: GrowResponse | null): string | null {
  if (!grow?.exhaust_type) return null
  return [exhaustTypes[grow.exhaust_type] ?? grow.exhaust_type, grow.exhaust_cfm ? `${grow.exhaust_cfm} CFM` : null].filter(Boolean).join(' · ')
}

export function locationLabel(value?: string | null): string { return value ? locations[value] ?? value.toUpperCase() : 'NÃO INFORMADO' }

export function carbonFilterLabel(value?: boolean | null): string { return value == null ? 'NÃO INFORMADO' : value ? 'ACOPLADO' : 'SEM FILTRO' }

export type FanInfo = { title: string; location: string }
export function fans(grow?: GrowResponse | null): FanInfo[] {
  if (grow?.fans?.length) return grow.fans.slice(0, 2).map(f => ({ title: f.watts ? `Ventilador ${f.watts}W` : 'Ventilador', location: locationLabel(f.location) }))
  const count = grow?.internal_circulation_fans ?? 0
  return count > 0 ? [{ title: count === 1 ? '1 ventilador interno' : `${count} ventiladores internos`, location: 'NÃO INFORMADO' }] : []
}

export function hasEquipment(grow?: GrowResponse | null): boolean {
  return !!(lightDescription(grow) || grow?.photoperiod_hours || exhaustDescription(grow) || fans(grow).length)
}
