// Copiado de letsgrow-mobile/tests/homeClimate.test.cjs por scripts/sync-shared.mjs.
// New Início (UX item 11): weather card states, outside × inside, attention, picker and place.
process.env.TZ = 'America/Sao_Paulo'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const h = require('../src/shared/lib/homeClimate.ts')

const now = new Date(2026, 9, 27, 12, 40)
const at = (hh, mm, day = 27) => new Date(2026, 9, day, hh, mm).toISOString()

test('weather card state by HTTP status', () => {
  assert.equal(h.weatherCard({ pending: true }), 'loading')
  assert.equal(h.weatherCard({ data: { temperature: 31 } }), 'ok')
  assert.equal(h.weatherCard({ failed: true, status: 409 }), 'no_location')
  assert.equal(h.weatherCard({ failed: true, status: 404 }), 'not_found')
  for (const status of [502, 504, 500, null, undefined]) assert.equal(h.weatherCard({ failed: true, status }), 'unavailable')
})

test('outdoor line hides the range without max and min', () => {
  assert.equal(h.outdoorLine({ temp_max: 33.4, temp_min: 18.6, humidity: 45 }), 'máx 33° · mín 19°')
  assert.equal(h.outdoorLine({ temp_max: null, temp_min: null, humidity: 45 }), '')
})

test('outside × inside comparison, only facts and only with both sides', () => {
  const c = h.compareClimate({ t: 31.2, rh: 45 }, { t: 25, rh: 60 })
  assert.deepEqual(c.temperature, { text: '31 °C lá fora → 25 °C dentro', tag: '6 °C MAIS FRESCO DENTRO', tone: 'cooler' })
  assert.deepEqual(c.humidity, { text: '45 % lá fora → 60 % dentro', tag: '+15 PONTOS DENTRO', tone: 'more' })
  const warm = h.compareClimate({ t: 18, rh: 80 }, { t: 24, rh: 79 })
  assert.equal(warm.temperature.tag, '6 °C MAIS QUENTE DENTRO')
  assert.equal(warm.humidity.tag, '−1 PONTO DENTRO')
  assert.equal(h.compareClimate({ t: 24, rh: 50 }, { t: 24.2, rh: 50 }).temperature.tag, 'MESMA TEMPERATURA')
  assert.deepEqual(h.compareClimate({ t: 31, rh: 45 }, { t: null, rh: null }), { temperature: null, humidity: null })
})

test('footer and tip basis', () => {
  assert.equal(h.climateFooter({ fetchedAt: at(12, 30), inside: { source: 'manual', observedAt: at(12, 17) }, tip: false, now }),
    'Lá fora: Open-Meteo · 12:30. Dentro: registro manual · 12:17. A comparação não liga nem regula equipamentos.')
  assert.equal(h.climateFooter({ fetchedAt: at(12, 30), inside: null, tip: false, now }), 'Lá fora: Open-Meteo · 12:30. A comparação não liga nem regula equipamentos.')
  assert.equal(h.climateFooter({ tip: true }), 'A dica é uma regra do Bobby com os dados acima. Não liga nem regula equipamentos.')
  assert.equal(h.tipBasis([{ kind: 'weather', title: 'Open-Meteo · Campinas, SP', date: at(12, 30) }, { kind: 'environment_reading', title: 'Registro do ambiente · 60%', date: at(12, 17) }], now),
    'Com base em: Open-Meteo · Campinas, SP às 12:30 · Registro do ambiente · 60% às 12:17')
  assert.equal(h.tipBasis([], now), '')
})

test('greeting date, stamps and icon', () => {
  assert.equal(h.greetingDate(now), 'Ter, 27 de outubro')
  assert.equal(h.stamp(at(12, 17), now), '12:17')
  assert.equal(h.stamp(at(9, 0, 19), now), '19 out')
  assert.equal(h.weatherIcon({ is_day: true, weather_code: 2 }), 'day')
  assert.equal(h.weatherIcon({ is_day: false, weather_code: 2 }), 'night')
  assert.equal(h.weatherIcon({ is_day: true, weather_code: 63 }), null)
})

