// Copiado de letsgrow-mobile/lib/hubProvisioning.ts por scripts/sync-shared.mjs. Não edite aqui.
/**
 * Hub onboarding over BLE: the app side of the contract in hub-onboarding-ble-contrato.md (v1, 2026-11-24).
 * Pure functions only (no React Native imports) so the tests run in Node: UUIDs, JSON payloads, base64/UTF-8,
 * status → progress step, error → screen copy (Figma 27 · H5/H7), signal bars and pairing-window helpers.
 */

const uuid = (n: string) => `6c67${n}-4c47-4875-6200-000000000000`
export const HUB_SERVICE_UUID = uuid('0001')
export const HUB_CHAR = { info: uuid('0002'), scan: uuid('0003'), config: uuid('0004'), status: uuid('0005') } as const
export const HUB_NAME_PREFIX = 'LetsGrow-Hub-'
/** Contract: the app asks for MTU 247+ (Android requestMTU). */
export const HUB_MTU = 247
/** The Hub's configuration mode stays on for 15 min after boot. */
export const HUB_CONFIG_WINDOW_MIN = 15
/** Contract `scan`: up to 15 networks, by RSSI. */
export const MAX_NETWORKS = 15
/** H6: after `done` the Hub reboots; past this the screen says it still has not shown up. */
export const ONLINE_SLOW_MS = 2 * 60 * 1000
/** A claim code with less than this left is replaced before it goes to the Hub. */
export const CODE_MIN_LEFT_MS = 60 * 1000
/** Satellite pairing window (contract `pair_open` ttl_s). */
export const PAIRING_TTL_S = 60

export interface HubInfo { mac: string; fw: string; model: string; proto: number; relays: number }
export interface WifiNetwork { ssid: string; rssi: number; sec: boolean }
export type HubState = 'idle' | 'wifi_connecting' | 'wifi_failed' | 'activating' | 'activation_failed' | 'done'
export type HubErr = 'wifi_auth' | 'wifi_no_ap' | 'wifi_timeout' | 'http' | 'code_invalid' | 'code_expired' | 'bad_request'
export interface HubStatus { state: HubState; err?: string }
/** Errors the screen shows: the Hub's `err` values plus the app's own. */
export type ProvisionError = HubErr | 'ble_disconnected' | 'claim_failed' | 'unknown'

const HUB_STATES: HubState[] = ['idle', 'wifi_connecting', 'wifi_failed', 'activating', 'activation_failed', 'done']
const HUB_ERRS: HubErr[] = ['wifi_auth', 'wifi_no_ap', 'wifi_timeout', 'http', 'code_invalid', 'code_expired', 'bad_request']

// ─── Names and MACs ──────────────────────────────────────────────────────────

export function isHubName(name: string | null | undefined): name is string {
  return !!name && name.startsWith(HUB_NAME_PREFIX) && name.length > HUB_NAME_PREFIX.length
}
/** "LetsGrow-Hub-3F2A" → "3F2A" (last 4 hex of the MAC). */
export function hubSuffix(name: string): string { return name.slice(HUB_NAME_PREFIX.length).toUpperCase() }
/** Any MAC spelling → "AABBCCDDEEFF"; null when it is not 12 hex digits. */
export function normalizeMac(mac: string | null | undefined): string | null {
  const clean = (mac ?? '').replace(/[^A-Fa-f0-9]/g, '').toUpperCase()
  return clean.length === 12 ? clean : null
}
export function formatMac(mac: string): string {
  const clean = normalizeMac(mac)
  return clean ? clean.match(/.{2}/g)!.join(':') : mac
}

// ─── UTF-8 and base64 (BLE payloads travel as base64 in react-native-ble-plx) ──

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

export function utf8Encode(text: string): number[] {
  const out: number[] = []
  for (const ch of text) {
    const c = ch.codePointAt(0)!
    if (c < 0x80) out.push(c)
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63))
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63))
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63))
  }
  return out
}

