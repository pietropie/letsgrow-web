// Só da web (não vem do mobile): preço e nomes de plano (UX itens 19 e 19b). O cartão da Minha conta: account-v2.test.cjs.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const p = require('../src/lib/plans.ts')

const CATALOG = { web_enabled: true, plans: [{ plan_key: 'jardineiro', label: 'Jardineiro', periods: [{ period: 'monthly', months: 1, price_brl: 24.9 }] }] }

test('price from the catalog only when web sales are on', () => {
  assert.equal(p.brl(24.9), 'R$ 24,90')
  assert.equal(p.priceOf(CATALOG, 'jardineiro'), 24.9)
  assert.equal(p.priceOf(CATALOG, 'jardineiro', 'yearly'), null)
  assert.equal(p.priceOf({ ...CATALOG, web_enabled: false }, 'jardineiro'), null)
})

test('old plan names map to the current ones', () => {
  assert.deepEqual(['grower', 'pro', 'free', 'jardineiro'].map(p.normalizePlan), ['cultivador', 'grower_pro', 'free', 'jardineiro'])
})

test('period price: per month in the spotlight, the real total kept, yearly saving computed', () => {
  const cat = { web_enabled: true, plans: [{ plan_key: 'jardineiro', label: 'Jardineiro', periods: [{ period: 'monthly', months: 1, price_brl: 24.9 }, { period: 'yearly', months: 12, price_brl: 238.8 }] }] }
  assert.deepEqual(p.periodPrice(cat, 'jardineiro', 'yearly'), { total: 238.8, months: 12, perMonth: 19.9 })
  assert.deepEqual(p.periodPrice(cat, 'jardineiro', 'monthly'), { total: 24.9, months: 1, perMonth: 24.9 })
  assert.equal(p.yearlySaving(cat, 'jardineiro'), 60)
  assert.equal(p.yearlySaving(CATALOG, 'jardineiro'), null)
  assert.equal(p.periodPrice({ ...cat, web_enabled: false }, 'jardineiro', 'yearly'), null)
})
