// Copiado de letsgrow-mobile/types/api.ts por scripts/sync-shared.mjs. Não edite aqui.
export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface UserResponse {
  id: string
  email: string
  username: string
  full_name: string | null
  plan: 'free' | 'jardineiro' | 'cultivador' | 'grower_pro' | 'grower' | 'pro'
  plan_expires_at: string | null
  is_active: boolean
  is_verified: boolean
  is_dev_mode: boolean
  avatar_url: string | null
  created_at: string
}

export interface PlanStatusResponse {
  plan: string
  effective_plan: string
  is_expired: boolean
  plan_expires_at: string | null
  // Limites
  max_plants: number
  max_grows: number
  max_pots_per_grow: number
  ai_queries_per_month: number | null   // null = ilimitado
  // Uso atual
  plants_used: number
  grows_used: number
  ai_queries_used: number
  ai_queries_reset_at: string
  /** Next quota reset (day 1 of the next month). Older backends omit it. */
  ai_queries_renews_at?: string
}

export interface EnvironmentMeasurement {
  value: number | null
  unit: string
  source: 'manual' | 'sensor' | null
  source_id: string | null
  observed_at: string | null
}

export interface GrowEnvSnapshot {
  temperature?: EnvironmentMeasurement
  humidity?: EnvironmentMeasurement
  light?: EnvironmentMeasurement
  vpd?: EnvironmentMeasurement
  temp_c: number | null
  humidity_rh: number | null
  vpd_kpa: number | null
  lux: number | null
  recorded_at: string | null
  last_event_at: string | null
  last_watering_at: string | null
}

export interface GrowSummary {
  id: string
  name: string
  grow_type: 'indoor' | 'outdoor' | 'greenhouse'
  status: 'active' | 'harvested' | 'abandoned'
  start_date: string
  photoperiod_hours?: string | null
  photoperiod_light_minutes?: number | null
  pot_count: number
  active_plant_count: number
  days_running: number
  /** When it was archived; null for active grows and for those archived before the field existed. */
  archived_at?: string | null
  /** Place of the environment (UX item 11): coordinates with 2 decimals and the readable name ("Campinas, SP"). */
  lat?: number | null
  lon?: number | null
  location_label?: string | null
  env?: GrowEnvSnapshot | null
}

export interface GrowResponse {
  id: string
  user_id: string
  name: string
  grow_type: 'indoor' | 'outdoor' | 'greenhouse'
  status: 'active' | 'harvested' | 'abandoned'
  start_date: string
  archived_at?: string | null
  pot_count?: number
  active_plant_count?: number
  days_running?: number
  end_date: string | null
  tent_width_cm: number | null
  tent_depth_cm: number | null
  tent_height_cm: number | null
  lighting_watts: number | null
  light_type: 'led_quantum_board' | 'led_cob' | 'hps_hid' | 'cmh' | 'fluorescent' | 'other' | null
  light_distance_cm: number | null
  /** Derived by the server from photoperiod_light_minutes: "18/6", "17h45/6h15", "24/0"; legacy "custom". Never sent by the app. */
  photoperiod_hours: string | null
  photoperiod_on_at?: string | null
  /** Minutes of light per day (1–1440). The off time is on_at + minutes, computed in the app. */
  photoperiod_light_minutes?: number | null
  light_leak_controlled: boolean | null
  exhaust_type: 'inline_fan' | 'axial_fan' | 'pc_fans' | 'none' | null
  exhaust_cfm?: number | null
  /** Power set on the exhaust controller (0–100, steps of 5): a record, never a command. The server sets the date. */
  exhaust_power_pct?: number | null
  exhaust_power_updated_at?: string | null
  exhaust_location?: 'copa' | 'base' | string | null
  carbon_filter: boolean | null
  intake_type: 'active_fan' | 'passive' | 'none' | null
  internal_circulation_fans: number | null
  negative_pressure: boolean | null
  fans?: Array<{ location?: string; watts?: number; on?: boolean }> | null
  air_conditioning: boolean | null
  dehumidifier: boolean | null
  humidifier: boolean | null
  heater: boolean | null
  target_temp_c?: number | null
  target_humidity_rh?: number | null
  lat?: number | null
  lon?: number | null
  location_label?: string | null
  sun_exposure?: 'full' | 'partial' | 'shade' | string | null
  rain_protection?: 'none' | 'cover' | 'greenhouse' | string | null
  pot_type: 'fabric' | 'plastic' | 'air_pot' | 'other' | null
  substrate_type: 'mineral_soil' | 'coco' | 'organic_supersoil' | 'hydro_dwc' | 'other' | null
  has_environment_sensors: boolean
  notes: string | null
  created_at: string
  updated_at: string
  env?: GrowEnvSnapshot | null
  plants?: GrowPlantBrief[]
}

export interface GrowPlantBrief {
  id: string
  display_name?: string | null
  strain_name: string
  current_phase: string
  is_active: boolean
  germination_date: string | null
}

export type GrowUpdate = Partial<Omit<GrowResponse, 'id' | 'user_id' | 'status' | 'start_date' | 'end_date' | 'created_at' | 'updated_at'>>

export interface PlantResponse {
  id: string
  user_id: string
  display_name?: string | null
  strain_name: string
  strain_type: 'photo' | 'auto' | 'unknown'
  genetics: 'indica' | 'sativa' | 'hybrid' | null
  seed_type: 'feminized' | 'regular' | 'unknown'
  current_phase: string
  is_active: boolean
  grow_id: string
  grow_label: string | null       // legado; preferir grow_id
  pot_label: string | null        // ex: "Vaso 1"
  pot_volume_liters: number | null
  substrate: string | null
  germination_date: string | null
  flip_date: string | null
  harvest_date: string | null
  expected_harvest_days: number | null
  created_at: string
  updated_at: string
}

