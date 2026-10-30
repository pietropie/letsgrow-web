// Copiado de letsgrow-mobile/tests/screenFacts.test.cjs por scripts/sync-shared.mjs.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { parseBrDate, formatBrDate, shortDayMonth, dayMonthTime } = require('../src/shared/lib/dates.ts')
const { wateringInterval, photoStats, nextPhase, hasPlantDetails, shortPlantName, eventsInLastDays, isFeeding, phaseStart, plantCount } = require('../src/shared/lib/plantFacts.ts')
const { photoperiod, lightDescription, carbonFilterLabel, fans, hasEquipment } = require('../src/shared/lib/growEquipment.ts')

const event = (event_type, event_date, extra = {}) => ({ id: event_date, plant_id: 'p', event_type, event_date, photo_keys: null, ppm: null, ...extra })

test('typed dates are validated, never guessed', () => {
  assert.equal(parseBrDate(''), null)
  assert.equal(parseBrDate('26/07/2026'), '2026-07-26')
  assert.equal(parseBrDate('31/02/2026'), 'invalid')
  assert.equal(parseBrDate('2026-07-26'), 'invalid')
  assert.equal(parseBrDate('01/01/2999'), 'invalid')
  assert.equal(formatBrDate('2026-07-26'), '26/07/2026')
  assert.equal(formatBrDate(null), '')
})

test('Figma date labels and missing dates', () => {
  assert.equal(shortDayMonth('2026-09-14T12:00:00'), '14 set')
  assert.equal(dayMonthTime('2026-09-14T09:40:00', ' · '), '14 set · 09:40')
  assert.equal(shortDayMonth(null), null)
  assert.equal(dayMonthTime('not a date'), null)
})

test('watering interval needs two registered waterings', () => {
  assert.equal(wateringInterval([event('watering', '2026-09-01T10:00:00Z')]), null)
  assert.deepEqual(wateringInterval([event('watering', '2026-09-01T10:00:00Z'), event('rega', '2026-09-05T10:00:00Z'), event('note', '2026-09-02T10:00:00Z')]), { days: 4, count: 2 })
})

test('photo counts come from record attachments', () => {
  const stats = photoStats([event('note', '2026-09-01T10:00:00Z', { photo_keys: ['a', 'b'] }), event('note', '2026-09-03T10:00:00Z', { photo_keys: ['c'] }), event('watering', '2026-09-04T10:00:00Z')])
  assert.equal(stats.count, 3)
  assert.equal(stats.last, '2026-09-03T10:00:00Z')
})

test('feeding is recognised from type or a PPM value on a watering', () => {
  assert.equal(isFeeding(event('feeding', '2026-09-01')), true)
  assert.equal(isFeeding(event('watering', '2026-09-01', { ppm: 800 })), true)
  assert.equal(isFeeding(event('watering', '2026-09-01')), false)
})

test('recent records and phase order', () => {
  const now = new Date('2026-09-10T12:00:00Z').getTime()
  assert.equal(eventsInLastDays([event('note', '2026-09-09T12:00:00Z'), event('note', '2026-08-01T12:00:00Z')], 7, now), 1)
  assert.equal(nextPhase('veg'), 'flower')
  assert.equal(nextPhase('curing'), null)
  assert.equal(nextPhase('unknown'), null)
})

test('compact plant variant only when nothing beyond the name is known', () => {
  const bare = { strain_name: '', strain_type: 'unknown', seed_type: 'unknown', genetics: null, pot_label: null, pot_volume_liters: null, substrate: null, germination_date: null, current_phase: 'unknown' }
  assert.equal(hasPlantDetails(bare), false)
  assert.equal(hasPlantDetails({ ...bare, strain_name: 'Aurora' }), true)
  assert.equal(hasPlantDetails({ ...bare, current_phase: 'veg' }), true)
  assert.equal(shortPlantName('Planta Sol'), 'Sol')
  assert.equal(shortPlantName('Gelato'), 'Gelato')
})

test('registered equipment is described without inventing a state', () => {
  assert.deepEqual(photoperiod({ photoperiod_hours: '18/6' }), { on: 18, off: 6 })
  assert.equal(photoperiod({ photoperiod_hours: 'custom' }), null)
  assert.equal(photoperiod({ photoperiod_hours: '18/8' }), null)
  assert.equal(lightDescription({ light_type: 'led_quantum_board', lighting_watts: 720 }), 'LED quantum board · 720 W')
  assert.equal(lightDescription({ light_type: null, lighting_watts: null }), null)
  assert.equal(carbonFilterLabel(null), 'NÃO INFORMADO')
  assert.equal(fans({ fans: null, internal_circulation_fans: 0 }).length, 0)
  assert.equal(hasEquipment({}), false)
})

test('phase start comes only from registered dates or FASE records (QA nº 3)', () => {
  const plant = (current_phase, extra = {}) => ({ current_phase, germination_date: null, flip_date: null, harvest_date: null, ...extra })
  const records = [event('veg', '2026-10-01T12:00:00Z'), event('veg', '2026-10-05T12:00:00Z'), event('flip', '2026-10-10T12:00:00Z')]
  assert.equal(phaseStart(plant('unknown'), records), null)
  assert.equal(phaseStart(plant('veg'), records), '2026-10-05T12:00:00Z')
  assert.equal(phaseStart(plant('seedling'), records), null)
  assert.equal(phaseStart(plant('flower', { flip_date: '2026-10-11' }), records), '2026-10-11')
  assert.equal(phaseStart(plant('flower'), records), '2026-10-10T12:00:00Z')
  assert.equal(phaseStart(plant('germination', { germination_date: '2026-09-01' }), []), '2026-09-01')
})

test('plant count is singular for one plant (QA nº 13)', () => {
  assert.equal(plantCount(1), '1 planta')
  assert.equal(plantCount(0), '0 plantas')
  assert.equal(plantCount(2), '2 plantas')
})

test('phase icon mapping follows the Figma "Fases" components', () => {
  const { phaseIcon, PHASE_ICON_LABEL } = require('../src/shared/lib/plantFacts.ts')
  assert.equal(phaseIcon('germination'), 'germination')
  assert.equal(phaseIcon('seedling'), 'seedling')
  assert.equal(phaseIcon('veg'), 'veg')
  assert.equal(phaseIcon('flower'), 'flower')
  assert.equal(phaseIcon('late_flower'), 'flower')
  // No icon in the Figma for these: nothing is invented.
  for (const phase of ['harvest', 'drying', 'curing', 'unknown', '', null, undefined, 'other']) assert.equal(phaseIcon(phase), null)
  assert.deepEqual(PHASE_ICON_LABEL, { germination: 'GÉRMEN', seedling: 'MUDA', veg: 'VEGA', flower: 'FLORA' })
})

test('day counts share one rule and the strain percent is not doubled (QA 2026-10-20 nº 2 e 3)', () => {
  const { dayNumber, dayCount, percentText } = require('../src/shared/lib/plantFacts.ts')
  // The first day of a period is day 1, as in the Figma ("TEMPO 22 dias" = "DIA 22").
  assert.equal(dayNumber(0), 1)
  assert.equal(dayNumber(21), 22)
  assert.equal(dayCount(1), '1 dia')
  assert.equal(dayCount(2), '2 dias')
  assert.equal(percentText('17–20%'), '17–20%')
  assert.equal(percentText('20'), '20%')
  assert.equal(percentText('18-22'), '18-22%')
  assert.equal(percentText(' Alto '), 'Alto')
  assert.equal(percentText(''), null)
  assert.equal(percentText(null), null)
})
