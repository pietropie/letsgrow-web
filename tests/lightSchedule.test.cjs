// Copiado de letsgrow-mobile/tests/lightSchedule.test.cjs por scripts/sync-shared.mjs.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const ls = require('../src/shared/lib/lightSchedule.ts')

test('angle and minute convert both ways, 0 h at the top, clockwise', () => {
  assert.equal(ls.minuteToAngle(0), 0)
  assert.equal(ls.minuteToAngle(360), 90)
  assert.equal(ls.minuteToAngle(1425), 356.25)
  assert.equal(ls.minuteToAngle(1440), 0)
  assert.equal(ls.angleToMinute(90), 360)
  assert.equal(ls.angleToMinute(-90), 1080)
  assert.equal(ls.angleToMinute(450), 360)
})

test('dragging snaps to the absolute 15-min grid and wraps past midnight', () => {
  assert.equal(ls.snapMinute(367), 360)
  assert.equal(ls.snapMinute(368), 375)
  assert.equal(ls.snapMinute(1436), 0)
  assert.equal(ls.snapMinute(-8), 1440 - 15)
})

test('the off time is on + duration, across midnight', () => {
  assert.equal(ls.offMinute(360, 1065), 1425) // 06:00 + 17h45 = 23:45
  assert.equal(ls.offMinute(1200, 720), 480) // 20:00 + 12h = 08:00
  assert.equal(ls.formatClock(ls.offMinute(360, 1080)), '00:00')
})

test('clock text: format, parse, typing', () => {
  assert.equal(ls.formatClock(1425), '23:45')
  assert.equal(ls.parseClock('06:00:00'), 360)
  assert.equal(ls.parseClock('6:05'), 365)
  for (const t of ['24:00', '06:60', '0600', '', null]) assert.equal(ls.parseClock(t), null)
  assert.equal(ls.clockDigits('234'), '23:4')
  assert.equal(ls.clockDigits('2345'), '23:45')
  assert.equal(ls.clockDigits('23'), '23')
})

test('the derived photoperiod text matches the server', () => {
  assert.equal(ls.photoperiodText(1080), '18/6')
  assert.equal(ls.photoperiodText(1065), '17h45/6h15')
  assert.equal(ls.photoperiodText(1440), '24/0')
  assert.equal(ls.photoperiodText(725), '12h05/11h55')
  assert.equal(ls.durationLabel(1020), '17h')
  assert.equal(ls.presetFor(720).label, '12/12')
  assert.equal(ls.presetFor(1065), null)
})

test('schedule from the grow: minutes first, legacy N/M, incomplete custom', () => {
  assert.deepEqual(ls.scheduleFromGrow({ photoperiod_on_at: '06:00:00', photoperiod_light_minutes: 1065, photoperiod_hours: '17h45/6h15' }), { onAt: 360, light: 1065, incomplete: false })
  assert.deepEqual(ls.scheduleFromGrow({ photoperiod_on_at: '06:00:00', photoperiod_hours: '18/6' }), { onAt: 360, light: 1080, incomplete: false })
  assert.deepEqual(ls.scheduleFromGrow({ photoperiod_on_at: null, photoperiod_hours: 'custom', photoperiod_light_minutes: null }), { onAt: null, light: null, incomplete: true })
  assert.deepEqual(ls.scheduleFromGrow({ photoperiod_hours: '24/0' }), { onAt: null, light: 1440, incomplete: false })
  assert.deepEqual(ls.scheduleFromGrow(null), { onAt: null, light: null, incomplete: false })
})

test('moving a handle keeps the other in place, with a 15-min minimum gap', () => {
  // 06:00 → 23:45; drag "off" to 00:30 (past midnight).
  assert.deepEqual(ls.moveHandle('off', 30, 360, 1065), { on: 360, light: 1110 })
  // Drag "on" to 07:00: off stays at 23:45.
  assert.deepEqual(ls.moveHandle('on', 420, 360, 1065), { on: 420, light: 1005 })
  // "off" onto "on": clamped 15 min after it.
  assert.deepEqual(ls.moveHandle('off', 375, 360, 30), { on: 360, light: 15 })
  // Crossing the other handle (jump of more than 12 h) is ignored.
  assert.deepEqual(ls.moveHandle('off', 345, 360, 15), { on: 360, light: 15 })
})

test('dragging the arc moves both handles and keeps the duration', () => {
  assert.equal(ls.shiftSchedule(360, 600, 690), 450)
  assert.equal(ls.shiftSchedule(1380, 0, 120), 60)
  assert.equal(ls.nearestHandle(400, 360, 1065), 'on')
  assert.equal(ls.nearestHandle(1400, 360, 1065), 'off')
  assert.equal(ls.isLit(720, 360, 1065), true)
  assert.equal(ls.isLit(120, 360, 1065), false)
  assert.equal(ls.isLit(120, 1200, 720), true) // 20:00 → 08:00
})

test('screen reader summary', () => {
  assert.equal(ls.scheduleSummary(360, 1065), 'Luz liga às 6 horas e desliga às 23 horas e 45 minutos: 17 horas e 45 minutos de luz.')
  assert.equal(ls.scheduleSummary(360, 1440), 'Luz ligada 24 horas por dia.')
  assert.equal(ls.scheduleSummary(null, 1080), 'Programação de luz não definida.')
  assert.equal(ls.spokenClock(0), 'meia-noite')
  assert.equal(ls.spokenClock(61), 'uma hora e 1 minuto')
  assert.equal(ls.atClock(90), 'à uma hora e 30 minutos')
  assert.equal(ls.atClock(30), 'às 0 horas e 30 minutos')
  assert.equal(ls.atClock(0), 'à meia-noite')
  assert.equal(ls.scheduleSummary(360, 1080), 'Luz liga às 6 horas e desliga à meia-noite: 18 horas de luz.')
})

