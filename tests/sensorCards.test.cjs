// Só da web: cartões de sensores do ambiente (Figma 28 · SN1–SN4, W10p, W11p).
const { test } = require('node:test')
const assert = require('node:assert/strict')
const s = require('../src/lib/sensor-cards.ts')

const empty = { recorded_at: '2026-11-25T12:00:00Z', temp_air: null, humidity_air: null, vpd_kpa: null, co2_ppm: null, ph_solution: null, soil_moisture_pct: null, temp_root: null, lux: null, ec_ms_cm: null }
const reading = o => ({ ...empty, ...o })
const dev = o => ({ id: 'd1', name: 'Ar da tenda', module_type: 'satellite', is_online: true, is_paired: true, last_seen_at: null, plant_id: null, ...o })
const ctx = { hubOnline: true, growName: 'Sala', plantName: id => (id === 'p1' ? 'Aurora' : null) }

test('the kind comes from the fields in the reading; VPD alone does not make an air card', () => {
  assert.deepEqual(s.kindsIn(reading({ temp_air: 25, humidity_air: 60, vpd_kpa: 1.2 })), ['air'])
  assert.deepEqual(s.kindsIn(reading({ vpd_kpa: 1.2 })), [])
  assert.deepEqual(s.kindsIn(reading({ lux: 100, ec_ms_cm: 1.6, soil_moisture_pct: 40 })), ['soil', 'light', 'solution'])
  assert.deepEqual(s.kindsIn(null), [])
})

test('range: out, near the edge (10 %), in range', () => {
  assert.equal(s.rangeState(30, 20, 28), 'out')
  assert.equal(s.rangeState(27.5, 20, 28), 'near')
  assert.equal(s.rangeState(24, 20, 28), 'ok')
  assert.equal(s.rangeState(21, 30, 70), 'out')
})

test('one card per kind: a satellite with one kind keeps its name; the Hub uses the kind name', () => {
  const cards = s.sensorCards([
    dev({ id: 'hub', name: 'Hub 3F2A', module_type: 'hub' }),
    dev({ id: 'sat', name: 'Solo vaso 1', plant_id: 'p1' }),
  ], { hub: reading({ temp_air: 25, humidity_air: 60, ec_ms_cm: 1.6 }), sat: reading({ soil_moisture_pct: 21 }) }, ctx)
  assert.deepEqual(cards.map(c => [c.title, c.tags[1]]), [['Ar', 'no Hub 3F2A'], ['Solução', 'no Hub 3F2A'], ['Solo vaso 1', 'Aurora']])
  assert.deepEqual(cards[0].metrics.map(m => m.key), ['temp_air', 'humidity_air'])
})

test('states: hub offline fades everything, satellite without signal, waiting for the first reading', () => {
  const r = { d1: reading({ temp_air: 25 }) }
  assert.equal(s.sensorCards([dev()], r, { ...ctx, hubOnline: false })[0].state, 'hub-offline')
  assert.equal(s.sensorCards([dev({ is_online: false })], r, ctx)[0].state, 'no-signal')
  const waiting = s.sensorCards([dev()], {}, ctx)
  assert.equal(waiting[0].state, 'waiting')
  assert.equal(waiting[0].kind, null)
  // satélite ainda não pareado e Hub sem medida não viram cartão
  assert.equal(s.sensorCards([dev({ is_paired: false }), dev({ id: 'h', module_type: 'hub' })], {}, ctx).length, 0)
})

test('PPM is EC × 500', () => {
  const ppm = s.KIND.solution.metrics[0]
  assert.equal(ppm.read(reading({ ec_ms_cm: 1.64 })), 820)
  assert.equal(ppm.read(reading({})), null)
})

// Resposta de GET /iot/grows/{grow_id}/sensors (API-SENSORES-RELES.md §2), resumida.
const api = {
  grow_id: 'g1', phase: 'flower', light_on: true,
  hub: { id: 'hub', name: 'Hub 3EE0', tag: 'A base · fica ligada no Wi-Fi', icon: 'hub', photo_url: null, online: true, last_seen_at: '2026-11-25T14:59:00Z', satellites_total: 4, satellites_online: 3 },
  cards: [
    { device_id: 'sat', card_id: 'sat:soil', name: 'Solo vaso 1', source: 'satellite', sensor_kind: 'soil', kind_label: 'Solo', tag: 'Umidade do substrato', description: 'Fica espetado no substrato.', icon: 'watering', photo_url: null,
      placement: { plant_id: 'p1', label: 'Vaso 1 · Aurora' }, status: 'live', last_reading_at: '2026-11-25T14:58:00Z',
      metrics: [{ metric: 'soil_moisture_pct', label: 'Umidade do substrato', unit: '%', decimals: 0, computed: false, note: null, value: 21, range: { min: 35, max: 60 }, state: 'out', out_of_range_since: '2026-11-25T10:00:00Z' }],
      worst_state: 'out', history: { metric: 'soil_moisture_pct', window: '3d', buckets: [{ avg: 48.2, state: 'ok' }, { avg: null, state: 'none' }, { avg: 21, state: 'out' }], min: 20, max: 51 } },
    { device_id: 'hub', card_id: 'hub:air', name: 'Ar', source: 'hub', sensor_kind: 'air', kind_label: 'Ar', tag: 'Ar · temperatura e umidade', icon: 'temperature', status: 'live', last_reading_at: '2026-11-25T14:59:00Z',
      metrics: [
        { metric: 'temp_air', label: 'Temperatura', unit: '°C', decimals: 1, computed: false, value: 25.4, range: { min: 22, max: 26 }, state: 'ok' },
        { metric: 'humidity_air', label: 'Umidade', unit: '%', decimals: 0, computed: false, value: 63, range: { min: 45, max: 60 }, state: 'out' },
        { metric: 'vpd_kpa', label: 'VPD', unit: 'kPa', decimals: 1, computed: true, value: 1.2, range: null, state: 'none' },
      ], worst_state: 'out', history: null },
    { device_id: 'hub', card_id: 'hub:solution', name: 'Solução', source: 'hub', sensor_kind: 'solution', tag: 'PPM / EC da solução', icon: 'fert', status: 'live',
      metrics: [{ metric: 'ppm', label: 'PPM', unit: 'ppm', decimals: 0, computed: true, value: 820, range: { min: 800, max: 1100 }, state: 'ok' }, { metric: 'ec_ms_cm', label: 'EC', unit: 'mS/cm', decimals: 1, computed: false, value: 1.6, range: null, state: 'none' }],
      worst_state: 'ok' },
  ],
  out_of_range_count: 2,
}

