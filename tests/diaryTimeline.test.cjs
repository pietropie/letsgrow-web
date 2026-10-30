// Copiado de letsgrow-mobile/tests/diaryTimeline.test.cjs por scripts/sync-shared.mjs.
// Continuous diary timeline (UX item 8, Figma 03C L–L5). Days are the viewer's local days: fixed zone.
process.env.TZ = 'America/Sao_Paulo'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { buildTimeline, blocksUntil, timelineBlock, daysBetween, gapLabel, dayHeading, stripSync, historyStartOf, dayKey, groupByPlant, dayRows } = require('../src/shared/lib/diaryCalendar.ts')

const today = new Date(2026, 9, 20, 15, 0) // Tue 20 Oct 2026, 15:00 local
const e = (id, iso, plant_id = 'a') => ({ id, event_date: iso, plant_id })
const shape = sections => sections.map(s => s.kind === 'day' ? `${s.key}:${s.entries.length}${s.today ? '*' : ''}` : s.kind === 'gap' ? `gap ${s.count}${s.ahead ? ' ahead' : ''} ${dayKey(s.oldest)}..${dayKey(s.newest)}` : `future ${s.key} +${s.ahead}`)

test('newest first, today always on top, empty days folded into one line', () => {
  const entries = [e('1', '2026-10-19T12:40:00Z'), e('2', '2026-10-19T12:42:00Z'), e('3', '2026-10-16T21:05:00Z')]
  const sections = buildTimeline(entries, { today, from: new Date(2026, 9, 14) })
  assert.deepEqual(shape(sections), ['2026-10-20:0*', '2026-10-19:2', 'gap 2 2026-10-17..2026-10-18', '2026-10-16:1', 'gap 2 2026-10-14..2026-10-15'])
  // Records of a day in time order.
  assert.deepEqual(sections[1].entries.map(x => x.id), ['1', '2'])
})

test('the history start stops the list; a single empty day is "1 dia"', () => {
  const entries = [e('1', '2026-10-19T12:00:00Z'), e('2', '2026-10-17T12:00:00Z')]
  const sections = buildTimeline(entries, { today, from: new Date(2026, 8, 20), historyStart: new Date(2026, 9, 16) })
  assert.deepEqual(shape(sections), ['2026-10-20:0*', '2026-10-19:1', 'gap 1 2026-10-18..2026-10-18', '2026-10-17:1', 'gap 1 2026-10-16..2026-10-16'])
  assert.equal(gapLabel(sections[2]).text, '1 dia sem registros · 18 out')
  assert.equal(gapLabel(sections[2]).a11y, '1 dia sem registros, 18 de outubro')
})

test('a tapped empty past day keeps its own section', () => {
  const sections = buildTimeline([], { today, from: new Date(2026, 9, 10), focus: new Date(2026, 9, 14) })
  assert.deepEqual(shape(sections), ['2026-10-20:0*', 'gap 5 2026-10-15..2026-10-19', '2026-10-14:0', 'gap 4 2026-10-10..2026-10-13'])
  assert.equal(gapLabel(sections[1]).text, '5 dias sem registros · 15–19 out')
  assert.equal(gapLabel(sections[1]).a11y, '5 dias sem registros, de 15 a 19 de outubro')
})

test('a tapped future day goes above today, with the days ahead folded', () => {
  const sections = buildTimeline([], { today, from: new Date(2026, 9, 20), focus: new Date(2026, 9, 23) })
  assert.deepEqual(shape(sections), ['future future-2026-10-23 +3', 'gap 2 ahead 2026-10-21..2026-10-22', '2026-10-20:0*'])
  assert.equal(gapLabel(sections[1]).text, '2 dias à frente · 21–22 out')
  // Tomorrow: no "ahead" line.
  assert.deepEqual(shape(buildTimeline([], { today, from: new Date(2026, 9, 20), focus: new Date(2026, 9, 21) })), ['future future-2026-10-21 +1', '2026-10-20:0*'])
  assert.equal(dayHeading(new Date(2026, 9, 23), 0, { ahead: 3 }).a11y, 'Sexta, 23 de outubro, daqui a 3 dias')
})

