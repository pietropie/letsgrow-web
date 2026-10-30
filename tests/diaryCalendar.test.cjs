// Copiado de letsgrow-mobile/tests/diaryCalendar.test.cjs por scripts/sync-shared.mjs.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { addCalendarMonths, diaryPeriod, filterDiaryPlants, loadDiaryPeriod } = require('../src/shared/lib/diaryCalendar.ts')

test('month navigation clamps days instead of skipping February', () => {
  for (const [year, lastDay] of [[2026, 28], [2024, 29]]) {
    const next = addCalendarMonths(new Date(year, 0, 31), 1)
    assert.equal(next.getMonth(), 1)
    assert.equal(next.getDate(), lastDay)
    assert.equal(addCalendarMonths(new Date(year, 2, 31), -1).getDate(), lastDay)
  }
})

test('month navigation handles year boundaries', () => {
  const next = addCalendarMonths(new Date(2026, 11, 31), 1)
  assert.equal(next.getFullYear(), 2027)
  assert.equal(next.getMonth(), 0)
  assert.equal(next.getDate(), 31)
})

test('period bounds match the visible calendar with local midnight boundaries', () => {
  for (const [mode, days] of [['week', 7], ['month', 42]]) {
    const period = diaryPeriod(new Date(2026, 9, 16, 19), mode)
    const start = new Date(period.start_at)
    const end = new Date(period.end_at)
    assert.equal(start.getDay(), 0)
    assert.equal(start.getHours(), 0)
    const expected = new Date(start)
    expected.setDate(expected.getDate() + days)
    assert.equal(end.getTime(), expected.getTime())
  }
})

test('empty grows stay empty; filters use identity rather than labels', () => {
  const plants = [{ id: 'a', grow_id: 'g1', grow_label: 'Meu grow' }, { id: 'b', grow_id: 'g2', grow_label: 'Meu grow' }]
  assert.deepEqual(filterDiaryPlants(plants, 'empty'), [])
  assert.deepEqual(filterDiaryPlants(plants, 'g1', 'b'), [])
  assert.deepEqual(filterDiaryPlants(plants, 'g1').map(p => p.id), ['a'])
  assert.deepEqual(filterDiaryPlants(plants, '__all__', 'b').map(p => p.id), ['b'])
})

test('all pages in the visible period are loaded, including after 100 entries', async () => {
  const items = Array.from({ length: 205 }, (_, id) => ({ id: String(id) }))
  const offsets = []
  const result = await loadDiaryPeriod(async (offset, limit) => {
    offsets.push(offset)
    return items.slice(offset, offset + limit)
  })
  assert.equal(result.length, 205)
  assert.deepEqual(offsets, [0, 100, 200])
})

test('a failed later page is an error, not a falsely complete calendar', async () => {
  await assert.rejects(loadDiaryPeriod(async (offset) => {
    if (offset) throw new Error('network')
    return Array.from({ length: 100 }, (_, id) => ({ id: String(id) }))
  }), /network/)
})