test('API screen: hub, cards in the API order, placement, history and icons', () => {
  const sc = s.screenFromApi(api, 'Sala')
  assert.equal(sc.source, 'api')
  assert.deepEqual([sc.hub.name, sc.hub.online, sc.hub.satellites, sc.hub.satellitesOnline], ['Hub 3EE0', true, 4, 3])
  assert.deepEqual(sc.cards.map(c => [c.title, c.tags[1], c.icon]), [['Solo vaso 1', 'Vaso 1 · Aurora', 'watering'], ['Ar', 'no Hub 3EE0', 'temperature'], ['Solução', 'no Hub 3EE0', 'fert']])
  assert.equal(sc.cards[0].history.window, '3 dias')
  assert.deepEqual(sc.cards[0].history.bars.map(b => b.state), ['ok', 'none', 'out'])
  assert.deepEqual(sc.cards[0].metrics[0].range, { min: 35, max: 60 })
  assert.equal(sc.outOfRange, 2)
  assert.equal(sc.lightOn, true)
  assert.equal(s.screenFromApi({ hub: null, cards: [] }, 'Sala').hub, null)
})

test('out of range since: below or above, and for how long', () => {
  const now = Date.parse('2026-11-25T15:00:00Z')
  const m = s.screenFromApi(api, 'Sala').cards[0].metrics[0]
  assert.equal(s.outSinceText(m, now), 'Abaixo da faixa há 5 h.')
  assert.equal(s.outSinceText({ ...m, state: 'ok' }, now), null)
  assert.equal(s.rangeLine(m), 'faixa 35–60 %')
})

test('local fallback: same model, out of range first, hub offline makes every card stale', () => {
  const devices = [dev({ id: 'hub', name: 'Hub', module_type: 'hub' }), dev({ id: 'soil', name: 'Solo vaso 1', plant_id: 'p1' })]
  const readings = { hub: reading({ temp_air: 25, humidity_air: 55, lux: 32400 }), soil: reading({ soil_moisture_pct: 21 }) }
  const sc = s.screenFromLocal(devices, readings, { growName: 'Sala', plantName: ctx.plantName, lightOn: false })
  assert.equal(sc.source, 'local')
  assert.deepEqual(sc.cards.map(c => [c.title, c.worst]), [['Solo vaso 1', 'out'], ['Ar', 'ok'], ['Luz', 'none']])
  assert.equal(sc.cards[2].metrics[0].range, null) // luz apagada pela programação: sem faixa
  assert.equal(sc.outOfRange, 1)
  const off = s.screenFromLocal([dev({ id: 'hub', name: 'Hub', module_type: 'hub', is_online: false }), devices[1]], readings, { growName: 'Sala', plantName: ctx.plantName, lightOn: null })
  assert.deepEqual([...new Set(off.cards.map(c => c.status))], ['stale'])
})

test('panel tiles: one per measure, EC out (PPM in), VPD last, at most six', () => {
  const tiles = s.screenTiles(s.screenFromApi(api, 'Sala'))
  assert.deepEqual(tiles.map(t => [t.label, t.state]), [['Temperatura', 'ok'], ['Umidade', 'out'], ['Solo · Vaso 1', 'out'], ['PPM', 'ok'], ['VPD', 'none']])
  assert.equal(tiles[4].computed, true)
  assert.deepEqual(s.compact(32400, 'lx'), { value: 32, prefix: 'k' })
})

test('times and range text', () => {
  const now = Date.parse('2026-11-25T15:00:00')
  assert.equal(s.ago(new Date(now - 120_000).toISOString(), now), 'há 2 min')
  assert.equal(s.ago(new Date(now - 5 * 3600_000).toISOString(), now), 'há 5 h')
  assert.equal(s.ago(new Date('2026-11-24T10:10:00').toISOString(), now), 'ontem 10:10')
  assert.equal(s.ago(new Date('2026-11-24T22:10:00').toISOString(), now), 'há 17 h')
  assert.equal(s.ago(null), null)
  assert.equal(s.rangeText(s.KIND.light.metrics[0]), 'faixa 25 000–50 000 lx')
  assert.equal(s.rangeText(s.KIND.ph.metrics[0]), 'faixa 5,8–6,5')
})
