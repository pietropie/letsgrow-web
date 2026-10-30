// Copiado de letsgrow-mobile/lib/chatStream.ts por scripts/sync-shared.mjs. Não edite aqui.
/**
 * Bobby chat over Server-Sent Events (POST /ai/chat/stream) and the per-answer rules of UX item 10. Pure: no runtime
 * imports, so the Node tests cover the parser, the stream reader, the fallback and the feedback rules.
 *
 * Events: `status` {stage, records, text}, `delta` {text}, `sources` {sources[]}, `done` {conversation_id, message_id,
 * user_message_id, ...} and `error` {message}. Closing the connection before `done` cancels: the server releases the
 * reservation and saves nothing.
 */

export type ChatSource = {
  kind: 'event' | 'environment_reading' | 'knowledge' | 'photo' | string
  id: string
  title: string
  date: string | null
  scope: string
  plant_id?: string | null
  grow_id?: string | null
}
export type ChatResult = { conversation_id: string; reply: string; message_id: string | null; user_message_id: string | null; sources: ChatSource[] }

/** The stream could not start (no streaming body, network, gateway, expired token): send by POST /ai/chat instead. */
export class StreamUnavailable extends Error {}
/** The answer failed after the stream started (`error` event, or the connection ended before `done`). */
export class StreamFailed extends Error {}
/** The person stopped the answer. Nothing was saved or charged. */
export class ChatCancelled extends Error {}
/** A non-2xx answer before the stream, shaped like an axios error so the existing credit and limit helpers read it. */
export class HttpError extends Error {
  response: { status: number; data: unknown }
  constructor(status: number, data: unknown) {
    super(`HTTP ${status}`)
    this.response = { status, data }
  }
}

