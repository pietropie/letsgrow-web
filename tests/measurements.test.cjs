// Copiado de letsgrow-mobile/tests/measurements.test.cjs por scripts/sync-shared.mjs.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { formatMeasurementValue, measurementCaption, environmentMeasurement } = require('../src/shared/lib/measurements.ts')

test('segmented values support negatives, decimals, zero and three digits', () => {
  assert.equal(formatMeasurementValue(-12.5), '-12,5')
  assert.equal(formatMeasurementValue(100), '100')
  assert.equal(formatMeasurementValue(0), '0')
  assert.equal(formatMeasurementValue(23.84), '23,8')
  for (const value of [null, undefined, NaN, Infinity, -Infinity]) assert.equal(formatMeasurementValue(value), '—')
})

test('caption preserves the independent source and timestamp of each measurement', () => {
  const measurement = { value: 28, unit: '°C', source: 'manual', observed_at: '2026-10-16T12:00:00Z', source_id: 'event' }
  assert.match(measurementCaption(measurement), /^Manual · /)
  assert.match(measurementCaption({ ...measurement, source: 'sensor' }), /^Sensor · /)
  assert.match(measurementCaption({ ...measurement, observed_at: null }), /Horário não informado/)
  assert.match(measurementCaption({ ...measurement, observed_at: 'invalid' }), /Horário não informado/)
  assert.equal(measurementCaption({ ...measurement, value: null }), 'Sem medição')
})

test('legacy snapshots do not acquire invented provenance or a shared measurement date', () => {
  const reading = environmentMeasurement({ temp_c: 28, recorded_at: '2026-10-16T12:00:00Z' }, 'temperature')
  assert.equal(reading.value, 28)
  assert.equal(reading.source, null)
  assert.equal(reading.observed_at, null)
  assert.match(measurementCaption(reading), /Origem não informada/)
})

test('explicit missing readings override legacy scalars', () => {
  const temperature = { value: null, unit: '°C', source: null, observed_at: null, source_id: null }
  assert.deepEqual(environmentMeasurement({ temp_c: 28, temperature }, 'temperature'), temperature)
  assert.equal(environmentMeasurement(undefined, 'humidity').value, null)
})