export function utf8Decode(bytes: number[]): string {
  let out = ''
  for (let i = 0; i < bytes.length;) {
    const b = bytes[i++]
    let c: number
    if (b < 0x80) c = b
    else if (b >= 0xf0) c = ((b & 7) << 18) | ((bytes[i++] & 63) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63)
    else if (b >= 0xe0) c = ((b & 15) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63)
    else c = ((b & 31) << 6) | (bytes[i++] & 63)
    out += String.fromCodePoint(c)
  }
  return out
}

export function bytesToBase64(bytes: number[]): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const [a, b, c] = [bytes[i], bytes[i + 1], bytes[i + 2]]
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0)
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (b === undefined ? '=' : B64[(n >> 6) & 63]) + (c === undefined ? '=' : B64[n & 63])
  }
  return out
}

export function base64ToBytes(b64: string): number[] {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '')
  const out: number[] = []
  for (let i = 0; i < clean.length; i += 4) {
    const n = [0, 1, 2, 3].map(k => (i + k < clean.length ? B64.indexOf(clean[i + k]) : -1))
    const v = (n[0] << 18) | (n[1] << 12) | (Math.max(n[2], 0) << 6) | Math.max(n[3], 0)
    out.push((v >> 16) & 255)
    if (n[2] >= 0) out.push((v >> 8) & 255)
    if (n[3] >= 0) out.push(v & 255)
  }
  return out
}

export const textToBase64 = (text: string) => bytesToBase64(utf8Encode(text))
export const base64ToText = (b64: string) => utf8Decode(base64ToBytes(b64))

// ─── Payloads ────────────────────────────────────────────────────────────────

function parseJson(text: string | null | undefined): Record<string, unknown> | null {
  if (!text) return null
  try {
    const v = JSON.parse(text)
    return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null
  } catch { return null }
}

/** `info`: {"mac","fw","model","proto","relays"}; null when the MAC is missing or malformed. */
export function parseInfo(text: string | null | undefined): HubInfo | null {
  const v = parseJson(text)
  const mac = normalizeMac(typeof v?.mac === 'string' ? v.mac : null)
  if (!v || !mac) return null
  return {
    mac,
    fw: typeof v.fw === 'string' ? v.fw : '',
    model: typeof v.model === 'string' ? v.model : 'hub',
    proto: typeof v.proto === 'number' ? v.proto : 1,
    relays: typeof v.relays === 'number' ? v.relays : 0,
  }
}

/**
 * `scan`: {"nets":[{ssid,rssi,sec}]}. Hidden networks (empty SSID) are dropped, a name seen on several access
 * points keeps the strongest, the list goes strongest first and stops at 15. Null when it is not a scan result
 * yet (e.g. the Hub still answers {"op":"scan"}).
 */
export function parseScan(text: string | null | undefined): WifiNetwork[] | null {
  const v = parseJson(text)
  if (!v || !Array.isArray(v.nets)) return null
  const best = new Map<string, WifiNetwork>()
  for (const raw of v.nets as unknown[]) {
    const n = raw as Partial<WifiNetwork> | null
    if (!n || typeof n.ssid !== 'string' || !n.ssid.trim()) continue
    const net = { ssid: n.ssid, rssi: typeof n.rssi === 'number' ? n.rssi : -100, sec: n.sec !== false }
    const prev = best.get(net.ssid)
    if (!prev || net.rssi > prev.rssi) best.set(net.ssid, net)
  }
  return [...best.values()].sort((a, b) => b.rssi - a.rssi).slice(0, MAX_NETWORKS)
}

/** `status`: {"state","err"}; unknown states are ignored (null). */
export function parseStatus(text: string | null | undefined): HubStatus | null {
  const v = parseJson(text)
  if (!v || typeof v.state !== 'string' || !HUB_STATES.includes(v.state as HubState)) return null
  return { state: v.state as HubState, ...(typeof v.err === 'string' && v.err ? { err: v.err } : {}) }
}

export const SCAN_REQUEST = JSON.stringify({ op: 'scan' })

