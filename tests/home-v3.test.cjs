// Só da web (não vem do mobile): Início v3, UX item 20 (faixa F1–F6, Bobby N1–N4, W30).
const { test } = require('node:test')
const assert = require('node:assert/strict')
const h = require('../src/lib/home-v3.ts')

const period = { start: '2026-11-01T00:00:00Z', renews_at: '2026-12-01T00:00:00Z' }
const q = (used, total, extra = {}) => ({ mode: 'queries', period, queries: { used, total, remaining: total - used }, credits: null, near_limit: false, exhausted: false, ...extra })
const rec = (over = {}) => ({ current_plan: 'free', plan_key: 'jardineiro', reasons: [], covers: [], usage: { plants: { used: 1, total: 1 }, grows: { used: 1, total: 1 } },
  changes: [{ key: 'plants', from: 1, to: 2 }, { key: 'grows', from: 1, to: 1 }, { key: 'queries', from: 1, to: 4 }, { key: 'sensors', from: false, to: false }], ...over })

test('F1 normal: three meters and no offer without a reason', () => {
  const v = h.planBandView(rec(), q(0, 1), 'Jardineiro')
  assert.deepEqual(v.meters.map(m => [m.label, m.value, m.fill, m.mark]), [['PLANTAS', '1 de 1', 1, null], ['AMBIENTES', '1 de 1', 1, null], ['BOBBY NO MÊS', '0 de 1', 0, null]])
  assert.equal(v.offer, null)
  assert.equal(v.near, null)
})

test('F2 near the end: the yellow line with what is left', () => {
  const v = h.planBandView(rec({ current_plan: 'jardineiro', plan_key: null, usage: { plants: { used: 1, total: 2 }, grows: { used: 1, total: 1 } } }), q(3, 4, { near_limit: true }), null)
  assert.equal(v.meters[2].mark, 'near')
  assert.equal(v.near, 'Resta 1 conversa com o Bobby até 1 dez.')
  assert.equal(v.offer, null)
})

test('F3 limit with a plan for sale: the offer cites what the plan covers, no price', () => {
  const v = h.planBandView(rec({ reasons: ['plants_limit', 'queries_limit'], covers: ['plants_limit', 'queries_limit'] }), q(1, 1, { exhausted: true, near_limit: true }), 'Jardineiro')
  assert.deepEqual(v.meters.map(m => m.mark), ['limit', null, 'out'])
  assert.deepEqual(v.offer, { text: 'O Jardineiro cobre o que você atingiu: 2 plantas e 4 conversas com o Bobby por mês.', button: 'Ver o plano Jardineiro' })
  assert.equal(v.near, null)
})

test('F4 limit with no plan above: only the mark; F5 unlimited: counts without bars', () => {
  const f4 = h.planBandView(rec({ current_plan: 'jardineiro', plan_key: null, reasons: ['plants_limit'], usage: { plants: { used: 2, total: 2 }, grows: { used: 1, total: 1 } }, changes: [] }), q(1, 4), null)
  assert.equal(f4.offer, null)
  assert.equal(f4.meters[0].mark, 'limit')
  const f5 = h.planBandView(rec({ current_plan: 'grower_pro', plan_key: null, usage: { plants: { used: 6, total: 9999 }, grows: { used: 2, total: 9999 } }, changes: [] }), { mode: 'unlimited', period, queries: null, credits: null, near_limit: false, exhausted: false }, null)
  assert.deepEqual(f5.meters.map(m => [m.value, m.fill]), [['6', null], ['2', null], ['sem limite', null]])
})

test('F6 credits mode: the third meter becomes Créditos', () => {
  const v = h.planBandView(rec(), { mode: 'credits', period, queries: null, credits: { remaining: 120 }, near_limit: false, exhausted: false }, 'Jardineiro')
  assert.deepEqual([v.meters[2].label, v.meters[2].value], ['CRÉDITOS', '120 créditos'])
})

