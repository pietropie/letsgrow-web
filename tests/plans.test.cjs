// Só da web (não vem do mobile): card "Seu plano" e tela de Planos, UX item 19 (P1–P7, W25–W27).
const { test } = require('node:test')
const assert = require('node:assert/strict')
const p = require('../src/lib/plans.ts')

// /plans/config e /billing/catalog como estão em produção (9 nov): só o Jardineiro à venda, mensal.
const PLANS = [
  { plan_key: 'free', label: 'Free', price_brl: 0, max_plants: 1, max_grows: 1, max_pots_per_grow: 3, ai_queries_per_month: 1, sensors_allowed: false },
  { plan_key: 'jardineiro', label: 'Jardineiro', price_brl: 24.9, max_plants: 2, max_grows: 1, max_pots_per_grow: 3, ai_queries_per_month: 4, sensors_allowed: false },
  { plan_key: 'cultivador', label: 'Cultivador', price_brl: 44.9, max_plants: 8, max_grows: 2, max_pots_per_grow: 10, ai_queries_per_month: null, sensors_allowed: true },
  { plan_key: 'grower_pro', label: 'Grower Pro', price_brl: 89.9, max_plants: 9999, max_grows: 9999, max_pots_per_grow: 9999, ai_queries_per_month: null, sensors_allowed: true },
]
const CATALOG = { web_enabled: true, plans: [{ plan_key: 'jardineiro', label: 'Jardineiro', periods: [{ period: 'monthly', months: 1, price_brl: 24.9 }] }] }
const period = { start: '2026-11-01T00:00:00Z', renews_at: '2026-12-01T00:00:00Z' }
const queries = (used, total, extra = {}) => ({ mode: 'queries', period, queries: { used, total, remaining: total - used }, credits: null, near_limit: false, exhausted: false, ...extra })
const base = { current: 'free', plans: PLANS, catalog: CATALOG, usage: queries(0, 1), subscription: null, exploring: false, canBuy: true, packs: false }
const view = (over = {}) => p.planCardView({ ...base, ...over })

test('only plans with a sellable price are for sale; the recommended is the next one that raises the limit', () => {
  assert.deepEqual(p.plansForSale(PLANS, CATALOG).map(x => x.plan_key), ['jardineiro'])
  assert.equal(p.recommendedPlan('free', PLANS, CATALOG).plan_key, 'jardineiro')
  assert.equal(p.recommendedPlan('jardineiro', PLANS, CATALOG), null)
  assert.equal(p.recommendedPlan('free', PLANS, { ...CATALOG, web_enabled: false }), null)
})

test('P1 Free normal: limits, usage, Jardineiro outcomes, price card or Pix, "Fazer upgrade" primary', () => {
  const v = view()
  assert.equal(v.state, 'normal')
  assert.equal(v.tag, null)
  assert.equal(v.lead, '1 planta · 1 ambiente · 1 consulta do Bobby por mês')
  assert.deepEqual(v.usage, { bar: 0, tone: 'normal', text: 'Bobby · 0 de 1 consulta · renova 1 dez' })
  assert.deepEqual(v.upsell.benefits, ['Acompanhe 2 plantas ao mesmo tempo', '4 conversas com o Bobby por mês, cerca de uma por semana'])
  assert.equal(v.upsell.price, 'R$ 24,90 por mês · cartão ou Pix')
  assert.deepEqual(v.primary, { label: 'Fazer upgrade', to: 'plans' })
  assert.deepEqual(v.link, { label: 'Ver uso e histórico', to: 'credits' })
})

test('P2 near the end and P3 exhausted follow near_limit and exhausted from /usage', () => {
  const near = view({ usage: queries(4, 5, { near_limit: true }) })
  assert.deepEqual([near.tag.label, near.usage.tone, near.usage.text], ['PERTO DO FIM', 'alert', 'Bobby · 4 de 5 consultas · restam 1'])
  const out = view({ usage: queries(1, 1, { exhausted: true, near_limit: true }) })
  assert.deepEqual([out.tag.label, out.usage.tone, out.usage.text], ['ESGOTADO', 'error', 'Bobby · 1 de 1 consulta · volta em 1 dez'])
  assert.equal(out.note, 'O Bobby volta em 1 dez. Com o upgrade, você continua agora.')
  assert.equal(out.primary.label, 'Fazer upgrade')
})