test('clearing the schedule (item 5b): offered only with something registered, verified on the answer', () => {
  assert.equal(ls.canClearSchedule({ photoperiod_on_at: '06:00:00', photoperiod_light_minutes: 1080, photoperiod_hours: '18/6' }), true)
  assert.equal(ls.canClearSchedule({ photoperiod_on_at: null, photoperiod_light_minutes: 1440, photoperiod_hours: '24/0' }), true)
  assert.equal(ls.canClearSchedule({ photoperiod_on_at: '06:00:00', photoperiod_light_minutes: null, photoperiod_hours: null }), true)
  // Nothing registered, or the legacy "custom" without times (J4): no link.
  assert.equal(ls.canClearSchedule({ photoperiod_on_at: null, photoperiod_light_minutes: null, photoperiod_hours: null }), false)
  assert.equal(ls.canClearSchedule({ photoperiod_on_at: null, photoperiod_light_minutes: null, photoperiod_hours: 'custom' }), false)
  assert.deepEqual(ls.CLEAR_SCHEDULE, { photoperiod_on_at: null, photoperiod_light_minutes: null })
  assert.equal(ls.scheduleCleared({ photoperiod_on_at: null, photoperiod_light_minutes: null, photoperiod_hours: null }), true)
  // A server that kept the derived text would still show 18/6: not cleared.
  assert.equal(ls.scheduleCleared({ photoperiod_on_at: null, photoperiod_light_minutes: null, photoperiod_hours: '18/6' }), false)
  assert.equal(ls.scheduleCleared({ photoperiod_on_at: '06:00', photoperiod_light_minutes: null }), false)
  assert.equal(ls.scheduleSummary(null, null), 'Programação de luz não definida.')
})

test('timer center follows the schedule now (item 2a revised): in, out, midnight, 24/0 and none', () => {
  // 18/6 from 06:00: lit 06:00 → 00:00.
  assert.equal(ls.lightNow(360, 1080, 360), 'on')
  assert.equal(ls.lightNow(360, 1080, 1439), 'on')
  assert.equal(ls.lightNow(360, 1080, 0), 'off')      // the off minute is already dark
  assert.equal(ls.lightNow(360, 1080, 359), 'off')
  // Through midnight: 18:00 → 06:00 (12/12).
  assert.equal(ls.lightNow(1080, 720, 1430), 'on')
  assert.equal(ls.lightNow(1080, 720, 120), 'on')
  assert.equal(ls.lightNow(1080, 720, 360), 'off')
  assert.equal(ls.lightNow(1080, 720, 720), 'off')
  // 24/0 is always lit, even without an on time.
  assert.equal(ls.lightNow(null, 1440, 200), 'on')
  assert.equal(ls.lightNow(0, 1440, 1439), 'on')
  // No schedule: no minutes, or minutes without an on time (incomplete), or cleared.
  assert.equal(ls.lightNow(null, null, 600), 'none')
  assert.equal(ls.lightNow(360, null, 600), 'none')
  assert.equal(ls.lightNow(null, 1080, 600), 'none')
})

test('panel ring shows the light already gone and what is left (item 2c)', () => {
  // 06:00 → 00:00, now 12:30: 6h30 gone, 11h30 left (user's reference).
  assert.deepEqual(ls.dialProgress(360, 1080, 750), { kind: 'cycle', lit: true, on: 360, elapsed: 390, remaining: 690, now: 750 })
  // Just turned on: nothing gone, the whole period left.
  assert.deepEqual(ls.dialProgress(360, 1080, 360), { kind: 'cycle', lit: true, on: 360, elapsed: 0, remaining: 1080, now: 360 })
  // Dark now (02:30): no light gone in this cycle, the whole next period in gray.
  assert.deepEqual(ls.dialProgress(360, 1065, 150), { kind: 'cycle', lit: false, on: 360, elapsed: 0, remaining: 1065, now: 150 })
  // Through midnight: 18:00 → 06:00, now 01:00 → 7h gone, 5h left.
  assert.deepEqual(ls.dialProgress(1080, 720, 60), { kind: 'cycle', lit: true, on: 1080, elapsed: 420, remaining: 300, now: 60 })
  // 24/0: full ring with only "now"; no schedule or incomplete: nothing.
  assert.deepEqual(ls.dialProgress(null, 1440, 600), { kind: 'full', now: 600 })
  assert.deepEqual(ls.dialProgress(null, null, 600), { kind: 'none' })
  assert.deepEqual(ls.dialProgress(360, null, 600), { kind: 'none' })
})

test('panel timer speaks the progress (item 2c)', () => {
  assert.equal(ls.progressSummary(360, 1065, 750), 'Luz ligada desde as 6 horas, desliga às 23 horas e 45 minutos; faltam 11 horas e 15 minutos.')
  assert.equal(ls.progressSummary(360, 1065, 150), 'Luz apagada; liga às 6 horas, em 3 horas e 30 minutos.')
  assert.equal(ls.progressSummary(0, 1080, 1079), 'Luz ligada desde a meia-noite, desliga às 18 horas; falta 1 minuto.')
  assert.equal(ls.progressSummary(60, 720, 600), 'Luz ligada desde a uma hora, desliga às 13 horas; faltam 3 horas.')
  assert.equal(ls.progressSummary(null, 1440, 10), 'Luz ligada o dia todo.')
  assert.equal(ls.progressSummary(null, null, 10), 'Sem programação de luz.')
})
