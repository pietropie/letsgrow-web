// Copiado de letsgrow-mobile/types/bob.ts por scripts/sync-shared.mjs. Não edite aqui.
// ─── Tipos do Bob 2.0 (companion de alertas proativos) ───────────────────────

import type { BobEvidence } from './features'

export type BobAlertTier = 'critical' | 'anomaly' | 'attention' | 'info'

export interface BobAlert {
  alert_id: string
  plant_id: string
  plant_name: string
  tier: BobAlertTier
  /** Ação imperativa curta — ex: "Regar HOJE." */
  action: string
  /** Mensagem descritiva — ex: "Gelato está há 4 dias sem rega." */
  message: string
  /** Contexto interno do Bob sobre o motivo do alerta (exibido no chat). */
  reason: string
  /** Registros usados pela regra. Ausente em APIs antigas; vazio quando a regra não cita a base. */
  evidence?: BobEvidence[]
}

export interface BobAlertsResponse {
  alerts: BobAlert[]
  total: number
  has_critical: boolean
}