test('Bobby: conversations left and the exhausted notice (N2)', () => {
  assert.deepEqual(h.conversationsLine(q(1, 4)), { text: 'Restam 3 de 4 conversas neste mês · renova 1 dez', fill: 0.75 })
  assert.equal(h.conversationsLine(q(0, 1)).text, 'Resta 1 de 1 conversa neste mês · renova 1 dez')
  assert.equal(h.conversationsLine(q(1, 1)).text, '0 de 1 conversa restante · renova 1 dez')
  assert.equal(h.conversationsLine({ mode: 'unlimited', period, queries: null, credits: null, near_limit: false, exhausted: false }), null)
  assert.deepEqual(h.exhaustedNotice(q(1, 1, { exhausted: true })), {
    title: 'Você usou a conversa deste mês',
    body: 'Novas perguntas voltam em 1 dez. O diário, os registros e o resumo diário continuam funcionando.',
    wait: 'Esperar até 1 dez' })
  assert.equal(h.exhaustedNotice(q(4, 4, { exhausted: true })).title, 'Você usou as 4 conversas deste mês')
  assert.equal(h.exhaustedNotice(q(0, 1)), null)
})

test('suggestions from attention items, then phase and day; at most 3', () => {
  const now = new Date(2026, 9, 27, 12)
  const items = [
    { key: 'range-humidity', tag: 'AMBIENTE', title: 'Umidade da Sala acima da faixa', target: { kind: 'grow', id: 'g1' } },
    { key: 'a1', tag: 'REGA', title: 'Rega da Aurora', target: { kind: 'diary', id: 'p1' } },
  ]
  const plants = [
    { id: 'p1', name: 'Aurora', phaseLabel: 'Vegetativo', day: 22, lastWatering: new Date(2026, 9, 24, 9).toISOString() },
    { id: 'p2', name: 'Blueberry', phaseLabel: 'Floração', day: 31 },
  ]
  const s = h.homeSuggestions({ items, plants, growId: 'g1', growName: 'Sala', now })
  assert.deepEqual(s.map(x => x.label), ['Como baixar a umidade da Sala?', 'A Aurora está há 3 dias sem rega. Rego hoje?', 'O que observar na Aurora no dia 22 de vegetativo?'])
  assert.deepEqual([s[0].growId, s[1].plantId], ['g1', 'p1'])
  // N3, sem sensores nem itens: só fase e dia.
  assert.deepEqual(h.homeSuggestions({ items: [], plants: [plants[1]], growId: 'g1', growName: 'Sala', now }).map(x => x.label), ['O que observar na Blueberry no dia 31 de floração?'])
})

test('next action of a plant: its first watering or Bobby item', () => {
  const now = new Date(2026, 9, 27, 12)
  const items = [{ key: 'a1', tag: 'REGA', title: 'Rega da Aurora', target: { kind: 'diary', id: 'p1' } }, { key: 'a2', tag: 'BOBBY', title: 'pH alto nas últimas regas', target: { kind: 'observation', id: 'p2' } }]
  assert.equal(h.nextAction('p1', items, new Date(2026, 9, 24).toISOString(), now).text, 'Regar: a última rega foi há 3 dias')
  assert.equal(h.nextAction('p2', items, null, now).text, 'pH alto nas últimas regas')
  assert.equal(h.nextAction('p3', items, null, now), null)
})

test('backend contract (optional until deploy): next_action filtered by tier, idle line from last_event', () => {
  assert.equal(h.backendNextAction({}), undefined)
  assert.equal(h.backendNextAction({ next_action: null }), null)
  // Lembrete de rega de baixa prioridade: não aparece em "Precisa de atenção", então não marca o cartão.
  assert.equal(h.backendNextAction({ next_action: { action: 'watering', tier: 'attention', message: '3+ dias sem rega registrada.' } }), null)
  assert.deepEqual(h.backendNextAction({ next_action: { action: 'watering', tier: 'anomaly', message: 'A última rega foi há 6 dias.' } }), { text: 'A última rega foi há 6 dias.', watering: true })
  assert.equal(h.backendNextAction({ next_action: { action: 'harvest', tier: 'attention', message: 'x' } }), null)
  assert.equal(h.backendNextAction({ next_action: { action: 'temperature', tier: 'critical', message: 'Temperatura em 32 °C.' } }).text, 'Temperatura em 32 °C.')
  const now = new Date(2026, 10, 9, 15)
  assert.equal(h.idleLine({ id: 'e', event_type: 'watering', label: 'Rega', event_date: new Date(2026, 10, 9, 8).toISOString() }, now), 'Nada pendente. Último registro: rega, hoje.')
  assert.equal(h.idleLine({ id: 'e', event_type: 'note', label: 'Anotação', event_date: new Date(2026, 9, 30).toISOString() }, now), 'Nada pendente. Último registro: anotação, em 30 out.')
  assert.equal(h.idleLine(null, now), 'Nada pendente agora.')
})
