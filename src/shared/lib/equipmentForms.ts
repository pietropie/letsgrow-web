// Copiado de letsgrow-mobile/lib/equipmentForms.ts por scripts/sync-shared.mjs. Não edite aqui.
import type { GrowResponse, GrowUpdate } from '../types/api'

/**
 * Equipment forms (UX-CORRECOES.md item 4, Figma 02C 2302:10048): one short form per kind, each saving
 * only its own fields with PATCH /grows/{id}. Choices use '' for "not informed" (null in the API).
 */
export type EquipmentKind = 'light' | 'exhaust' | 'fans' | 'climate' | 'space' | 'pot'
export const EQUIPMENT_KINDS: EquipmentKind[] = ['light', 'exhaust', 'fans', 'climate', 'space', 'pot']
export const KIND_TITLE: Record<EquipmentKind, string> = {
  light: 'Iluminação', exhaust: 'Exaustão e entrada de ar', fans: 'Ventilação interna', climate: 'Controle climático', space: 'Espaço', pot: 'Vaso e substrato',
}
export function isEquipmentKind(value: unknown): value is EquipmentKind {
  return typeof value === 'string' && (EQUIPMENT_KINDS as string[]).includes(value)
}

export type Option = { value: string; label: string }
const options = (labels: Record<string, string>, empty = 'Não informado'): Option[] => [...Object.entries(labels).map(([value, label]) => ({ value, label })), { value: '', label: empty }]

export const LIGHT_TYPES: Record<string, string> = { led_quantum_board: 'LED Quantum Board', led_cob: 'LED COB', hps_hid: 'HPS/HID', cmh: 'CMH', fluorescent: 'Fluorescente', other: 'Outra luminária' }
export const EXHAUST_TYPES: Record<string, string> = { inline_fan: 'Exaustor inline', axial_fan: 'Exaustor axial', pc_fans: 'Coolers', none: 'Sem exaustão' }
export const LOCATIONS: Record<string, string> = { copa: 'Copa', base: 'Base' }
export const INTAKE_TYPES: Record<string, string> = { active_fan: 'Ventilador ativo', passive: 'Passiva', none: 'Nenhuma' }
export const POT_TYPES: Record<string, string> = { fabric: 'Feltro', plastic: 'Plástico', air_pot: 'Air pot', other: 'Outro' }
export const SUBSTRATES: Record<string, string> = { mineral_soil: 'Terra mineral', coco: 'Fibra de coco', organic_supersoil: 'Supersoil orgânico', hydro_dwc: 'Hidroponia (DWC)', other: 'Outro' }

export const OPTIONS = {
  lightType: options(LIGHT_TYPES), exhaustType: options(EXHAUST_TYPES), location: options(LOCATIONS),
  intake: options(INTAKE_TYPES), pot: options(POT_TYPES), substrate: options(SUBSTRATES),
  yesNo: options({ yes: 'Sim', no: 'Não' }, 'Não sei'), carbonFilter: options({ yes: 'Acoplado', no: 'Sem filtro' }, 'Não sei'),
}

/** Booleans have three answers: a switch could not say "Não sei", and would store false unasked. */
export const triFromBool = (value?: boolean | null) => value == null ? '' : value ? 'yes' : 'no'
export const boolFromTri = (value: string): boolean | null => value === 'yes' ? true : value === 'no' ? false : null

export type FanDraft = { location: string; watts: string; on?: boolean }
export type EquipmentDraft = { values: Record<string, string>; fans: FanDraft[] }

/** Minutes of light: the server field, or the legacy "N/M" text until the backend is deployed (same rule as lib/lightSchedule). */
function lightMinutes(grow: GrowResponse): number | null {
  if (grow.photoperiod_light_minutes != null) return grow.photoperiod_light_minutes
  const m = grow.photoperiod_hours?.match(/^(\d{1,2})\/(\d{1,2})$/)
  return m && Number(m[1]) + Number(m[2]) === 24 && Number(m[1]) > 0 ? Number(m[1]) * 60 : null
}

const text = (value?: number | string | null) => value == null ? '' : String(value).replace('.', ',')

