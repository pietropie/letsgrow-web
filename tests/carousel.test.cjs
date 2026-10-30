// Copiado de letsgrow-mobile/tests/carousel.test.cjs por scripts/sync-shared.mjs.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { carouselCardWidth, carouselIndex, clampCarouselIndex, carouselOffset } = require('../src/shared/lib/carousel.ts')

test('a single card fills the available width', () => {
  assert.equal(carouselCardWidth(1, 370, 330, 40), 370)
  assert.equal(carouselCardWidth(0, 370, 330, 40), 370)
})

test('several cards keep the design width and leave a peek on narrow screens', () => {
  assert.equal(carouselCardWidth(2, 370, 330, 40), 330)
  assert.equal(carouselCardWidth(3, 340, 330, 40), 300)
  assert.equal(carouselCardWidth(2, 370, 204, 40), 204)
})

test('the active dot follows the swipe and the end marks the last card', () => {
  assert.equal(carouselIndex(0, 3, 340, 680), 0)
  assert.equal(carouselIndex(160, 3, 340, 680), 0)
  assert.equal(carouselIndex(180, 3, 340, 680), 1)
  assert.equal(carouselIndex(679.5, 3, 340, 680), 2)
  // Short cards: the last one never reaches the start, so the end still selects it.
  assert.equal(carouselIndex(48, 2, 214, 48), 1)
  assert.equal(carouselIndex(-20, 2, 340, 340), 0)
  assert.equal(carouselIndex(100, 1, 340, 0), 0)
})

test('after archiving or adding, the active card stays inside the list', () => {
  assert.equal(clampCarouselIndex(1, 1), 0)
  assert.equal(clampCarouselIndex(1, 3), 1)
  assert.equal(clampCarouselIndex(4, 2), 1)
  assert.equal(clampCarouselIndex(0, 0), 0)
  assert.equal(clampCarouselIndex(-1, 2), 0)
})

test('repositioning never scrolls past the last card', () => {
  // Plantas: 2 cards of 330 + gap 10 in 370 → the end is at 300, not at the 2nd card start (340).
  assert.equal(carouselOffset(1, 2, 340, 10, 370), 300)
  assert.equal(carouselOffset(1, 3, 340, 10, 370), 340)
  assert.equal(carouselOffset(2, 3, 340, 10, 370), 640)
  // One card fills the width: nothing to scroll.
  assert.equal(carouselOffset(1, 1, 380, 10, 370), 0)
  assert.equal(carouselOffset(0, 2, 340, 10, 370), 0)
})
