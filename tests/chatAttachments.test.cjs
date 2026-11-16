// Só da web: anexos do chat do Bobby (30 dias e "Guardar no calendário"), contrato de 15 nov.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const a = require('../src/lib/chat-attachments.ts')

const base = { key: 'u/nova.jpg', kind: 'image', available: true, url: 'https://x/nova.jpg', expires_at: '2026-12-13T14:00:00+00:00', can_save: true, saved_event_id: null }

test('until label in Brasília time', () => {
  assert.equal(a.untilLabel('2026-12-13T14:00:00+00:00'), 'Disponível até 13/12')
  // 02:00 UTC ainda é o dia anterior em Brasília
  assert.equal(a.untilLabel('2026-12-14T02:00:00Z'), 'Disponível até 13/12')
  assert.equal(a.untilLabel(null), null)
  assert.equal(a.untilLabel('nope'), null)
})

test('no attachments field: null, the old photo_keys path stays', () => {
  assert.equal(a.attachmentViews(undefined), null)
})

test('image that can be saved', () => {
  const [v] = a.attachmentViews([base])
  assert.deepEqual(v, { key: 'u/nova.jpg', kind: 'image', url: 'https://x/nova.jpg', until: 'Disponível até 13/12', save: { kind: 'can' } })
})

test('pdf never offers the calendar', () => {
  const [v] = a.attachmentViews([{ ...base, key: 'u/r.pdf', kind: 'pdf', can_save: false }])
  assert.equal(v.kind, 'pdf')
  assert.deepEqual(v.save, { kind: 'none' })
})

test('expired: no url, no date, no button', () => {
  const [v] = a.attachmentViews([{ ...base, available: false, url: null, can_save: false }])
  assert.deepEqual(v, { key: 'u/nova.jpg', kind: 'expired', url: null, until: null, save: { kind: 'none' } })
})

test('saved: plant from the field, from this visit, or unknown', () => {
  const saved = { ...base, can_save: false, saved_event_id: 'e1' }
  assert.deepEqual(a.attachmentViews([saved])[0].save, { kind: 'saved', eventId: 'e1', plantId: null })
  assert.deepEqual(a.attachmentViews([saved], { e1: 'p1' })[0].save, { kind: 'saved', eventId: 'e1', plantId: 'p1' })
  assert.deepEqual(a.attachmentViews([{ ...saved, saved_plant_id: 'p2' }], { e1: 'p1' })[0].save, { kind: 'saved', eventId: 'e1', plantId: 'p2' })
})

test('markSaved only touches that key', () => {
  const other = { ...base, key: 'u/b.jpg' }
  const out = a.markSaved([base, other], 'u/nova.jpg', 'e9', 'p9')
  assert.equal(out[0].saved_event_id, 'e9')
  assert.equal(out[0].can_save, false)
  assert.equal(out[1].saved_event_id, null)
})

test('save errors: server text first, then by status', () => {
  assert.equal(a.saveErrorMessage(410, 'Texto do servidor'), 'Texto do servidor')
  assert.equal(a.saveErrorMessage(410, null), 'Este anexo expirou e não pode mais ser guardado.')
  assert.equal(a.saveErrorMessage(422, null), 'Só fotos podem ir para o calendário.')
  assert.equal(a.saveErrorMessage(500, null), 'Não foi possível guardar a foto. Tente de novo.')
})
