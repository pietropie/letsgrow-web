// Copiado de letsgrow-mobile/tests/equipmentForms.test.cjs por scripts/sync-shared.mjs.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { draftFromGrow, payloadFromDraft, unsavedFields, equipmentSummary, hasAnyEquipment, clockValue, triFromBool, boolFromTri, isEquipmentKind } = require('../src/shared/lib/equipmentForms.ts')

const empty = { id: 'g', name: 'Sala', light_type: null, lighting_watts: null, light_distance_cm: null, photoperiod_hours: null, photoperiod_on_at: null, light_leak_controlled: null,
  exhaust_type: null, exhaust_cfm: null, exhaust_location: null, carbon_filter: null, intake_type: null, negative_pressure: null, fans: null, internal_circulation_fans: null,
  air_conditioning: null, dehumidifier: null, humidifier: null, heater: null, target_temp_c: null, target_humidity_rh: null, tent_width_cm: null, tent_depth_cm: null, tent_height_cm: null, pot_type: null, substrate_type: null }
const sala = { ...empty, light_type: 'led_quantum_board', lighting_watts: 720, photoperiod_hours: '18/6', photoperiod_on_at: '06:00:00', light_leak_controlled: true,
  exhaust_type: 'inline_fan', exhaust_cfm: 400, exhaust_location: 'copa', carbon_filter: true, fans: [{ location: 'copa', watts: 20, on: true }, { location: 'base' }],
  dehumidifier: true, target_temp_c: 24, target_humidity_rh: 55, tent_width_cm: 120, tent_depth_cm: 120, tent_height_cm: 200 }

test('booleans have three answers: Sim, Não and Não sei (null)', () => {
  assert.deepEqual([true, false, null, undefined].map(triFromBool), ['yes', 'no', '', ''])
  assert.deepEqual(['yes', 'no', ''].map(boolFromTri), [true, false, null])
})

test('the form starts from the grow, with no example values', () => {
  assert.deepEqual(draftFromGrow('light', sala).values, { light_type: 'led_quantum_board', lighting_watts: '720', light_distance_cm: '', photoperiod_on_at: '06:00', photoperiod_light_minutes: '1080', light_leak_controlled: 'yes' })
  assert.equal(draftFromGrow('light', { ...sala, photoperiod_light_minutes: 1065, photoperiod_hours: '17h45/6h15' }).values.photoperiod_light_minutes, '1065')
  assert.equal(draftFromGrow('light', { ...sala, photoperiod_hours: 'custom' }).values.photoperiod_light_minutes, '')
  assert.deepEqual(draftFromGrow('fans', sala).fans, [{ location: 'copa', watts: '20', on: true }, { location: 'base', watts: '' }])
  assert.deepEqual(draftFromGrow('space', empty).values, { tent_width_cm: '', tent_depth_cm: '', tent_height_cm: '' })
  assert.equal(draftFromGrow('climate', { ...empty, target_temp_c: 24.5 }).values.target_temp_c, '24,5')
})

test('each kind sends only its own fields', () => {
  const { body } = payloadFromDraft('light', draftFromGrow('light', sala))
  // photoperiod_hours is derived by the server and never sent.
  assert.deepEqual(Object.keys(body).sort(), ['light_distance_cm', 'light_leak_controlled', 'light_type', 'lighting_watts', 'photoperiod_light_minutes', 'photoperiod_on_at'])
  assert.equal(body.photoperiod_on_at, '06:00')
  assert.equal(body.photoperiod_light_minutes, 1080)
  assert.match(payloadFromDraft('light', { values: { photoperiod_on_at: '', photoperiod_light_minutes: '1065' }, fans: [] }).error, /hora em que a luz liga/)
  assert.equal(payloadFromDraft('light', { values: { photoperiod_on_at: '', photoperiod_light_minutes: '1440' }, fans: [] }).body.photoperiod_light_minutes, 1440)
  assert.equal(body.light_distance_cm, null)
  assert.deepEqual(payloadFromDraft('pot', { values: { pot_type: 'fabric', substrate_type: '' }, fans: [] }).body, { pot_type: 'fabric', substrate_type: null })
})