test('attention: out of range, watering and Bobby alerts, at most 3 with the total', () => {
  const base = { growId: 'g1', growName: 'Sala', now, lastWatering: { p1: at(10, 0, 24) } }
  const r = h.attentionItems({ ...base, temperature: { value: 25, source: 'manual', observed_at: at(12, 17) }, humidity: { value: 60, source: 'manual', observed_at: at(12, 17) },
    targetTemp: 24, targetRh: 55, alerts: [
      { alert_id: 'a1', plant_id: 'p2', plant_name: 'Sol', action: 'tricomas', message: 'pH alto nas últimas regas', tier: 'anomaly', evidence: [{}, {}] },
      { alert_id: 'a2', plant_id: 'p1', plant_name: 'Aurora', action: 'watering', message: 'Aurora sem rega', tier: 'critical' },
      { alert_id: 'a3', plant_id: 'p1', plant_name: 'Aurora', action: 'humidity', message: 'Umidade alta', tier: 'critical' },
      { alert_id: 'a4', plant_id: 'p2', plant_name: 'Sol', action: 'flip', message: 'Virar para flora', tier: 'info' },
    ] })
  assert.equal(r.total, 4)
  assert.deepEqual(r.items.map(i => [i.tag, i.title, i.meta]), [
    ['AMBIENTE', 'Umidade da Sala acima da faixa', '60 % · faixa 55 % · manual 12:17'],
    ['REGA', 'Rega da Aurora', 'última há 3 dias · 24 out'],
    ['BOBBY', 'pH alto nas últimas regas', 'Bobby · 2 registros'],
  ])
  // 25 °C against 24 °C is inside the 2 °C margin; the humidity alert is not repeated after the app's own item.
  assert.ok(!r.items.some(i => i.key === 'a3'))
  // An old reading does not raise an item.
  const old = h.attentionItems({ ...base, temperature: { value: 35, observed_at: at(1, 0) }, humidity: { value: null }, targetTemp: 24, alerts: [] })
  assert.deepEqual(old, { items: [], total: 0 })
})

test('environment picker and remembered choice', () => {
  assert.equal(h.growChoiceLine({ location_label: 'Campinas, SP', lat: -22.9, active_plant_count: 2 }, 25.2, 60), 'Campinas, SP · 2 plantas · 25 ° · 60 %')
  assert.equal(h.growChoiceLine({ active_plant_count: 1 }, null, null), 'Sem local · 1 planta · sem leitura')
  assert.equal(h.growChoiceLine({ lat: 1, active_plant_count: 1 }, null, 50), 'Local do ambiente · 1 planta · 50 %')
  const grows = [{ id: 'a' }, { id: 'b' }]
  assert.equal(h.pickGrow(grows, 'b').id, 'b')
  assert.equal(h.pickGrow(grows, 'gone').id, 'a')
  assert.equal(h.pickGrow([], 'a'), null)
})

test('place label from reverse geocoding and rounded coordinates', () => {
  assert.equal(h.placeLabel({ city: 'Campinas', region: 'São Paulo', isoCountryCode: 'BR' }), 'Campinas, SP')
  assert.equal(h.placeLabel({ subregion: 'Lisboa', region: 'Lisboa', isoCountryCode: 'PT' }), 'Lisboa')
  assert.equal(h.placeLabel({ city: 'Porto', region: 'Porto District', isoCountryCode: 'PT' }), 'Porto, Porto District')
  assert.equal(h.placeLabel({ region: 'São Paulo', isoCountryCode: 'BR' }), null)
  assert.equal(h.placeLabel(null), null)
  assert.equal(h.roundCoord(-22.90556), -22.91)
  assert.equal(h.roundCoord(-47.06194), -47.06)
})

test('last record line (U5)', () => {
  assert.equal(h.lastRecordLine(undefined, now), null)
  assert.equal(h.lastRecordLine(null, now), 'nenhum registro ainda')
  assert.equal(h.lastRecordLine(at(9, 40), now), 'último registro hoje às 09:40')
  assert.equal(h.lastRecordLine(at(9, 40, 26), now), 'último registro ontem')
  assert.equal(h.lastRecordLine(at(9, 40, 23), now), 'último registro há 4 dias')
  assert.equal(h.lastRecordLine(at(9, 40, 12), now), 'último registro em 12 out')
})

test('location permission: granted locates, denied goes to the city search', () => {
  assert.equal(h.locationOutcome({ status: 'granted', canAskAgain: true }), 'locate')
  assert.equal(h.locationOutcome({ status: 'denied', canAskAgain: true }), 'search')
  assert.equal(h.locationOutcome({ status: 'denied', canAskAgain: false }), 'search_with_settings')
  assert.equal(h.locationOutcome({ status: 'undetermined' }), 'search')
})

test('tip basis with the published source kinds (target, plant, light schedule)', () => {
  assert.equal(h.tipBasis([
    { kind: 'weather', title: 'Open-Meteo · Campinas, SP', date: at(12, 30) },
    { kind: 'sensor_reading', title: 'Sensor · 60%', date: at(12, 20) },
    { kind: 'target', title: 'Faixa definida · 55%' },
    { kind: 'plant', title: 'Fase · Vegetativa', date: null },
    { kind: 'light_schedule', title: 'Programação de luz · 06:00 → 00:00' },
  ], now), 'Com base em: Open-Meteo · Campinas, SP às 12:30 · Sensor · 60% às 12:20 · Faixa definida · 55% · Fase · Vegetativa · Programação de luz · 06:00 → 00:00')
})