/** Form fields of one kind, filled from the grow (no example values). */
export function draftFromGrow(kind: EquipmentKind, grow: GrowResponse): EquipmentDraft {
  const v: Record<string, string> = {}
  if (kind === 'light') Object.assign(v, { light_type: grow.light_type ?? '', lighting_watts: text(grow.lighting_watts), light_distance_cm: text(grow.light_distance_cm), photoperiod_on_at: grow.photoperiod_on_at?.slice(0, 5) ?? '', photoperiod_light_minutes: String(lightMinutes(grow) ?? ''), light_leak_controlled: triFromBool(grow.light_leak_controlled) })
  if (kind === 'exhaust') Object.assign(v, { exhaust_type: grow.exhaust_type ?? '', exhaust_cfm: text(grow.exhaust_cfm), exhaust_location: grow.exhaust_location ?? '', carbon_filter: triFromBool(grow.carbon_filter), intake_type: grow.intake_type ?? '', negative_pressure: triFromBool(grow.negative_pressure) })
  if (kind === 'climate') Object.assign(v, { air_conditioning: triFromBool(grow.air_conditioning), dehumidifier: triFromBool(grow.dehumidifier), humidifier: triFromBool(grow.humidifier), heater: triFromBool(grow.heater), target_temp_c: text(grow.target_temp_c), target_humidity_rh: text(grow.target_humidity_rh) })
  if (kind === 'space') Object.assign(v, { tent_width_cm: text(grow.tent_width_cm), tent_depth_cm: text(grow.tent_depth_cm), tent_height_cm: text(grow.tent_height_cm) })
  if (kind === 'pot') Object.assign(v, { pot_type: grow.pot_type ?? '', substrate_type: grow.substrate_type ?? '' })
  const fans = kind === 'fans' ? (grow.fans ?? []).map(f => ({ location: f.location ?? '', watts: text(f.watts), ...(f.on != null && { on: f.on }) })) : []
  return { values: v, fans }
}

const toNumber = (value: string): number | null | 'invalid' => {
  const t = value.trim().replace(',', '.')
  if (!t) return null
  return /^-?(\d+\.?\d*|\.\d+)$/.test(t) ? Number(t) : 'invalid'
}
/** "6:00" / "06:00" → "06:00"; invalid → 'invalid'; empty → null. */
export function clockValue(value: string): string | null | 'invalid' {
  const t = value.trim()
  if (!t) return null
  const m = t.match(/^(\d{1,2}):(\d{2})$/)
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return 'invalid'
  return `${m[1].padStart(2, '0')}:${m[2]}`
}

type Rule = { label: string; min?: number; max?: number; integer?: boolean }
const NUMBER_RULES: Record<string, Rule> = {
  lighting_watts: { label: 'Potência', min: 0, integer: true }, photoperiod_light_minutes: { label: 'Programação de luz', min: 1, max: 1440, integer: true }, light_distance_cm: { label: 'Distância', min: 0, integer: true },
  exhaust_cfm: { label: 'Vazão nominal', min: 0, integer: true },
  target_temp_c: { label: 'Temperatura-alvo', min: 0, max: 50 }, target_humidity_rh: { label: 'Umidade-alvo', min: 0, max: 100 },
  tent_width_cm: { label: 'Largura', min: 0, integer: true }, tent_depth_cm: { label: 'Profundidade', min: 0, integer: true }, tent_height_cm: { label: 'Altura', min: 0, integer: true },
}
const TRI_FIELDS = new Set(['light_leak_controlled', 'carbon_filter', 'negative_pressure', 'air_conditioning', 'dehumidifier', 'humidifier', 'heater'])

/** PATCH body for one kind, or the first validation message. Only the kind's own fields are sent. */
export function payloadFromDraft(kind: EquipmentKind, draft: EquipmentDraft): { body: GrowUpdate } | { error: string } {
  const body: Record<string, unknown> = {}
  for (const [key, raw] of Object.entries(draft.values)) {
    if (kind === 'exhaust' && draft.values.exhaust_type === 'none' && ['exhaust_cfm', 'exhaust_location', 'carbon_filter'].includes(key)) continue
    if (key === 'photoperiod_on_at') {
      const clock = clockValue(raw)
      if (clock === 'invalid') return { error: 'Use o formato HH:MM para a hora em que a luz liga.' }
      body[key] = clock
    } else if (NUMBER_RULES[key]) {
      const rule = NUMBER_RULES[key], n = toNumber(raw)
      if (n === 'invalid' || (n != null && ((rule.integer && !Number.isInteger(n)) || (rule.min != null && n < rule.min) || (rule.max != null && n > rule.max))))
        return { error: `${rule.label}: informe ${rule.integer ? 'um número inteiro' : 'um número'}${rule.max != null ? ` entre ${rule.min} e ${rule.max}` : ''} ou deixe em branco.` }
      body[key] = n
    } else body[key] = TRI_FIELDS.has(key) ? boolFromTri(raw) : raw || null
  }
  // photoperiod_hours is derived by the server; the schedule is on_at + minutes, and needs the on time unless it is 24/0.
  if (kind === 'light' && body.photoperiod_light_minutes != null && (body.photoperiod_light_minutes as number) < 1440 && body.photoperiod_on_at == null)
    return { error: 'Defina a hora em que a luz liga.' }
  if (kind === 'fans') {
    const fans = []
    for (const [i, fan] of draft.fans.entries()) {
      const watts = toNumber(fan.watts)
      if (watts === 'invalid' || (watts != null && (!Number.isInteger(watts) || watts < 0))) return { error: `Ventilador ${i + 1}: informe a potência em W como número inteiro ou deixe em branco.` }
      fans.push({ ...(fan.location && { location: fan.location }), ...(watts != null && { watts }), ...(fan.on != null && { on: fan.on }) })
    }
    // Keeps the legacy count coherent with the list.
    Object.assign(body, { fans, internal_circulation_fans: fans.length })
  }
  return { body: body as GrowUpdate }
}

