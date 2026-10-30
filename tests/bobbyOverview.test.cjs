// Copiado de letsgrow-mobile/tests/bobbyOverview.test.cjs por scripts/sync-shared.mjs.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { getBobbyOverview, getBobbyStatus } = require('../src/shared/lib/bobbyOverview.ts')

const plants = [{ id: 'a', strain_name: 'Aurora' }, { id: 'b', strain_name: 'Sol' }]
const makeAlert = (plant_id, tier, message = tier) => ({
  plant_id, tier, message, action: 'ação', reason: 'registro', alert_id: `${plant_id}-${tier}`, plant_name: plant_id,
})
const overview = (overrides) => getBobbyOverview({ plants, alerts: [], pending: false, failed: false, ...overrides })

test('does not use an alert from a different grow', () => {
  const result = overview({ alerts: [makeAlert('other-grow', 'critical')] })
  assert.equal(result.alert, undefined)
  assert.match(result.message, /não confirma/)
})

test('message and destination come from the same prioritized plant', () => {
  const alerts = [makeAlert('a', 'info'), makeAlert('b', 'anomaly'), makeAlert('a', 'attention')]
  const result = overview({ alerts })
  assert.equal(result.plant.id, 'b')
  assert.equal(result.message, 'anomaly')
  assert.equal(alerts[0].tier, 'info') // does not reorder cached query data
})

test('critical alerts take precedence over anomalies', () => {
  const result = overview({ alerts: [makeAlert('a', 'anomaly'), makeAlert('b', 'critical')] })
  assert.equal(result.plant.id, 'b')
})

test('failed refresh does not present cached alerts as current conclusions', () => {
  const result = overview({ failed: true, alerts: [makeAlert('a', 'critical')] })
  assert.equal(result.alert, undefined)
  assert.match(result.message, /Não foi possível/)
  assert.equal(getBobbyStatus(false, true, makeAlert('a', 'critical')), 'INDISPONÍVEL')
})

test('pending response is distinct from an empty response', () => {
  assert.match(overview({ pending: true }).message, /Carregando/)
  assert.equal(getBobbyStatus(true, false), 'CARREGANDO')
  assert.equal(getBobbyStatus(false, false), 'SEM ALERTAS RETORNADOS')
  assert.match(overview({}).message, /não confirma/)
})

test('an empty grow cannot select another plant', () => {
  const result = overview({ plants: [], alerts: [makeAlert('a', 'critical')] })
  assert.equal(result.plant, undefined)
  assert.deepEqual(result.contextualAlerts, [])
})
