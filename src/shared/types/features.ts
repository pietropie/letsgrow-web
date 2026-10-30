// Copiado de letsgrow-mobile/types/features.ts por scripts/sync-shared.mjs. Não edite aqui.
// Contratos das telas que antes eram "Sem API" (ver analise-2026-10-16/IMPLEMENTACAO-04-BACKEND-SEM-API.md).

export interface EnvironmentReading {
  id: string
  grow_id: string
  observed_at: string
  temperature_c: number | null
  humidity_rh: number | null
  notes: string | null
  /** manual = registered in the app; exhaust_power = written by the server when the dimmer changes (read-only). */
  kind?: 'manual' | 'exhaust_power'
  created_at: string
  updated_at: string
}

export interface EnvironmentReadingPage { items: EnvironmentReading[]; total: number }
/** DELETE /grows/{id} (archive) and POST /grows/{id}/restore: the plants archived or restored with it. */
export interface GrowArchiveResult { message: string; grow_id: string; status: string; archived_at: string | null; plants_affected: number }

export interface BobEvidence {
  kind: 'event' | 'environment_reading' | 'sensor_reading' | 'plant'
  id: string
  /** Null for dates registered on the plant itself. */
  observed_at: string | null
  source: 'manual' | 'sensor' | null
  plant_id: string | null
  grow_id: string | null
  values: Record<string, string | number | boolean | null>
}

export interface BobMemory {
  id: string
  content: string
  source: 'user'
  created_at: string
  updated_at: string
}

export interface NotificationPreferences {
  frequency: 'daily' | 'in_app'
  brief_time: string | null
  timezone: string | null
  quiet_start: string | null
  quiet_end: string | null
  preview: 'full' | 'discreet'
  is_default: boolean
}

export interface CreditBalance {
  enabled: boolean
  available: number
  plan_available: number
  extra_available: number
  renews_at: string | null
  monthly_credits: number | null
  replaces_query_limit: boolean
}

export interface CreditHistoryItem {
  id: string
  type: 'task' | 'grant_plan' | 'purchase' | 'expire' | 'adjust'
  title: string
  amount: number
  status: 'reserved' | 'captured' | 'released' | null
  cost: number | null
  task_key: string | null
  task_ref: string | null
  failure_reason: string | null
  occurred_at: string
}

export interface CreditPackage {
  id: string
  label: string
  credits: number
  price_brl: number
  validity_days: number | null
}

export interface CreditQuote {
  required: boolean
  quote_id: string | null
  task: 'chat_message' | 'photo_analysis'
  task_label: string
  cost: number
  available: number
  after: number
  sufficient: boolean
  scope: { plant_name?: string; grow_name?: string } | null
  expires_at: string | null
}

export interface CreditPurchase {
  id: string
  status: 'pending' | 'paid' | 'failed' | 'canceled'
  label: string
  credits: number
  price_brl: number
  checkout_url: string | null
  paid_at: string | null
}

export interface DataExport {
  id: string
  status: 'requested' | 'processing' | 'ready' | 'failed' | 'expired'
  requested_at: string
  completed_at: string | null
  expires_at: string | null
  file_size: number | null
}

export interface DeletionRequest {
  id: string
  status: 'scheduled' | 'failed' | 'canceled' | 'completed'
  requested_at: string
  scheduled_for: string
  grace_days: number
}

export interface SupportMessage {
  id: string
  subject: string
  status: 'received' | 'answered'
  created_at: string
}
