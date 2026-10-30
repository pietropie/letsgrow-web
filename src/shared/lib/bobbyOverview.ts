// Copiado de letsgrow-mobile/lib/bobbyOverview.ts por scripts/sync-shared.mjs. Não edite aqui.
import type { BobAlert } from '../types/bob'

type Plant = { id: string; strain_name: string }
type OverviewInput = {
  plants: Plant[]
  alerts: BobAlert[]
  pending: boolean
  failed: boolean
}

const priority: Record<BobAlert['tier'], number> = {
  critical: 0, anomaly: 1, attention: 2, info: 3,
}

export function getBobbyOverview({ plants, alerts, pending, failed }: OverviewInput) {
  const ids = new Set(plants.map((plant) => plant.id))
  const contextualAlerts = alerts
    .filter((alert) => ids.has(alert.plant_id))
    .sort((a, b) => priority[a.tier] - priority[b.tier])
  const alert = !pending && !failed ? contextualAlerts[0] : undefined
  const plant = plants.find((item) => item.id === alert?.plant_id) ?? plants[0]
  const message = pending
    ? 'Carregando as observações do Bobby…'
    : failed
      ? 'Não foi possível atualizar as observações. Tente novamente.'
      : alert?.message ?? 'Nenhum alerta retornado para este ambiente. Isso não confirma a condição das plantas.'

  return { plant, alert, message, contextualAlerts }
}

export function getBobbyStatus(pending: boolean, failed: boolean, alert?: BobAlert): string {
  if (pending) return 'CARREGANDO'
  if (failed) return 'INDISPONÍVEL'
  return alert ? 'VER OBSERVAÇÃO' : 'SEM ALERTAS RETORNADOS'
}

/** Short heading for an alert card; the alert message itself stays the source of truth. */
export const alertHeading: Record<BobAlert['tier'], string> = {
  critical: 'Pede atenção agora', anomaly: 'Algo fora do padrão nos registros', attention: 'Vale conferir', info: 'Uma observação sobre seus registros',
}