/** UTF-8 decoder that keeps a character split between two chunks ("ã" = C3 A3) for the next call. */
export function createUtf8Decoder() {
  let rest: number[] = []
  return (chunk: Uint8Array): string => {
    const bytes = rest.length ? [...rest, ...chunk] : Array.from(chunk)
    let end = bytes.length
    // Walk back over an incomplete trailing sequence.
    for (let i = Math.max(0, bytes.length - 3); i < bytes.length; i++) {
      const b = bytes[i]
      const need = b >= 0xf0 ? 4 : b >= 0xe0 ? 3 : b >= 0xc0 ? 2 : 0
      if (need && i + need > bytes.length) { end = i; break }
    }
    rest = bytes.slice(end)
    let out = ''
    for (let i = 0; i < end;) {
      const b = bytes[i]
      let cp: number, len: number
      if (b < 0x80) { cp = b; len = 1 }
      else if (b >= 0xf0) { cp = ((b & 0x07) << 18) | ((bytes[i + 1] & 0x3f) << 12) | ((bytes[i + 2] & 0x3f) << 6) | (bytes[i + 3] & 0x3f); len = 4 }
      else if (b >= 0xe0) { cp = ((b & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f); len = 3 }
      else if (b >= 0xc0) { cp = ((b & 0x1f) << 6) | (bytes[i + 1] & 0x3f); len = 2 }
      else { cp = 0xfffd; len = 1 }
      out += String.fromCodePoint(cp)
      i += len
    }
    return out
  }
}

export type SseEvent = { event: string; data: string }
/** SSE text parser: events end with a blank line; `data:` lines join with "\n"; comments (":") are ignored. */
export function createSseParser(onEvent: (e: SseEvent) => void) {
  let buffer = ''
  let event = 'message'
  let data: string[] = []
  const line = (raw: string) => {
    if (raw === '') {
      if (data.length) onEvent({ event, data: data.join('\n') })
      event = 'message'; data = []
      return
    }
    if (raw.startsWith(':')) return
    const colon = raw.indexOf(':')
    const field = colon < 0 ? raw : raw.slice(0, colon)
    let value = colon < 0 ? '' : raw.slice(colon + 1)
    if (value.startsWith(' ')) value = value.slice(1)
    if (field === 'event') event = value
    else if (field === 'data') data.push(value)
  }
  return {
    push(text: string) {
      buffer += text
      let nl: number
      while ((nl = buffer.search(/\r\n|\n|\r/)) >= 0) {
        const sep = buffer[nl] === '\r' && buffer[nl + 1] === '\n' ? 2 : 1
        line(buffer.slice(0, nl))
        buffer = buffer.slice(nl + sep)
      }
    },
    /** Flushes an event the server closed without the final blank line. */
    end() { if (buffer) { line(buffer); buffer = '' } line('') },
  }
}

export type StreamHandlers = {
  /** "lendo 12 registros da Aurora" (B2), before the first piece of text. */
  onStatus?: (text: string, records: number) => void
  /** Each piece and the text so far. */
  onDelta?: (piece: string, text: string) => void
}
export type StreamStats = { statusMs: number | null; deltas: number; firstDeltaMs: number | null; lastDeltaMs: number | null }

/**
 * Reads the stream until `done`. Throws StreamFailed on an `error` event or when the stream ends without `done`, and
 * ChatCancelled when `signal` was aborted. `now` is injectable for the timing stats (buffering check).
 */
export async function readChatStream(reader: { read(): Promise<{ done: boolean; value?: Uint8Array }> }, handlers: StreamHandlers = {},
  signal?: { aborted: boolean }, now: () => number = Date.now): Promise<ChatResult & { stats: StreamStats }> {
  const decode = createUtf8Decoder()
  const started = now()
  const stats: StreamStats = { statusMs: null, deltas: 0, firstDeltaMs: null, lastDeltaMs: null }
  let text = ''
  let sources: ChatSource[] = []
  let done: Record<string, unknown> | null = null
  let failure: string | null = null
  const parser = createSseParser(({ event, data }) => {
    let payload: any
    try { payload = JSON.parse(data) } catch { return }
    if (event === 'status') stats.statusMs ??= now() - started
    if (event === 'status') handlers.onStatus?.(String(payload?.text ?? ''), Number(payload?.records) || 0)
    else if (event === 'delta' && typeof payload?.text === 'string') {
      const at = now() - started
      stats.deltas++; stats.firstDeltaMs ??= at; stats.lastDeltaMs = at
      text += payload.text
      handlers.onDelta?.(payload.text, text)
    } else if (event === 'sources' && Array.isArray(payload?.sources)) sources = payload.sources
    else if (event === 'done') done = payload ?? {}
    else if (event === 'error') failure = String(payload?.message ?? '') || 'A resposta não chegou.'
  })
  try {
    for (;;) {
      const { done: end, value } = await reader.read()
      if (end) break
      if (value) parser.push(decode(value))
      if (failure || done) break
    }
    parser.end()
  } catch (e) {
    if (signal?.aborted) throw new ChatCancelled()
    throw new StreamFailed((e as Error)?.message ?? 'stream')
  }
  if (signal?.aborted) throw new ChatCancelled()
  if (failure) throw new StreamFailed(failure)
  if (!done) throw new StreamFailed('A resposta terminou antes do fim.')
  const d = done as Record<string, any>
  return { conversation_id: String(d.conversation_id ?? ''), reply: text, message_id: d.message_id ?? null, user_message_id: d.user_message_id ?? null, sources, stats }
}

/**
 * Streaming first; POST /ai/chat when the stream cannot start. Never falls back after a stop (the person asked to
 * stop) or after the stream started (the server already answered or failed with its own message).
 */
export async function sendChat<R>(opts: { stream: () => Promise<R>; fallback: () => Promise<R>; signal?: { aborted: boolean } }): Promise<{ result: R; streamed: boolean }> {
  try {
    return { result: await opts.stream(), streamed: true }
  } catch (e) {
    if (opts.signal?.aborted || e instanceof ChatCancelled) throw new ChatCancelled()
    if (!(e instanceof StreamUnavailable)) throw e
  }
  return { result: await opts.fallback(), streamed: false }
}

// ── Per-answer feedback (POST /bob/feedback) ─────────────────────────────────────────────────────────────────────

export type FeedbackReason = 'wrong_record' | 'missing_context' | 'not_helpful' | 'other'
/** B7 "O que não estava certo?": labels and lines from the Figma (2353:15795). */
export const FEEDBACK_REASONS: { key: FeedbackReason; label: string; sub: string }[] = [
  { key: 'wrong_record', label: 'Usou um registro errado ou antigo', sub: 'Abrir os registros usados e corrigir' },
  { key: 'missing_context', label: 'Faltou contexto', sub: 'Ex.: troquei o substrato, mudei a luz' },
  { key: 'not_helpful', label: 'A resposta não ajudou', sub: 'Sem corrigir nada' },
  { key: 'other', label: 'Outro motivo', sub: 'Escrever com suas palavras' },
]

/** Body of a rating. A reason only goes with "down"; the answer is always identified by both ids. */
export function feedbackBody(conversationId: string, messageId: string, rating: 'up' | 'down', reason?: FeedbackReason | null, message?: string | null) {
  if (!conversationId || !messageId) throw new Error('A avaliação precisa da conversa e da resposta.')
  if (rating === 'up' && reason) throw new Error("Motivo só vale para 'não gostei'.")
  const text = message?.trim()
  return { conversation_id: conversationId, message_id: messageId, rating, ...(rating === 'down' && reason ? { reason } : {}), ...(text ? { message: text.slice(0, 1000) } : {}) }
}

// ── Sources (B3 chips) ───────────────────────────────────────────────────────────────────────────────────────────

const MONTH_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
export type SourceTone = 'watering' | 'nutrient' | 'photo' | 'knowledge' | 'other'
export type SourceTarget = { kind: 'event'; eventId: string; plantId: string } | { kind: 'reading'; readingId: string; growId: string } | null

/**
 * Chip of a source as in B3: the date goes after the type ("Rega · 21 out · pH 6,8"); the tone follows the type
 * (rega, nutrição, foto, guia; the Figma has no color for the others); a record opens its own screen.
 */
export function sourceChip(src: ChatSource): { label: string; tone: SourceTone; target: SourceTarget } {
  const day = src.date ? (src.date.includes('T') ? new Date(src.date) : new Date(+src.date.slice(0, 4), +src.date.slice(5, 7) - 1, +src.date.slice(8, 10))) : null
  const when = day && !isNaN(day.getTime()) ? `${day.getDate()} ${MONTH_SHORT[day.getMonth()]}` : null
  const [head, ...rest] = src.title.split(' · ')
  const label = when && (src.kind === 'event' || src.kind === 'environment_reading') ? [head, when, ...rest].join(' · ') : src.title
  const tone: SourceTone = src.kind === 'knowledge' ? 'knowledge' : src.kind === 'photo' ? 'photo'
    : src.kind === 'event' && head === 'Rega' ? 'watering' : src.kind === 'event' && head === 'Nutrição' ? 'nutrient' : 'other'
  const target: SourceTarget = src.kind === 'event' && src.plant_id ? { kind: 'event', eventId: src.id, plantId: src.plant_id }
    : src.kind === 'environment_reading' && src.grow_id ? { kind: 'reading', readingId: src.id, growId: src.grow_id } : null
  return { label, tone, target }
}

export type SavedRating = { rating: 'up' | 'down'; reason: FeedbackReason | null }
const REASONS: FeedbackReason[] = ['wrong_record', 'missing_context', 'not_helpful', 'other']
/**
 * The person's current rating of each saved answer (GET /ai/conversations/{id}: `feedback` {rating, reason} on
 * assistant messages since backend 084c43a). Answers without `feedback`, older backends and unknown values are skipped.
 */
export function savedRatings(messages: { id?: string; role: string; feedback?: { rating?: string | null; reason?: string | null } | null }[]): Record<string, SavedRating> {
  const out: Record<string, SavedRating> = {}
  for (const m of messages) {
    const rating = m.feedback?.rating
    if (m.role !== 'assistant' || !m.id || (rating !== 'up' && rating !== 'down')) continue
    const reason = m.feedback?.reason as FeedbackReason | null | undefined
    out[m.id] = { rating, reason: rating === 'down' && reason && REASONS.includes(reason) ? reason : null }
  }
  return out
}
