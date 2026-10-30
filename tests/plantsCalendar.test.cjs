// Copiado de letsgrow-mobile/tests/plantsCalendar.test.cjs por scripts/sync-shared.mjs.
// Calendar of all plants (UX-CORRECOES.md item 6, Figma 03C). Days are the viewer's local days: fixed zone.
process.env.TZ = 'America/Sao_Paulo'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { calendarPlants, dayKey, diaryPeriod, groupByPlant, loadDiaryPeriod, monthDays, plantsByDay, weekDays } = require('../src/shared/lib/diaryCalendar.ts')

const entry = (id, plant_id, event_date) => ({ id, plant_id, event_date })
const names = { a: 'Aurora', s: 'Sol', b: 'Blueberry' }

test('records fall on the local day, not the UTC day', () => {
  // 23:30 in São Paulo on the 14th is already the 15th in UTC.
  assert.equal(dayKey('2026-09-15T02:30:00Z'), '2026-09-14')
  assert.equal(dayKey('2026-09-15T03:00:00Z'), '2026-09-15')
  const byDay = plantsByDay([entry('1', 'a', '2026-09-15T02:30:00Z'), entry('2', 's', '2026-09-14T12:00:00Z')])
  assert.equal(byDay.get('2026-09-14'), 2)
  assert.equal(byDay.has('2026-09-15'), false)
})

test('the badge counts different plants per day, not records', () => {
  const byDay = plantsByDay([
    entry('1', 'a', '2026-09-14T12:40:00Z'), entry('2', 'a', '2026-09-14T12:42:00Z'),
    entry('3', 's', '2026-09-14T13:00:00Z'), entry('4', 'b', '2026-09-14T14:00:00Z'), entry('5', 'a', '2026-09-12T12:00:00Z'),
  ])
  assert.equal(byDay.get('2026-09-14'), 3)
  assert.equal(byDay.get('2026-09-12'), 1)
})

test('groups: plant with the latest record first, ties by name, records in time order', () => {
  const groups = groupByPlant([
    entry('1', 'a', '2026-09-14T12:42:00Z'), entry('2', 'a', '2026-09-14T12:40:00Z'),
    entry('3', 'b', '2026-09-14T15:00:00Z'), entry('4', 's', '2026-09-14T12:42:00Z'),
  ], e => names[e.plant_id])
  assert.deepEqual(groups.map(g => g.name), ['Blueberry', 'Aurora', 'Sol'])
  assert.deepEqual(groups[1].entries.map(e => e.id), ['2', '1'])
  assert.equal(groups[1].latest, '2026-09-14T12:42:00Z')
})

test('environment chip and archived toggle pick the plants in scope', () => {
  const plants = [
    { id: 'a', grow_id: 'sala', is_active: true }, { id: 's', grow_id: 'sala', is_active: true },
    { id: 'b', grow_id: 'fundo', is_active: true }, { id: 'x', grow_id: 'sala', is_active: false },
  ]
  assert.deepEqual(calendarPlants(plants, null, false).map(p => p.id), ['a', 's', 'b'])
  assert.deepEqual(calendarPlants(plants, null, true).map(p => p.id), ['a', 's', 'b', 'x'])
  assert.deepEqual(calendarPlants(plants, 'sala', false).map(p => p.id), ['a', 's'])
  assert.deepEqual(calendarPlants(plants, 'fundo', true).map(p => p.id), ['b'])
  assert.deepEqual(calendarPlants(plants, 'outro', true), [])
})

test('month grid has whole weeks with the adjacent days, all inside the loaded period', () => {
  const selected = new Date(2026, 8, 14)
  const days = monthDays(selected)
  assert.equal(days.length, 35)
  assert.equal(dayKey(days[0]), '2026-08-30')
  assert.equal(dayKey(days[34]), '2026-10-03')
  const period = diaryPeriod(selected, 'month')
  const start = new Date(period.start_at).getTime(), end = new Date(period.end_at).getTime()
  for (const d of days) {
    assert.ok(d.getTime() >= start && d.getTime() < end, dayKey(d))
    const lastMoment = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59).getTime()
    assert.ok(lastMoment < end)
  }
  // A month starting on Saturday needs 6 rows: still within the 42 loaded days.
  assert.equal(monthDays(new Date(2026, 7, 1)).length, 42)
})

test('week grid is Sunday to Saturday and matches the week period', () => {
  const days = weekDays(new Date(2026, 8, 14))
  assert.deepEqual([dayKey(days[0]), dayKey(days[6])], ['2026-09-13', '2026-09-19'])
  assert.equal(new Date(diaryPeriod(new Date(2026, 8, 14), 'week').start_at).getTime(), days[0].getTime())
})

test('the visible period is loaded across pages before grouping', async () => {
  const all = Array.from({ length: 150 }, (_, i) => entry(String(i), i % 2 ? 'a' : 's', '2026-09-14T12:00:00Z'))
  const result = await loadDiaryPeriod(async (offset, limit) => all.slice(offset, offset + limit))
  assert.equal(plantsByDay(result).get('2026-09-14'), 2)
  assert.equal(groupByPlant(result, e => names[e.plant_id]).reduce((n, g) => n + g.entries.length, 0), 150)
})
