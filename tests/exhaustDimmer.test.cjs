// Copiado de letsgrow-mobile/tests/exhaustDimmer.test.cjs por scripts/sync-shared.mjs.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { snapPower, powerToAngle, touchAngle, dragPower, powerFeedback, hasExhaust, MIN_ANGLE, MAX_ANGLE } = require('../src/shared/lib/exhaustDimmer.ts')

test('power snaps to 5% steps inside 0–100', () => {
  assert.equal(snapPower(62), 60)
  assert.equal(snapPower(63), 65)
  assert.equal(snapPower(97.6), 100)
  assert.equal(snapPower(-8), 0)
  assert.equal(snapPower(140), 100)
})

test('each 5% step lands on one of the 21 marks, from −150° to +150°', () => {
  assert.equal(powerToAngle(0), MIN_ANGLE)
  assert.equal(powerToAngle(50), 0)
  assert.equal(powerToAngle(100), MAX_ANGLE)
  assert.equal(powerToAngle(65), 45) // Figma "dimmer em uso (65%)"
  for (let pct = 0; pct <= 100; pct += 5) assert.equal((powerToAngle(pct) - MIN_ANGLE) % 15, 0)
})

test('the touch angle comes from atan2 around the center, clockwise from the top', () => {
  assert.equal(touchAngle(50, 0, 50, 50), 0)
  assert.equal(touchAngle(100, 50, 50, 50), 90)
  assert.equal(touchAngle(0, 50, 50, 50), -90)
  assert.equal(Math.abs(touchAngle(50, 100, 50, 50)), 180)
  assert.ok(Math.abs(touchAngle(100, 0, 50, 50) - 45) < 1e-9)
})

test('dragging maps the angle to power with 5% snap', () => {
  assert.equal(dragPower(0, null), 50)
  assert.equal(dragPower(45, 50), 65)
  assert.equal(dragPower(-148, 5), 0)
  assert.equal(dragPower(149, 95), 100)
})

test('the dead zone at the bottom locks on the limit it came from', () => {
  assert.equal(dragPower(170, 100), 100)
  assert.equal(dragPower(-170, 100), 100)
  assert.equal(dragPower(-170, 0), 0)
  assert.equal(dragPower(175, 0), 0)
  // Landing in the dead zone with no value yet changes nothing.
  assert.equal(dragPower(180, null), null)
})

test('leaving the dead zone on the other side never jumps from 100 to 0 or back', () => {
  assert.equal(dragPower(-140, 100), 100)
  assert.equal(dragPower(140, 0), 0)
  // Coming back toward the scale releases the lock.
  assert.equal(dragPower(120, 100), 90)
})

test('haptics fire on each new step and more strongly at the limits', () => {
  assert.equal(powerFeedback(60, 65), 'step')
  assert.equal(powerFeedback(65, 65), 'none')
  assert.equal(powerFeedback(95, 100), 'limit')
  assert.equal(powerFeedback(5, 0), 'limit')
  assert.equal(powerFeedback(5, null), 'none')
})

test('only a registered exhaust can have its power recorded', () => {
  assert.equal(hasExhaust('inline_fan'), true)
  assert.equal(hasExhaust('none'), false)
  assert.equal(hasExhaust(null), false)
})
