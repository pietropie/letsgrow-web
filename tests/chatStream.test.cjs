// Copiado de letsgrow-mobile/tests/chatStream.test.cjs por scripts/sync-shared.mjs.
// Bobby streaming (POST /ai/chat/stream), fallback, cancel and per-answer feedback (UX item 10, backend 9cb6dfc).
process.env.TZ = 'America/Sao_Paulo'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createSseParser, createUtf8Decoder, readChatStream, sendChat, feedbackBody, offensiveFallback, sourceChip, FEEDBACK_REASONS, savedRatings,
  StreamUnavailable, StreamFailed, ChatCancelled } = require('../src/shared/lib/chatStream.ts')

const enc = new TextEncoder()
/** A reader that hands out the given byte chunks, like ReadableStream.getReader(). */
function reader(chunks, { failAt = -1, signal } = {}) {
  let i = 0
  return { async read() {
    if (i === failAt) { if (signal) signal.aborted = true; throw new Error('aborted') }
    return i < chunks.length ? { done: false, value: chunks[i++] } : { done: true }
  } }
}
const sse = (event, data) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
/** Splits a string's bytes every `size` bytes, so events and multi-byte characters fall between chunks. */
const split = (text, size) => { const b = enc.encode(text); const out = []; for (let i = 0; i < b.length; i += size) out.push(b.slice(i, i + size)); return out }

const FULL = sse('status', { stage: 'context', records: 12, text: 'lendo 12 registros da Aurora' })
  + sse('delta', { text: 'Pelos seus registros, ' }) + sse('delta', { text: '**não** é nitrogênio.' })
  + sse('sources', { sources: [{ kind: 'event', id: 'e1', title: 'Rega · pH 6,8', date: '2026-10-21', scope: 'focus', plant_id: 'p1' }] })
  + sse('done', { conversation_id: 'c1', message_id: 'm2', user_message_id: 'm1' })

test('SSE parser: events split between chunks, CRLF, comments and multi-line data', () => {
  const got = []
  const p = createSseParser(e => got.push(e))
  p.push('event: sta'); p.push('tus\r\ndata: {"a"'); p.push(':1}\r\n\r\n: ping\n\nevent: delta\ndata: um\ndata: dois\n')
  p.push('\n')
  p.push('data: sem fim'); p.end()
  assert.deepEqual(got, [{ event: 'status', data: '{"a":1}' }, { event: 'delta', data: 'um\ndois' }, { event: 'message', data: 'sem fim' }])
})

test('UTF-8 decoder keeps a character split between chunks', () => {
  const d = createUtf8Decoder()
  const bytes = enc.encode('nitrogênio ã 🌱')
  const out = [...bytes].map(b => d(Uint8Array.of(b))).join('')
  assert.equal(out, 'nitrogênio ã 🌱')
})

test('stream reader: status, deltas, sources and done, with chunks of 7 bytes', async () => {
  const statuses = [], texts = []
  const r = await readChatStream(reader(split(FULL, 7)), { onStatus: t => statuses.push(t), onDelta: (_, full) => texts.push(full) })
  assert.deepEqual(statuses, ['lendo 12 registros da Aurora'])
  assert.deepEqual(texts, ['Pelos seus registros, ', 'Pelos seus registros, **não** é nitrogênio.'])
  assert.equal(r.reply, 'Pelos seus registros, **não** é nitrogênio.')
  assert.deepEqual([r.conversation_id, r.message_id, r.user_message_id, r.sources.length, r.stats.deltas], ['c1', 'm2', 'm1', 1, 2])
})

test('stream reader: error event and a stream that ends before done fail', async () => {
  await assert.rejects(readChatStream(reader([enc.encode(sse('delta', { text: 'a' }) + sse('error', { message: 'A resposta não chegou.' }))])), e => e instanceof StreamFailed && e.message === 'A resposta não chegou.')
  await assert.rejects(readChatStream(reader([enc.encode(sse('delta', { text: 'a' }))])), StreamFailed)
})

test('cancel: an aborted read is a cancel, never a failure', async () => {
  const signal = { aborted: false }
  await assert.rejects(readChatStream(reader(split(FULL, 40), { failAt: 1, signal }), {}, signal), ChatCancelled)
})

test('fallback: POST only when the stream cannot start', async () => {
  let posts = 0
  const fallback = async () => { posts++; return 'post' }
  assert.deepEqual(await sendChat({ stream: async () => 'stream', fallback }), { result: 'stream', streamed: true })
  assert.deepEqual(await sendChat({ stream: async () => { throw new StreamUnavailable('no body') }, fallback }), { result: 'post', streamed: false })
  // After the stream started, or after a stop, the question is not sent twice.
  await assert.rejects(sendChat({ stream: async () => { throw new StreamFailed('x') }, fallback }), StreamFailed)
  await assert.rejects(sendChat({ stream: async () => { throw new StreamUnavailable('x') }, fallback, signal: { aborted: true } }), ChatCancelled)
  // Credit and limit errors (HTTP before the stream) go to the screen, not to the POST.
  const http = Object.assign(new Error('HTTP 402'), { response: { status: 402, data: { detail: { code: 'quote_required' } } } })
  await assert.rejects(sendChat({ stream: async () => { throw http }, fallback }), e => e === http)
  assert.equal(posts, 1)
})

