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