/** `config` write. An open network goes with an empty password. */
export function buildConfig({ ssid, pass, growId, code }: { ssid: string; pass: string; growId: string; code: string }): string {
  return JSON.stringify({ ssid, pass, grow_id: growId, code })
}

/** What blocks "CONECTAR HUB" (H4): empty SSID, a secured network without password, WPA's 8–63 chars. */
export function wifiFormError(ssid: string, pass: string, secured: boolean): string | null {
  if (!ssid.trim()) return 'Digite o nome da rede.'
  if (utf8Encode(ssid).length > 32) return 'O nome da rede passa de 32 caracteres.'
  if (!secured) return null
  if (!pass) return 'Digite a senha do Wi-Fi.'
  if (pass.length < 8) return 'Senhas de Wi-Fi têm pelo menos 8 caracteres.'
  if (utf8Encode(pass).length > 63) return 'A senha passa de 63 caracteres.'
  return null
}

// ─── Signal ──────────────────────────────────────────────────────────────────

/** H2/H3: 1–4 bars. */
export function signalBars(rssi: number): 1 | 2 | 3 | 4 {
  if (rssi >= -55) return 4
  if (rssi >= -67) return 3
  if (rssi >= -77) return 2
  return 1
}
export function signalLabel(rssi: number): string {
  const b = signalBars(rssi)
  return b >= 3 ? 'SINAL FORTE' : b === 2 ? 'SINAL MÉDIO' : 'SINAL FRACO'
}

// ─── Progress (H5) ───────────────────────────────────────────────────────────

export const PROGRESS_STEPS = [
  'Configuração enviada ao Hub',
  'Hub entrou no Wi-Fi',
  'Ativando na sua conta',
  'Hub reinicia e fica online',
] as const

/**
 * Index of the step in progress: idle (config not acknowledged yet) → 0, wifi_connecting → 1, activating → 2,
 * done → 3 (waiting for the Hub to show up online). Failed states keep the step that failed.
 */
export function progressIndex(state: HubState): number {
  switch (state) {
    case 'idle': return 0
    case 'wifi_connecting': case 'wifi_failed': return 1
    case 'activating': case 'activation_failed': return 2
    case 'done': return 3
  }
}

/** The failure in a status, if any. A failed state without `err` falls back to the generic error of that step. */
export function statusError(status: HubStatus): ProvisionError | null {
  if (status.state !== 'wifi_failed' && status.state !== 'activation_failed') return null
  if (status.err && HUB_ERRS.includes(status.err as HubErr)) return status.err as HubErr
  return status.state === 'wifi_failed' ? 'wifi_timeout' : 'http'
}

/**
 * Whether a status notification belongs to the current attempt. After a failure the app may write `config` again
 * (contract), and the first read or notify can still carry the previous failure: a failed state counts only once
 * this attempt showed progress (wifi_connecting / activating) or after `graceMs` since the write.
 */
export function acceptStatus(status: HubStatus, attempt: { written: boolean; sawProgress: boolean; msSinceWrite: number }, graceMs = 3000): boolean {
  if (!attempt.written) return false
  if (status.state !== 'wifi_failed' && status.state !== 'activation_failed') return true
  return attempt.sawProgress || attempt.msSinceWrite >= graceMs
}

// ─── Error copy (H7) ─────────────────────────────────────────────────────────

/** password → H4 again; network → H3; retry → same config again; rescan → H2. */
export type ErrorAction = 'password' | 'network' | 'retry' | 'rescan'
export interface ErrorCopy { title: string; body: string; primary: ErrorAction; secondary?: ErrorAction; newCode?: boolean }

export const ERROR_ACTION_LABEL: Record<ErrorAction, string> = {
  password: 'DIGITAR A SENHA DE NOVO',
  network: 'ESCOLHER OUTRA REDE',
  retry: 'TENTAR DE NOVO',
  rescan: 'PROCURAR DE NOVO',
}

