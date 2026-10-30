// Copiado de letsgrow-mobile/tests/numericInput.test.cjs por scripts/sync-shared.mjs.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { sanitizeNumericText, parseNumericText, toApiNumber, numericKeyboard } = require('../src/shared/lib/numericInput.ts')

test('letters and symbols never reach a numeric field', () => {
  assert.equal(sanitizeNumericText('553TESTE QA registro manual', 'decimal'), '553')
  assert.equal(sanitizeNumericText('55abc', 'integer'), '55')
  assert.equal(sanitizeNumericText('abc', 'decimal'), '')
  assert.equal(sanitizeNumericText(' 6 , 2 ', 'decimal'), '6,2')
})

test('decimals keep a single separator as typed, integers keep none', () => {
  assert.equal(sanitizeNumericText('28,5', 'decimal'), '28,5')
  assert.equal(sanitizeNumericText('6.2', 'decimal'), '6.2')
  assert.equal(sanitizeNumericText('1,2,3', 'decimal'), '1,23')
  assert.equal(sanitizeNumericText('1.2,3', 'decimal'), '1.23')
  assert.equal(sanitizeNumericText('7,5', 'integer'), '75')
  assert.equal(sanitizeNumericText('', 'integer'), '')
})

test('minus only for signed decimals and only in front', () => {
  assert.equal(sanitizeNumericText('-5', 'decimal'), '5')
  assert.equal(sanitizeNumericText('-5', 'integer'), '5')
  assert.equal(sanitizeNumericText('-2,5', 'signed-decimal'), '-2,5')
  assert.equal(sanitizeNumericText('-', 'signed-decimal'), '-')
  assert.equal(sanitizeNumericText('5-3', 'signed-decimal'), '53')
  assert.equal(sanitizeNumericText('--5', 'signed-decimal'), '-5')
})

test('parsing normalizes the comma to a point for the API', () => {
  assert.equal(parseNumericText('28,5'), 28.5)
  assert.equal(parseNumericText('6.2'), 6.2)
  assert.equal(parseNumericText('-2,5'), -2.5)
  assert.equal(parseNumericText('5,'), 5)
  assert.equal(parseNumericText(',5'), 0.5)
  assert.equal(parseNumericText('  '), null)
  for (const text of ['-', ',', '.', '1a']) assert.ok(Number.isNaN(parseNumericText(text)), text)
})

test('payload numbers are finite or null', () => {
  assert.equal(toApiNumber('6,2'), 6.2)
  assert.equal(toApiNumber(''), null)
  assert.equal(toApiNumber('-'), null)
})

test('each kind opens the matching keyboard', () => {
  assert.deepEqual(numericKeyboard('integer'), { keyboardType: 'number-pad', inputMode: 'numeric' })
  assert.deepEqual(numericKeyboard('decimal'), { keyboardType: 'decimal-pad', inputMode: 'decimal' })
  assert.equal(numericKeyboard('signed-decimal').keyboardType, 'numeric')
  assert.equal(numericKeyboard('signed-decimal').inputMode, undefined)
})