test('feedback: like and dislike switch on the same answer; a reason only with dislike', () => {
  assert.deepEqual(feedbackBody('c1', 'm2', 'up'), { conversation_id: 'c1', message_id: 'm2', rating: 'up' })
  assert.deepEqual(feedbackBody('c1', 'm2', 'down', 'wrong_record'), { conversation_id: 'c1', message_id: 'm2', rating: 'down', reason: 'wrong_record' })
  assert.deepEqual(feedbackBody('c1', 'm2', 'down', 'other', '  troquei a luz  '), { conversation_id: 'c1', message_id: 'm2', rating: 'down', reason: 'other', message: 'troquei a luz' })
  assert.throws(() => feedbackBody('c1', 'm2', 'up', 'not_helpful'), /não gostei/)
  assert.throws(() => feedbackBody('', 'm2', 'down'))
  assert.deepEqual(FEEDBACK_REASONS.map(r => r.label), ['Usou um registro errado ou antigo', 'Faltou contexto', 'A resposta não ajudou', 'Conteúdo ofensivo ou inadequado', 'Outro motivo'])
})


test('feedback: an offensive report still reaches a backend that does not know the reason yet', () => {
  const body = feedbackBody('c1', 'm2', 'down', 'offensive')
  assert.deepEqual(body, { conversation_id: 'c1', message_id: 'm2', rating: 'down', reason: 'offensive' })
  assert.deepEqual(offensiveFallback(body), { conversation_id: 'c1', message_id: 'm2', rating: 'down', reason: 'other', message: 'Conteúdo ofensivo ou inadequado' })
  assert.equal(offensiveFallback(feedbackBody('c1', 'm2', 'down', 'offensive', 'xingou')).message, 'Conteúdo ofensivo ou inadequado: xingou')
  assert.equal(offensiveFallback(feedbackBody('c1', 'm2', 'down', 'not_helpful')), null)
  assert.equal(offensiveFallback(feedbackBody('c1', 'm2', 'up')), null)
})
test('source chips: date after the type, tone by type, records open their screen', () => {
  assert.deepEqual(sourceChip({ kind: 'event', id: 'e1', title: 'Rega · pH 6,8', date: '2026-10-21', scope: 'focus', plant_id: 'p1' }),
    { label: 'Rega · 21 out · pH 6,8', tone: 'watering', target: { kind: 'event', eventId: 'e1', plantId: 'p1' } })
  assert.equal(sourceChip({ kind: 'event', id: 'e2', title: 'Nutrição', date: '2026-10-12T14:00:00-03:00', scope: 'focus', plant_id: 'p1' }).label, 'Nutrição · 12 out')
  assert.equal(sourceChip({ kind: 'event', id: 'e3', title: 'Nota', date: '2026-10-12', scope: 'focus', plant_id: 'p1' }).tone, 'other')
  assert.deepEqual(sourceChip({ kind: 'environment_reading', id: 'r1', title: 'Registro do ambiente · 24 °C', date: '2026-10-20T10:00:00-03:00', scope: 'focus', grow_id: 'g1' }),
    { label: 'Registro do ambiente · 20 out · 24 °C', tone: 'other', target: { kind: 'reading', readingId: 'r1', growId: 'g1' } })
  assert.deepEqual(sourceChip({ kind: 'knowledge', id: 'k1', title: 'Guia · pH e absorção', date: null, scope: 'knowledge' }), { label: 'Guia · pH e absorção', tone: 'knowledge', target: null })
  assert.deepEqual(sourceChip({ kind: 'photo', id: 'inline-0', title: 'Foto enviada', date: null, scope: 'message' }), { label: 'Foto enviada', tone: 'photo', target: null })
})

test('saved ratings come back with the conversation, with or without feedback', () => {
  const messages = [
    { id: 'u1', role: 'user', content: 'a' },
    { id: 'a1', role: 'assistant', content: 'b', feedback: { rating: 'up', reason: null } },
    { id: 'a2', role: 'assistant', content: 'c', feedback: { rating: 'down', reason: 'wrong_record' } },
    { id: 'a3', role: 'assistant', content: 'd', feedback: null },
    { id: 'a4', role: 'assistant', content: 'e' },
    { role: 'assistant', content: 'old answer without id', feedback: { rating: 'up', reason: null } },
    { id: 'a5', role: 'assistant', content: 'f', feedback: { rating: 'down', reason: 'unknown' } },
    { id: 'a6', role: 'assistant', content: 'g', feedback: { rating: null, reason: null } },
  ]
  assert.deepEqual(savedRatings(messages), {
    a1: { rating: 'up', reason: null },
    a2: { rating: 'down', reason: 'wrong_record' },
    a5: { rating: 'down', reason: null },
  })
  // Older backend: no feedback field at all.
  assert.deepEqual(savedRatings([{ id: 'a1', role: 'assistant', content: 'b' }]), {})
})
