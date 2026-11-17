// Só da web: restaurar planta arquivada (backend cb83fc2), mesmas regras do mobile (listsV2.archivedView).
const { test } = require('node:test')
const assert = require('node:assert/strict')
const r = require('../src/lib/plant-restore.ts')

const plant = (o = {}) => ({ is_active: false, current_phase: 'veg', harvest_date: null, grow_id: 'g1', ...o })

test('active or harvested: no restore', () => {
  assert.equal(r.restoreView(plant({ is_active: true }), { atLimit: false, growActive: true }), null)
  assert.equal(r.restoreView(plant({ harvest_date: '2026-10-01' }), { atLimit: false, growActive: true }), null)
  assert.equal(r.restoreView(plant({ current_phase: 'curing' }), { atLimit: false, growActive: true }), null)
})

test('archived: allowed, or blocked by the grow first, then by the limit', () => {
  assert.deepEqual(r.restoreView(plant(), { atLimit: false, growActive: true }), { allowed: true, blocked: null })
  assert.equal(r.restoreView(plant(), { atLimit: true, growActive: false }).blocked.reason, 'grow')
  assert.equal(r.restoreView(plant(), { atLimit: true, growActive: true }).blocked.reason, 'limit')
  // ambientes ainda carregando: libera e a API decide
  assert.deepEqual(r.restoreView(plant(), { atLimit: false, growActive: null }), { allowed: true, blocked: null })
})

test('plan limit: 9999 is unlimited', () => {
  assert.equal(r.atPlantLimit(2, 2), true)
  assert.equal(r.atPlantLimit(1, 2), false)
  assert.equal(r.atPlantLimit(50, 9999), false)
  assert.equal(r.atPlantLimit(null, 2), false)
})