const FIELD_LABEL: Record<string, string> = {
  light_type: 'Tipo de luminária', photoperiod_light_minutes: 'Programação de luz', photoperiod_on_at: 'Hora em que a luz liga', light_leak_controlled: 'Vazamento de luz controlado',
  exhaust_type: 'Tipo de exaustor', exhaust_location: 'Local', carbon_filter: 'Filtro de carvão', intake_type: 'Entrada de ar', negative_pressure: 'Pressão negativa',
  air_conditioning: 'Ar-condicionado', dehumidifier: 'Desumidificador', humidifier: 'Umidificador', heater: 'Aquecedor', pot_type: 'Tipo de vaso', substrate_type: 'Substrato',
  ...Object.fromEntries(Object.entries(NUMBER_RULES).map(([k, r]) => [k, r.label])),
}

/**
 * Fields the server did not store as sent: a cleared answer it kept, or a field it does not know yet (an
 * older backend ignores it and answers 200). The form says so instead of closing as if it had been saved.
 */
export function unsavedFields(body: GrowUpdate, saved: GrowResponse): string[] {
  const got = saved as unknown as Record<string, unknown>
  const same = (sent: unknown, value: unknown) => {
    if (sent === null) return value == null
    if (Array.isArray(sent)) return true
    if (typeof sent === 'string' && /^\d{2}:\d{2}$/.test(sent)) return typeof value === 'string' && value.slice(0, 5) === sent
    return sent === value
  }
  return Object.entries(body).filter(([key, value]) => !same(value, got[key])).map(([key]) => FIELD_LABEL[key] ?? key)
}

const join = (parts: (string | null | false | undefined)[]) => parts.filter(Boolean).join(' · ') || 'Não informado'

/** One-line summary for the Equipamentos row of each kind (Figma G 2302:10050). */
export function equipmentSummary(kind: EquipmentKind, grow: GrowResponse): string {
  if (kind === 'light') return join([grow.light_type && LIGHT_TYPES[grow.light_type], grow.lighting_watts != null && `${grow.lighting_watts} W`,
    grow.photoperiod_hours === 'custom' && lightMinutes(grow) == null ? 'programação incompleta' : grow.photoperiod_hours, grow.photoperiod_on_at && `liga às ${grow.photoperiod_on_at.slice(0, 5)}`])
  if (kind === 'exhaust') return grow.exhaust_type === 'none' ? 'Sem exaustão' : join([grow.exhaust_type && EXHAUST_TYPES[grow.exhaust_type], grow.exhaust_cfm != null && `${grow.exhaust_cfm} CFM`, grow.exhaust_location && (LOCATIONS[grow.exhaust_location] ?? grow.exhaust_location).toLowerCase(), grow.carbon_filter != null && (grow.carbon_filter ? 'filtro acoplado' : 'sem filtro')])
  if (kind === 'fans') { const n = grow.fans?.length ?? grow.internal_circulation_fans ?? 0; return n ? (n === 1 ? '1 ventilador' : `${n} ventiladores`) : 'Não informado' }
  if (kind === 'climate') return join([grow.air_conditioning && 'Ar-condicionado', grow.dehumidifier && 'Desumidificador', grow.humidifier && 'Umidificador', grow.heater && 'Aquecedor',
    (grow.target_temp_c != null || grow.target_humidity_rh != null) && `alvo ${[grow.target_temp_c != null && `${text(grow.target_temp_c)} °C`, grow.target_humidity_rh != null && `${text(grow.target_humidity_rh)} %`].filter(Boolean).join(' e ')}`])
  if (kind === 'space') return [grow.tent_width_cm, grow.tent_depth_cm, grow.tent_height_cm].every(v => v == null) ? 'Não informado' : `${[grow.tent_width_cm, grow.tent_depth_cm, grow.tent_height_cm].map(v => v ?? '—').join(' × ')} cm`
  return join([grow.pot_type && POT_TYPES[grow.pot_type], grow.substrate_type && SUBSTRATES[grow.substrate_type]])
}

/** Whether any kind has data: drives the G1 "Nenhum equipamento cadastrado" notice. */
export function hasAnyEquipment(grow: GrowResponse): boolean {
  return EQUIPMENT_KINDS.some(kind => equipmentSummary(kind, grow) !== 'Não informado')
}

