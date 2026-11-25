// Só da web: relés do Hub (Figma 28 · SN5–SN10, W12p), regras puras. Contrato: API-SENSORES-RELES.md §4.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const r = require('../src/lib/relays.ts')

const relay = o => ({ n: 1, equip_kind: 'light', equip_key: 'light', mode: 'schedule', effective_mode: 'schedule', state: 1, override: false, source: 'schedule', ts: '2026-11-25T12:30:00', confirmed: true, schedule_lit: true, next_change_at: '2026-11-25T22:00:00', ...o })

test('equipment options come from the GET list, seen from one Hub', () => {
  const opts = r.equipmentOptions([
    { kind: 'light', key: 'light', name: 'Quantum 720 W', n: 1, hub_id: 'h1' },
    { kind: 'fan', key: 'fan:3f2a', name: 'Ventiladores 25 W (2)', n: 2, hub_id: 'h2' },
    { kind: 'exhaust', key: 'exhaust', name: '', n: null, hub_id: null },
  ], 'h1')
  assert.deepEqual(opts.map(o => [o.key, o.title, o.at, o.otherHub]), [['light', 'Quantum 720 W', 1, false], ['fan:3f2a', 'Ventiladores 25 W (2)', null, true], ['exhaust', 'Exaustão', null, false]])
  assert.deepEqual(r.equipmentOptions(undefined, 'h1'), [])
})

test('state line: until the next edge, since the change, last state offline, waiting for the Hub', () => {
  assert.equal(r.stateLine(relay(), { online: true }), 'Ligada · até 22:00')
  assert.equal(r.stateLine(relay({ override: true }), { online: true }), 'Ligada · desde 12:30')
  assert.equal(r.stateLine(relay({ effective_mode: 'manual' }), { online: true }), 'Ligada · desde 12:30')
  assert.equal(r.stateLine(relay({ equip_kind: 'fan', state: 0, mode: 'manual', effective_mode: 'manual', ts: '2026-11-25T11:02:00' }), { online: true, plural: true }), 'Desligados · desde 11:02')
  assert.equal(r.stateLine(relay({ equip_kind: 'exhaust' }), { online: false }), 'Último estado: ligado · 12:30')
  assert.equal(r.stateLine(relay({ confirmed: false, state: 0, source: 'rebind' }), { online: true }), 'Aguardando o Hub')
})

test('only turning the light off while schedule_lit asks first', () => {
  assert.equal(r.needsLightConfirm(relay(), 0), true)
  assert.equal(r.needsLightConfirm(relay({ schedule_lit: false }), 0), false)
  assert.equal(r.needsLightConfirm(relay(), 1), false)
  assert.equal(r.needsLightConfirm(relay({ equip_kind: 'exhaust' }), 0), false)
})

test('command outcome: pending until 10 s, then timeout', () => {
  assert.equal(r.commandOutcome(null, 0, 5000), 'pending')
  assert.equal(r.commandOutcome(null, 0, 10_001), 'timeout')
  assert.equal(r.commandOutcome({ req_id: 'x', status: 'pending' }, 0, 10_001), 'timeout')
  assert.equal(r.commandOutcome({ req_id: 'x', status: 'confirmed' }, 0, 20_000), 'confirmed')
  assert.equal(r.commandOutcome({ req_id: 'x', status: 'failed' }, 0, 1000), 'failed')
})

test('positions in use and texts', () => {
  assert.equal(r.inUse([relay(), relay({ n: 2, equip_kind: null, equip_key: null })]), 1)
  assert.equal(r.relayErrorText(409, 'hub_offline'), 'O Hub está offline. A chave volta quando ele se conectar.')
  assert.equal(r.relayErrorText(409, 'relay_free'), 'Esta posição não tem equipamento.')
  assert.equal(r.relaySaveErrorText('photoperiod_required'), 'Cadastre a programação de luz do ambiente para a luz seguir a programação.')
  assert.equal(r.relaySaveErrorText(undefined), 'Não foi possível salvar a posição. Tente de novo.')
  assert.equal(r.warningText('missing_watts'), 'Potência não informada.')
  assert.equal(r.warningText('nope'), null)
})
