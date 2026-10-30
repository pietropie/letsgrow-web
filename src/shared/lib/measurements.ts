// Copiado de letsgrow-mobile/lib/measurements.ts por scripts/sync-shared.mjs. Não edite aqui.
import type { EnvironmentMeasurement, GrowEnvSnapshot } from '../types/api'

export function formatMeasurementValue(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('pt-BR', { useGrouping: false, maximumFractionDigits: 1 }).format(value)
}

export function measurementCaption(measurement?: EnvironmentMeasurement | null): string {
  if (measurement?.value == null || !Number.isFinite(measurement.value)) return 'Sem medição'
  const source = measurement.source === 'manual' ? 'Manual' : measurement.source === 'sensor' ? 'Sensor' : 'Origem não informada'
  const date = measurement.observed_at ? new Date(measurement.observed_at) : null
  const when = date && Number.isFinite(date.getTime())
    ? `${date.toLocaleDateString('pt-BR')} ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
    : 'Horário não informado'
  return `${source} · ${when}`
}

export function environmentMeasurement(env: GrowEnvSnapshot | null | undefined, metric: 'temperature' | 'humidity' | 'light' | 'vpd'): EnvironmentMeasurement {
  if (env?.[metric]) return env[metric]
  // Old APIs do not identify each reading's origin/date. Do not invent them.
  const legacy = { temperature: env?.temp_c, humidity: env?.humidity_rh, light: env?.lux, vpd: env?.vpd_kpa }
  const units = { temperature: '°C', humidity: '%', light: 'lux', vpd: 'kPa' }
  return { value: legacy[metric] ?? null, unit: units[metric], source: null, source_id: null, observed_at: null }
}