export interface PotResponse {
  id: string
  grow_id: string
  label: string
  volume_liters: number
  substrate: string | null
  position: number
  plant?: PlantResponse | null
}

export interface EventResponse {
  id: string
  plant_id: string
  event_type: string
  event_date: string
  ppm: number | null
  ph_in: number | null
  ph_out: number | null
  water_volume_ml: number | null
  temperature_c: number | null
  humidity_rh: number | null
  weight_g: number | null
  severity: 'leve' | 'moderado' | 'grave' | null
  is_flush: boolean | null
  notes: string | null
  photo_keys: string[] | null
  created_at: string
}

export interface BobTipResponse {
  scenario: string
  tip: string
  priority: 'info' | 'warning' | 'urgent'
  icon: string
}

export interface EventAnalysisResponse {
  event_id: string
  status: 'saudavel' | 'atencao' | 'critico'
  resumo: string
  problemas: string[]
  recomendacoes: string[]
  observacao_foto: string | null
  photos_analyzed: number
}

export interface SensorReadingResponse {
  id: string
  device_id: string
  recorded_at: string
  temp_air: number | null
  humidity_air: number | null
  co2_ppm: number | null
  soil_moisture_pct: number | null
  ph_solution: number | null
  ec_ms_cm: number | null
  vpd_kpa: number | null
  lux: number | null
  temp_root: number | null
  light_leak: boolean | null
}

export type DeviceModuleType = 'hub' | 'satellite' | 'standalone'

export interface DeviceResponse {
  id: string
  grow_id: string | null
  pot_id: string | null
  plant_id: string | null
  name: string
  esp32_mac: string
  module_type: DeviceModuleType
  hub_mac: string | null
  is_paired: boolean
  is_online: boolean
  last_seen_at: string | null
  sensors_config: Record<string, unknown>
}

export interface PairDevicePayload {
  plant_id: string
  name: string
}

// ─── Strains (banco de dados de strains conhecidas) ──────────────────────────

/** Resultado resumido de busca de strain (autocomplete). */
export interface StrainSearchResult {
  id: string
  name: string
  slug: string
  aliases: string[] | null
  strain_type: 'photo' | 'auto' | null
  genetics: 'indica' | 'sativa' | 'hybrid' | null
}

/** Detalhe completo de uma strain — usado no card de informações da planta. */
export interface StrainResponse {
  id: string
  name: string
  slug: string
  aliases: string[] | null
  strain_type: 'photo' | 'auto' | null
  genetics: 'indica' | 'sativa' | 'hybrid' | null
  breeder: string | null
  // Free text in the strain bank ("17–20%").
  thc_pct: string | null
  cbd_pct: string | null
  dominant_terpene: string | null
  flowering_days: number | null
  height_cm: string | null
  summary: string | null
  source_file: string | null
}

// ─── Plant Summary (resumo de sensores/eventos por planta) ───────────────────

/**
 * Resumo agregado de leituras recentes de uma planta — inclui dados
 * compartilhados entre plantas do mesmo grow_label (calculado no backend).
 */
export interface PlantSummary {
  plant_id: string
  temperature?: EnvironmentMeasurement | null
  humidity?: EnvironmentMeasurement | null
  last_temperature_c: number | null
  last_temperature_at: string | null   // ISO datetime
  last_humidity_rh: number | null
  last_humidity_at: string | null
  last_ppm: number | null
  last_watering_at: string | null      // ISO datetime
  last_watering_has_fert: boolean
  // Imagem de capa da strain — usada como background do PlantCard
  strain_image_url: string | null
  /** Most recent event_date of the plant (UX item 9, U5); absent while the backend does not send it. */
  last_event_at?: string | null
}

// ─── Bob Alerts ─────────────────────────────────────────────────────────────

/**
 * Alerta gerado pelo Bob 2.0 para uma planta específica.
 * tier 'critical' = ação imediata necessária (rega atrasada, colheita vencida, etc.)
 */
export interface BobAlert {
  alert_id: string
  plant_id: string
  plant_name: string
  message: string
  tier: 'critical' | 'warning' | 'info'
}

export interface BobAlertsResponse {
  alerts: BobAlert[]
}

/** Payload enviado ao backend para registrar o push token do dispositivo. */
export interface PushTokenPayload {
  token: string
  platform: 'ios' | 'android'
}

// ─── Conversations ────────────────────────────────────────────────────────────

export interface ConversationSummary {
  id: string
  title: string | null
  grow_id: string | null
  plant_id: string | null
  created_at: string
  updated_at: string
  message_count: number
}

export interface ChatMessage {
  /** Present on messages saved since the backend of 2026-10 (feedback and regenerate use it). */
  id?: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  /** Assistant: what went into the prompt (kind, id, title, date, scope, plant_id, grow_id). */
  sources?: { kind: string; id: string; title: string; date: string | null; scope: string; plant_id?: string | null; grow_id?: string | null }[]
  /** User: photos sent by upload (bucket events). */
  photo_keys?: string[]
  /** Assistant: the person's current rating (GET /ai/conversations/{id}), or null when not rated. */
  feedback?: { rating: 'up' | 'down' | null; reason: string | null } | null
}

/** GET /plants/daily-brief: the Bobby summary of the day (cached 24 h by the server; it does not use the plan's queries). */
export interface DailyBriefResponse {
  title: string
  body: string
  urgent_count?: number
  severity?: 'ok' | 'attention' | 'urgent' | string
  plant_id?: string | null
  plant_name?: string | null
  cta_prompt?: string
  generated_at?: string
  reason_tags?: string[]
}
