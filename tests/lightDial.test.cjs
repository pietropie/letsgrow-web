// Copiado de letsgrow-mobile/tests/lightDial.test.cjs por scripts/sync-shared.mjs.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { dialHour, dialAngle, lightReadingPointer, LIGHT_READING_STALE_HOURS } = require('../src/shared/lib/lightDial.ts')

test('the pointer angle turns once per 24 h, clockwise from 0 h at the top', () => {
  assert.equal(dialAngle(0), 0)
  assert.equal(dialAngle(6), 90)
  assert.equal(dialAngle(12), 180)
  assert.equal(dialAngle(18), 270)
  assert.equal(dialAngle(24), 0)
  assert.equal(dialAngle(-6), 270)
  assert.ok(Math.abs(dialAngle(9 + 40 / 60) - 145) < 1e-9)
})

test('the pointer sits on the local time of the reading', () => {
  assert.ok(Math.abs(dialHour(new Date(2026, 9, 19, 9, 40)) - (9 + 40 / 60)) < 1e-9)
  assert.equal(dialHour(new Date(2026, 9, 19, 0, 0)), 0)
  const at = new Date(2026, 9, 19, 21, 15)
  assert.equal(lightReadingPointer(at.toISOString(), at).hour, 21.25)
})

test('a reading older than 24 h is marked stale, a recent one is not', () => {
  assert.equal(LIGHT_READING_STALE_HOURS, 24)
  const now = new Date('2026-10-19T12:00:00Z')
  assert.equal(lightReadingPointer('2026-10-19T09:40:00Z', now).stale, false)
  assert.equal(lightReadingPointer('2026-10-18T12:00:00Z', now).stale, false)
  assert.equal(lightReadingPointer('2026-10-18T11:59:00Z', now).stale, true)
  assert.equal(lightReadingPointer('2026-10-16T09:40:00Z', now).stale, true)
})

test('no reading or an invalid date draws no pointer', () => {
  for (const value of [null, undefined, '', 'not a date']) assert.equal(lightReadingPointer(value), null)
})