test('P4 credits mode: balance, "Comprar créditos" primary and "Ver planos" as the link', () => {
  const v = view({ usage: { mode: 'credits', period, queries: null, credits: { remaining: 120 }, near_limit: false, exhausted: false }, packs: true })
  assert.equal(v.state, 'credits')
  assert.equal(v.lead, '1 planta · 1 ambiente')
  assert.equal(v.usage.text, '120 créditos · plano renova 1 dez')
  assert.deepEqual(v.primary, { label: 'Comprar créditos', to: 'packs' })
  assert.deepEqual(v.link, { label: 'Ver planos', to: 'plans' })
})

test('P5 paid with no higher plan for sale: no upsell, price and renewal, manage', () => {
  const sub = { plan_key: 'jardineiro', period: 'monthly', provider: 'mercadopago', kind: 'recurring', auto_renew: true, current_period_end: '2026-12-09T12:00:00Z', access_until: null }
  const v = view({ current: 'jardineiro', usage: queries(1, 4), subscription: sub })
  assert.equal(v.state, 'paid')
  assert.equal(v.tag.label, 'ATIVO')
  assert.equal(v.upsell, null)
  assert.equal(v.primary, null)
  assert.equal(v.usage.text, 'Bobby · 1 de 4 consultas · renova 1 dez')
  assert.equal(v.note, 'R$ 24,90 por mês · renova em 9 dez.')
  assert.deepEqual(v.manage, { to: 'plans' })
  const pix = view({ current: 'jardineiro', usage: queries(1, 4), subscription: { ...sub, kind: 'prepaid', auto_renew: false, access_until: '2026-12-09T12:00:00Z' } })
  assert.equal(pix.note, 'R$ 24,90 por mês · acesso até 9 dez, sem renovação.')
  const play = view({ current: 'jardineiro', usage: queries(1, 4), subscription: { ...sub, provider: 'google_play' } })
  assert.deepEqual(play.manage, { to: 'play' })
})

test('P6 highest plan: "SEM LIMITES", the month count only when the API sends it', () => {
  const live = { mode: 'unlimited', period, queries: null, credits: null, near_limit: false, exhausted: false }
  const v = view({ current: 'grower_pro', usage: live })
  assert.deepEqual([v.state, v.tag.label, v.lead, v.usage, v.note, v.manage], ['unlimited', 'SEM LIMITES', 'Plantas, ambientes e Bobby sem limite', null, null, null])
  assert.equal(view({ current: 'pro', usage: { ...live, queries: { used: 12, total: null, remaining: null } } }).usage.text, 'Bobby · 12 consultas em novembro')
})

test('P7 explore: invitation, "Ver planos" secondary and the "Créditos e plano" link', () => {
  const v = view({ exploring: true })
  assert.equal(v.state, 'explore')
  assert.equal(v.lead, 'Comece cadastrando sua primeira planta. O Free acompanha 1 planta e 1 consulta do Bobby por mês.')
  assert.equal(v.primary, null)
  assert.deepEqual(v.secondary, { label: 'Ver planos', to: 'plans' })
  assert.deepEqual(v.link, { label: 'Créditos e plano', to: 'credits' })
})

test('nothing for sale or purchase off: no upsell and no price', () => {
  assert.equal(view({ catalog: { ...CATALOG, web_enabled: false } }).upsell, null)
  assert.equal(view({ canBuy: false }).primary, null)
  assert.equal(view({ exploring: true, canBuy: false }).secondary, null)
})

test('Planos: features of the current plan, comparison and yearly only with a real discount', () => {
  assert.deepEqual(p.planFeatures(PLANS[0]), ['1 planta e 1 ambiente', '1 consulta do Bobby por mês'])
  assert.deepEqual(p.comparisonRows([PLANS[0], PLANS[1]]).map(r => r.values), [['1', '2'], ['1', '1'], ['3', '3'], ['1', '4'], ['—', '—']])
  assert.equal(p.yearlySaving(CATALOG, 'jardineiro'), null)
  const yearly = { web_enabled: true, plans: [{ plan_key: 'jardineiro', label: 'Jardineiro', periods: [{ period: 'monthly', months: 1, price_brl: 24.9 }, { period: 'yearly', months: 12, price_brl: 239 }] }] }
  assert.equal(p.yearlySaving(yearly, 'jardineiro'), 20)
  assert.equal(p.yearlySaving({ ...yearly, plans: [{ ...yearly.plans[0], periods: [yearly.plans[0].periods[0], { period: 'yearly', months: 12, price_brl: 298.8 }] }] }, 'jardineiro'), null)
  assert.equal(p.brl(24.9), 'R$ 24,90')
})