export function errorCopy(err: ProvisionError, ssid?: string): ErrorCopy {
  const rede = ssid ? `da rede ${ssid}` : 'da rede'
  switch (err) {
    case 'wifi_auth': return { title: 'Senha do Wi-Fi incorreta', body: `O roteador ${rede} recusou a senha. Confira maiúsculas, minúsculas e espaços.`, primary: 'password', secondary: 'network' }
    case 'wifi_no_ap': return { title: 'Rede não encontrada', body: 'O Hub não achou a rede. Aproxime o Hub do roteador e confira se a rede é de 2,4 GHz.', primary: 'network', secondary: 'retry' }
    case 'wifi_timeout': return { title: 'O Wi-Fi não respondeu', body: 'O roteador demorou demais para responder.', primary: 'retry', secondary: 'network' }
    case 'http': return { title: 'Sem internet no Hub', body: 'O Hub entrou no Wi-Fi, mas não chegou ao Let\'s Grow. Confira se a internet da casa está funcionando.', primary: 'retry', secondary: 'network' }
    case 'code_invalid':
    case 'code_expired': return { title: 'Código de vínculo venceu', body: 'Já pedimos um código novo. É só tentar de novo.', primary: 'retry', newCode: true }
    case 'bad_request': return { title: 'Dados incompletos', body: 'Algo se perdeu no envio. Se repetir, tire o Hub da tomada e ligue de novo.', primary: 'retry', secondary: 'network' }
    case 'claim_failed': return { title: 'Sem código de vínculo', body: 'Não deu para pedir o código ao Let\'s Grow. Confira a internet do celular e tente de novo.', primary: 'retry', secondary: 'rescan' }
    case 'ble_disconnected': return { title: 'A conexão com o Hub caiu', body: `Chegue mais perto e procure de novo. Se passaram ${HUB_CONFIG_WINDOW_MIN} minutos, tire o Hub da tomada e ligue de novo.`, primary: 'rescan' }
    default: return { title: 'Não deu para conectar', body: 'Tente de novo. Se repetir, tire o Hub da tomada e ligue de novo.', primary: 'retry', secondary: 'rescan' }
  }
}

// ─── Claim code and devices ──────────────────────────────────────────────────

/** A new claim code is needed when there is none or it has less than a minute left. */
export function needsNewCode(code: { expires_at: string } | null, now = Date.now()): boolean {
  if (!code) return true
  const t = Date.parse(code.expires_at)
  return !Number.isFinite(t) || t - now < CODE_MIN_LEFT_MS
}

interface DeviceLike { id: string; esp32_mac: string; module_type: string; is_paired: boolean; is_online: boolean }

/** The Hub registered for this MAC (backend `activate` creates it with module_type "hub"). */
export function findHub<T extends DeviceLike>(devices: T[] | undefined, mac: string): T | null {
  const target = normalizeMac(mac)
  return devices?.find(d => d.module_type === 'hub' && normalizeMac(d.esp32_mac) === target) ?? null
}

/** The grow's Hub for S1: an online one first. */
export function growHub<T extends DeviceLike>(devices: T[] | undefined): T | null {
  const hubs = devices?.filter(d => d.module_type === 'hub') ?? []
  return hubs.find(d => d.is_online) ?? hubs[0] ?? null
}

/** Seconds left in the satellite pairing window (S2), never negative. */
export function secondsLeft(expiresAt: number, now = Date.now()): number {
  return Math.max(0, Math.ceil((expiresAt - now) / 1000))
}

/** S2: a pending device that was not pending when the window opened. */
export function newPendingDevice<T extends DeviceLike>(devices: T[] | undefined, before: ReadonlySet<string>): T | null {
  return devices?.find(d => !d.is_paired && d.module_type !== 'hub' && !before.has(d.id)) ?? null
}

/** S1/S2: why "Adicionar satélite" could not open the window. */
export function pairingErrorCopy(status: number | undefined): string {
  if (status === 503) return 'O servidor não conseguiu falar com o Hub agora. Tente de novo em instantes.'
  if (status === 404 || status === 409) return 'Este Hub não foi encontrado na sua conta.'
  return 'O Hub está offline ou sem internet. Confira a tomada e o Wi-Fi.'
}