test('blocks of 30 days back from tomorrow, and how many reach a tapped day', () => {
  const b0 = timelineBlock(today, 0), b1 = timelineBlock(today, 1)
  assert.equal(dayKey(b0.start), '2026-09-21')
  assert.equal(new Date(b0.end_at).getTime(), new Date(2026, 9, 21).getTime())
  assert.equal(b1.end_at, b0.start_at)
  assert.equal(blocksUntil(today, new Date(2026, 9, 25)), 1) // future
  assert.equal(blocksUntil(today, today), 1)
  assert.equal(blocksUntil(today, new Date(2026, 8, 21)), 1) // 29 days back: still block 0
  assert.equal(blocksUntil(today, new Date(2026, 8, 20)), 2) // 30 days back
  assert.equal(blocksUntil(today, new Date(2026, 6, 1)), 4)
  // The block that reaches a day really contains it.
  const day = new Date(2026, 6, 1), n = blocksUntil(today, day)
  assert.ok(timelineBlock(today, n - 1).start <= day && day < timelineBlock(today, n - 2).start)
})

test('local days and day differences ignore the time and the UTC date', () => {
  // 23:30 in São Paulo on the 19th is the 20th in UTC: it belongs to the 19th.
  const sections = buildTimeline([e('1', '2026-10-20T02:30:00Z')], { today, from: new Date(2026, 9, 19) })
  assert.deepEqual(shape(sections), ['2026-10-20:0*', '2026-10-19:1'])
  assert.equal(daysBetween(new Date(2026, 9, 19, 23, 59), new Date(2026, 9, 20, 0, 1)), 1)
  assert.equal(daysBetween(new Date(2026, 10, 1), new Date(2026, 9, 30)), -2)
})

test('records of a day grouped by plant, newest plant first', () => {
  const day = [e('1', '2026-10-19T12:40:00Z', 'aurora'), e('2', '2026-10-19T12:42:00Z', 'sol'), e('3', '2026-10-19T12:41:00Z', 'aurora')]
  const groups = groupByPlant(day, x => ({ aurora: 'Aurora', sol: 'Sol' })[x.plant_id])
  assert.deepEqual(groups.map(g => [g.name, g.entries.map(x => x.id)]), [['Sol', ['2']], ['Aurora', ['1', '3']]])
})

test('strip and list stay in sync without a loop', () => {
  // The person scrolls: the strip follows the sticky day.
  assert.deepEqual(stripSync('2026-10-16', { target: null, selected: '2026-10-20' }), { select: '2026-10-16', clearTarget: false })
  assert.deepEqual(stripSync('2026-10-20', { target: null, selected: '2026-10-20' }), { select: null, clearTarget: false })
  // The app scrolls after a tap: days passed on the way are not sent back; reaching the target ends it.
  assert.deepEqual(stripSync('2026-10-18', { target: '2026-10-14', selected: '2026-10-14' }), { select: null, clearTarget: false })
  assert.deepEqual(stripSync('2026-10-14', { target: '2026-10-14', selected: '2026-10-14' }), { select: null, clearTarget: true })
  assert.deepEqual(stripSync(null, { target: null, selected: '2026-10-20' }), { select: null, clearTarget: false })
})

test('headings and the history start', () => {
  assert.deepEqual(dayHeading(new Date(2026, 9, 19), 2), { title: 'SEG, 19 DE OUTUBRO', a11y: 'Segunda, 19 de outubro, 2 registros' })
  assert.equal(dayHeading(today, 1, { today: true }).a11y, 'Terça, 20 de outubro, 1 registro, hoje')
  assert.equal(dayKey(historyStartOf(['2026-10-17T03:10:00Z', '2026-10-19', null])), '2026-10-17')
  assert.equal(dayKey(historyStartOf(['2026-07-31', '2026-10-16T12:00:00Z'])), '2026-07-31')
  assert.equal(historyStartOf([null, undefined]), null)
  assert.equal(gapLabel({ newest: new Date(2026, 9, 2), oldest: new Date(2026, 8, 30), count: 3, ahead: false }).text, '3 dias sem registros · 30 set–2 out')
})

test('rows of a day card (8b): plant rows and dividers in the calendar, records only in a plant diary', () => {
  const day = [e('1', '2026-10-19T12:40:00Z', 'aurora'), e('2', '2026-10-19T12:42:00Z', 'sol'), e('3', '2026-10-19T12:41:00Z', 'aurora')]
  const names = { aurora: 'Aurora', sol: 'Sol' }
  const rows = dayRows(day, x => names[x.plant_id])
  assert.deepEqual(rows.map(r => r.kind === 'plant' ? `plant ${r.name} ${r.count}${r.divider ? ' |' : ''}` : `entry ${r.entry.id} ${r.divider}`),
    ['plant Sol 1', 'entry 2 none', 'plant Aurora 2 |', 'entry 1 none', 'entry 3 inset'])
  // A single plant's diary: no plant row, records in time order, indented divider from the second on.
  assert.deepEqual(dayRows(day).map(r => `${r.entry.id} ${r.divider}`), ['1 none', '3 inset', '2 inset'])
  assert.deepEqual(dayRows([]), [])
})