test('"Sem exaustão" leaves flow, location and filter out of the request', () => {
  const draft = draftFromGrow('exhaust', sala)
  draft.values.exhaust_type = 'none'
  const { body } = payloadFromDraft('exhaust', draft)
  assert.deepEqual(Object.keys(body).sort(), ['exhaust_type', 'intake_type', 'negative_pressure'])
  assert.equal(body.exhaust_type, 'none')
})

test('fans are sent as a list with their own location and power, and the count follows the list', () => {
  const draft = draftFromGrow('fans', sala)
  draft.fans.push({ location: '', watts: '' })
  const { body } = payloadFromDraft('fans', draft)
  assert.deepEqual(body.fans, [{ location: 'copa', watts: 20, on: true }, { location: 'base' }, {}])
  assert.equal(body.internal_circulation_fans, 3)
  assert.deepEqual(payloadFromDraft('fans', { values: {}, fans: [] }).body, { fans: [], internal_circulation_fans: 0 })
  assert.match(payloadFromDraft('fans', { values: {}, fans: [{ location: 'copa', watts: '2,5' }] }).error, /Ventilador 1/)
})

test('numbers and the clock are validated before saving', () => {
  assert.match(payloadFromDraft('space', { values: { tent_width_cm: '12,5', tent_depth_cm: '', tent_height_cm: '' }, fans: [] }).error, /Largura/)
  assert.match(payloadFromDraft('climate', { values: { target_humidity_rh: '120' }, fans: [] }).error, /Umidade-alvo.*entre 0 e 100/)
  assert.equal(payloadFromDraft('climate', { values: { target_temp_c: '24,5' }, fans: [] }).body.target_temp_c, 24.5)
  assert.equal(clockValue('6:00'), '06:00')
  assert.equal(clockValue(''), null)
  for (const t of ['24:00', '6h', '06:7']) assert.equal(clockValue(t), 'invalid')
  assert.match(payloadFromDraft('light', { values: { photoperiod_on_at: '25:00' }, fans: [] }).error, /HH:MM/)
})

test('a field the server did not store is reported, not shown as saved', () => {
  const body = { light_leak_controlled: null, lighting_watts: 720, light_distance_cm: null }
  assert.deepEqual(unsavedFields(body, { ...sala, light_distance_cm: null }), ['Vazamento de luz controlado'])
  assert.deepEqual(unsavedFields(body, { ...sala, light_leak_controlled: null }), [])
  // An older backend ignores photoperiod_light_minutes; times match with or without seconds.
  assert.deepEqual(unsavedFields({ photoperiod_on_at: '06:00', photoperiod_light_minutes: 1065 }, { ...sala, photoperiod_light_minutes: undefined }), ['Programação de luz'])
  assert.deepEqual(unsavedFields({ photoperiod_on_at: '06:00', photoperiod_light_minutes: 1065 }, { ...sala, photoperiod_light_minutes: 1065 }), [])
})

test('the Equipamentos rows summarise what is registered', () => {
  assert.equal(equipmentSummary('light', sala), 'LED Quantum Board · 720 W · 18/6 · liga às 06:00')
  assert.equal(equipmentSummary('light', { ...sala, photoperiod_hours: '17h45/6h15', photoperiod_light_minutes: 1065 }), 'LED Quantum Board · 720 W · 17h45/6h15 · liga às 06:00')
  assert.equal(equipmentSummary('light', { ...empty, photoperiod_hours: 'custom' }), 'programação incompleta')
  assert.equal(equipmentSummary('exhaust', sala), 'Exaustor inline · 400 CFM · copa · filtro acoplado')
  assert.equal(equipmentSummary('exhaust', { ...sala, exhaust_type: 'none' }), 'Sem exaustão')
  assert.equal(equipmentSummary('fans', sala), '2 ventiladores')
  assert.equal(equipmentSummary('climate', sala), 'Desumidificador · alvo 24 °C e 55 %')
  assert.equal(equipmentSummary('space', sala), '120 × 120 × 200 cm')
  assert.equal(equipmentSummary('pot', sala), 'Não informado')
  assert.equal(hasAnyEquipment(empty), false)
  assert.equal(hasAnyEquipment(sala), true)
  assert.equal(isEquipmentKind('fans'), true)
  assert.equal(isEquipmentKind('grow-setup'), false)
})
