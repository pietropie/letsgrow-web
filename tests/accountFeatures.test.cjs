// Copiado de letsgrow-mobile/tests/accountFeatures.test.cjs por scripts/sync-shared.mjs.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { parseBrDateTime, brDateTimeText } = require('../src/shared/lib/dates.ts')
const {
  evidenceTitle, evidenceLines, evidenceSource, firstManualEvidence, mixedEvidence,
  parseClock, parseQuietRange, quietRangeText, clockInQuietRange,
  formatBRL, validityText, historyCard, creditErrorCode,
} = require('../src/shared/lib/accountFeatures.ts')

const evidence = (kind, extra = {}) => ({ kind, id: kind + '-1', observed_at: '2026-10-14T18:20:00', source: 'manual', plant_id: null, grow_id: 'g', values: {}, ...extra })

test('environment record date: validated, never guessed or in the future', () => {
  const now = new Date(2026, 9, 17, 12, 0)
  assert.equal(parseBrDateTime('15/10/2026 09:40', now).getTime(), new Date(2026, 9, 15, 9, 40).getTime())
  assert.equal(parseBrDateTime('31/02/2026 09:40', now), null)
  assert.equal(parseBrDateTime('15/10/2026 24:10', now), null)
  assert.equal(parseBrDateTime('18/10/2026 09:40', now), null)
  assert.equal(parseBrDateTime('', now), null)
  assert.equal(brDateTimeText(new Date(2026, 9, 5, 7, 3)), '05/10/2026 07:03')
})

test('observation base shows only the values each record has', () => {
  const manual = evidence('environment_reading', { values: { temperature_c: 28, humidity_rh: 58 } })
  assert.deepEqual(evidenceLines(manual), ['Temperatura: 28 °C', 'Umidade: 58%'])
  assert.equal(evidenceSource(manual), 'Fonte: registro manual')
  assert.equal(evidenceTitle(manual), '14 out · 18:20')
  const sensor = evidence('sensor_reading', { source: 'sensor', observed_at: '2026-10-12T09:40:00', values: { temperature_c: 27.25 } })
  assert.deepEqual(evidenceLines(sensor), ['Temperatura: 27,3 °C'])
  assert.equal(evidenceSource(sensor), 'Fonte: sensor')
  const plant = evidence('plant', { observed_at: null, values: { current_phase: 'flower', flip_date: '2026-09-01' } })
  assert.equal(evidenceTitle(plant), 'Dados cadastrados na planta')
  assert.deepEqual(evidenceLines(plant), ['Fase: floração', 'Início da flora: 1 set'])
  assert.deepEqual(evidenceLines(evidence('event', { values: { event_type: 'watering', ph_in: 6.2 } })), ['Rega', 'pH: 6,2'])
})

test('only manual records are offered for correction; mixed sources are flagged', () => {
  const sensor = evidence('sensor_reading', { source: 'sensor' })
  const manual = evidence('environment_reading', { observed_at: '2026-10-12T09:40:00' })
  assert.equal(firstManualEvidence([sensor]), null)
  assert.equal(firstManualEvidence([sensor, manual]), manual)
  assert.equal(firstManualEvidence([evidence('event')]), null) // a diary record needs its plant to be opened
  assert.equal(mixedEvidence([sensor, manual]), true)
  assert.equal(mixedEvidence([manual]), false)
})

test('notification times follow the server rules', () => {
  assert.equal(parseClock('7:05'), '07:05')
  assert.equal(parseClock('24:00'), null)
  assert.equal(parseClock('19h'), null)
  assert.deepEqual(parseQuietRange('21:00 às 08:00'), { start: '21:00', end: '08:00' })
  assert.deepEqual(parseQuietRange('22:30-6:00'), { start: '22:30', end: '06:00' })
  assert.equal(parseQuietRange(''), null)
  assert.equal(parseQuietRange('21:00 às 21:00'), 'invalid')
  assert.equal(parseQuietRange('à noite'), 'invalid')
  assert.equal(quietRangeText({ quiet_start: '21:00', quiet_end: '08:00' }), '21:00 às 08:00')
  assert.equal(quietRangeText({ quiet_start: null, quiet_end: null }), '')
  const night = { start: '21:00', end: '08:00' }
  assert.equal(clockInQuietRange('23:00', night), true)
  assert.equal(clockInQuietRange('07:59', night), true)
  assert.equal(clockInQuietRange('08:00', night), false)
  assert.equal(clockInQuietRange('19:00', night), false)
  assert.equal(clockInQuietRange('13:00', { start: '12:00', end: '14:00' }), true)
})

test('credit texts come from the server values', () => {
  assert.equal(formatBRL(19.9), 'R$ 19,90')
  assert.equal(validityText(365), 'Validade: 12 meses após a compra')
  assert.equal(validityText(90), 'Validade: 3 meses após a compra')
  assert.equal(validityText(45), 'Validade: 45 dias após a compra')
  assert.equal(validityText(null), 'Sem prazo de validade')
  const base = { id: 'x', title: 'Mensagem ao Bobby', amount: -3, cost: 3, task_key: 'chat_message', task_ref: 'c1', failure_reason: null, occurred_at: '2026-10-15T12:00:00' }
  assert.deepEqual(historyCard({ ...base, type: 'task', status: 'captured' }), { title: 'Mensagem ao Bobby · 15 out', body: '3 créditos utilizados', meta: 'Concluído' })
  assert.deepEqual(historyCard({ ...base, type: 'task', status: 'released', amount: 0, failure_reason: 'Falha técnica' }),
    { title: 'Tentativa anterior · 15 out', body: 'Reserva de 3 créditos liberada', meta: 'Falha técnica · consumo final: 0' })
  assert.equal(historyCard({ ...base, type: 'grant_plan', status: null, title: 'Créditos do plano · out 2026', amount: 120 }).body, '+120 créditos')
  assert.equal(historyCard({ ...base, type: 'expire', status: null, title: 'Créditos expirados', amount: -1 }).body, '−1 crédito')
})

test('credit error codes are read from the 402/409 detail', () => {
  assert.equal(creditErrorCode({ response: { data: { detail: { code: 'quote_required', cost: 3 } } } }), 'quote_required')
  assert.equal(creditErrorCode({ response: { data: { detail: 'Limite atingido' } } }), null)
  assert.equal(creditErrorCode(new Error('rede')), null)
})
