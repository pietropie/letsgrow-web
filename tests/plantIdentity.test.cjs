// Copiado de letsgrow-mobile/tests/plantIdentity.test.cjs por scripts/sync-shared.mjs.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { plantDisplayName, plantIllustration } = require('../src/shared/lib/plantIdentity.ts')

test('prefers the individual name without confusing it with variety', () => {
  assert.equal(plantDisplayName({ display_name: '  Janela ', strain_name: 'Variedade' }), 'Janela')
  assert.equal(plantDisplayName({ display_name: 'Janela', strain_name: '' }), 'Janela')
})

test('supports legacy responses and missing identity', () => {
  assert.equal(plantDisplayName({ strain_name: 'Variedade' }), 'Variedade')
  assert.equal(plantDisplayName({ display_name: ' ', strain_name: '' }), 'Planta')
  assert.equal(plantDisplayName(null), 'Planta')
})

test('the illustration depends only on the plant id, not on its position in a list', () => {
  const ids = ['7b0c6f3e-1d2a-4c1e-9f0a-2b3c4d5e6f70', '0f1e2d3c-4b5a-4968-8776-655443322110', 'a', 'b', 'c', 'd']
  const before = ids.map(plantIllustration)
  // Same answer however many times and in whatever order it is asked.
  assert.deepEqual([...ids].reverse().map(plantIllustration).reverse(), before)
  assert.deepEqual(ids.slice(1).map(plantIllustration), before.slice(1))
  for (const value of before) assert.ok(value === 'aurora' || value === 'sol')
  // Both illustrations are in use.
  assert.ok(before.includes('aurora') && before.includes('sol'))
})
