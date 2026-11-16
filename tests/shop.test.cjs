// Só da web: Equipamentos e insumos (UX 26b–26d, contrato shop de 15 nov).
const { test } = require('node:test')
const assert = require('node:assert/strict')
const s = require('../src/lib/shop.ts')

const product = (id, label = 'partner') => ({
  id, category: { key: 'ventilation', name: 'Ventilação' }, name: `Produto ${id}`, specs: ['150 mm'], store: { name: 'Loja', domain: 'loja.com.br' },
  url: `https://loja.com.br/p/${id}`, label, label_text: label === 'partner' ? 'Publicidade · podemos receber comissão' : label === 'sponsored' ? 'Patrocinado' : 'Sem comissão',
  reason: null, price_from: null, price_checked_at: null,
})
const on = { enabled: true, page: true, environment_block: true, phase_block: false, account_entry: true }

test('switches: the general one off hides everything; no answer hides too', () => {
  assert.equal(s.shopShows(on, 'page'), true)
  assert.equal(s.shopShows(on, 'phase_block'), false)
  assert.equal(s.shopShows({ ...on, enabled: false }, 'page'), false)
  assert.equal(s.shopShows(null, 'page'), false)
  assert.equal(s.shopShows(undefined, 'account_entry'), false)
})

test('labels: server text on the card, short one in the context rows', () => {
  assert.equal(s.labelTone('partner'), 'light')
  assert.equal(s.labelTone('sponsored'), 'light')
  assert.equal(s.labelTone('none'), 'plain')
  assert.equal(s.shortLabel(product('a')), 'Link de parceiro')
  assert.equal(s.shortLabel(product('b', 'none')), 'Sem comissão')
  assert.equal(s.shortLabel(product('c', 'sponsored')), 'Patrocinado')
})

test('page blocks: one per grow by name, one per plant phase with the neutral title', () => {
  const recs = [
    { trigger: 'grow_missing_exhaust', reason: 'Sala não tem exaustor cadastrado.', grow_id: 'g1', plant_id: null, product: product('a') },
    { trigger: 'grow_manual_readings_only', reason: 'Leituras só manuais.', grow_id: 'g1', plant_id: null, product: product('b', 'none') },
    { trigger: 'plant_phase_veg', reason: 'A sua planta está em vega.', grow_id: null, plant_id: 'p1', product: product('c') },
    { trigger: 'plant_phase_veg', reason: 'A sua planta está em vega.', grow_id: null, plant_id: 'p2', product: product('c') },
    { trigger: 'grow_missing_light', reason: 'Sem luz.', grow_id: 'g2', plant_id: null, product: product('d') },
  ]
  const blocks = s.pageBlocks(recs, id => (id === 'g1' ? 'a Sala' : null))
  assert.deepEqual(blocks.map(b => b.title), ['PARA A SALA', 'PARA A SUA PLANTA EM VEGA', 'PARA O SEU AMBIENTE'])
  assert.equal(blocks[0].items.length, 2)
  // duas plantas na mesma fase: um cartão, e o "Já uso" vale para as duas
  assert.equal(blocks[1].items.length, 1)
  assert.deepEqual(blocks[1].items[0].targets, [{ plant_id: 'p1' }, { plant_id: 'p2' }])
  assert.deepEqual(blocks[0].items[0].targets, [{ grow_id: 'g1' }])
})

test('context items and the plant block title', () => {
  const recs = [
    { trigger: 'plant_phase_flower', reason: 'A sua planta está em floração.', grow_id: null, plant_id: 'p1', product: product('a') },
    { trigger: 'plant_phase_flower', reason: 'A sua planta está em floração.', grow_id: null, plant_id: 'p1', product: product('a') },
  ]
  assert.equal(s.contextItems(recs).length, 1)
  assert.equal(s.phaseBlockTitle('plant_phase_flower'), 'PARA A FLORAÇÃO')
  assert.equal(s.phaseBlockTitle('plant_phase_veg'), 'PARA A VEGA')
  assert.equal(s.haveLabel('plant_phase_veg'), 'Já uso')
  assert.equal(s.haveLabel('grow_missing_exhaust'), 'Já tenho')
})

test('nothing in the texts mentions cannabis or a price', () => {
  for (const t of [s.SHOP_NOTICE, s.SHOP_TITLE]) assert.doesNotMatch(t, /maconha|cannabis|420|R\$/i)
})
