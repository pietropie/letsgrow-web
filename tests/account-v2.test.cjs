// Só da web (não vem do mobile): Minha conta v2, UX item 21 (A1–A4, W31).
const { test } = require('node:test')
const assert = require('node:assert/strict')
const a = require('../src/lib/account-v2.ts')
const h = require('../src/lib/home-v3.ts')

const period = { start: '2026-11-01T00:00:00Z', renews_at: '2026-12-01T00:00:00Z' }
const q = (used, total, extra = {}) => ({ mode: 'queries', period, queries: { used, total, remaining: total - used }, credits: null, near_limit: false, exhausted: false, ...extra })
const rec = (over = {}) => ({ current_plan: 'free', plan_key: 'jardineiro', reasons: [], covers: [], usage: { plants: { used: 1, total: 1 }, grows: { used: 1, total: 1 } },
  changes: [{ key: 'plants', from: 1, to: 2 }, { key: 'grows', from: 1, to: 1 }, { key: 'queries', from: 1, to: 4 }], ...over })
const view = (r, usage, over = {}) => {
  const band = h.planBandView(r, usage, r.plan_key ? 'Jardineiro' : null)
  return a.accountPlanView({ rec: r, usage, sub: null, meters: band.meters, offerText: band.offer && band.offer.text, recommendedLabel: r.plan_key ? 'Jardineiro' : null, exploring: false, canBuy: true, packs: false, ...over })
}
const card = { provider: 'mercadopago', kind: 'recurring', auto_renew: true, current_period_end: '2026-12-09T12:00:00Z', access_until: null }

test('A1 Free normal: "Grátis, sem prazo." and "Fazer upgrade", no offer without a reason', () => {
  const v = view(rec(), q(0, 1))
  assert.equal(v.situation, 'Grátis, sem prazo.')
  assert.deepEqual(v.meters.map(m => m.value), ['1 de 1', '1 de 1', '0 de 1'])
  assert.equal(v.offer, null)
  assert.deepEqual(v.primary, { label: 'Fazer upgrade', to: 'plans' })
  assert.equal(v.manage, null)
})

test('Free at the limit with a plan for sale: the reason block and "Fazer upgrade"', () => {
  const v = view(rec({ reasons: ['plants_limit', 'queries_limit'], covers: ['plants_limit', 'queries_limit'] }), q(1, 1, { exhausted: true }))
  assert.equal(v.offer, 'O Jardineiro cobre o que você atingiu: 2 plantas e 4 conversas com o Bobby por mês.')
  assert.deepEqual(v.primary, { label: 'Fazer upgrade', to: 'plans' })
  assert.equal(v.notice, 'As conversas com o Bobby deste mês acabaram. Voltam em 1 dez.')
})

test('A2 paid: renewal line and "Gerenciar assinatura", no offer and no primary', () => {
  const r = rec({ current_plan: 'jardineiro', plan_key: null, usage: { plants: { used: 1, total: 2 }, grows: { used: 1, total: 1 } }, changes: [] })
  const v = view(r, q(1, 4), { sub: card })
  assert.equal(v.situation, 'Renova em 9 dez no cartão.')
  assert.deepEqual([v.offer, v.primary, v.manage], [null, null, 'plans'])
  assert.equal(a.situationLine(false, { ...card, kind: 'prepaid', auto_renew: false, access_until: '2026-12-09T12:00:00Z' }), 'Vale até 9 dez · pago no Pix.')
  assert.equal(a.situationLine(false, { ...card, provider: 'google_play' }), 'Renova em 9 dez pelo Google Play.')
  assert.equal(view(r, q(1, 4), { sub: { ...card, provider: 'google_play' } }).manage, 'play')
})

test('A3 explore: the invitation and "Ver planos" as a link', () => {
  const v = view(rec({ usage: { plants: { used: 0, total: 1 }, grows: { used: 0, total: 1 } } }), q(0, 1), { exploring: true })
  assert.equal(v.situation, 'Você pode explorar sem cadastrar plantas.')
  assert.deepEqual([v.primary, v.link], [null, { label: 'Ver planos', to: 'plans' }])
})

test('A4 credits out: the yellow notice, "Comprar créditos" only with a pack for sale, and manage', () => {
  const r = rec({ current_plan: 'jardineiro', plan_key: null, changes: [] })
  const credits = { mode: 'credits', period, queries: null, credits: { remaining: 0 }, near_limit: true, exhausted: true }
  const v = view(r, credits, { sub: card, packs: true })
  assert.equal(v.notice, 'Seus créditos acabaram. Os do plano voltam em 1 dez.')
  assert.deepEqual([v.primary, v.manage], [{ label: 'Comprar créditos', to: 'packs' }, 'plans'])
  assert.equal(view(r, credits, { sub: card, packs: false }).primary, null)
})

test('purchase off: no upsell anywhere', () => {
  assert.equal(view(rec(), q(0, 1), { canBuy: false }).primary, null)
  assert.equal(view(rec(), q(0, 1), { exploring: true, canBuy: false }).link, null)
})
