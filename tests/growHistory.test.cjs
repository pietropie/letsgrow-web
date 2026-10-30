// Copiado de letsgrow-mobile/tests/growHistory.test.cjs por scripts/sync-shared.mjs.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const h = require('../src/shared/lib/growHistory.ts')

const at = (y, mo, d, hh, mi) => new Date(y, mo - 1, d, hh, mi).toISOString()
const reading = (over) => ({ id: 'r', grow_id: 'g', observed_at: at(2026, 10, 19, 12, 17), temperature_c: null, humidity_rh: null, notes: null, kind: 'manual', created_at: '', updated_at: '', ...over })

test('the item type comes from kind, not from the note text', () => {
  assert.equal(h.historyType(reading({ temperature_c: 24 })), 'reading')
  assert.equal(h.historyType(reading({ notes: 'Troquei o filtro' })), 'note')
  assert.equal(h.historyType(reading({ kind: 'exhaust_power', notes: 'Potência do exaustor ajustada para 65%' })), 'power')
  // A manual note that happens to start like the automatic one stays a note.
  assert.equal(h.historyType(reading({ notes: 'Potência do exaustor ajustada para 65%' })), 'note')
  assert.equal(h.historyType(reading({ kind: undefined, humidity_rh: 55 })), 'reading')
})

test('titles, details and tags follow the Figma HistoryItem', () => {
  const r = reading({ temperature_c: 24, humidity_rh: 55, notes: 'TESTE QA registro manual' })
  assert.equal(h.historyTitle(r), '24 °C · 55 %')
  assert.equal(h.historyDetail(r), 'TESTE QA registro manual')
  assert.equal(h.historyTitle(reading({ humidity_rh: 58.5 })), '58,5 %')
  assert.equal(h.historyTitle(reading({ notes: 'Nota livre' })), 'Nota')
  assert.equal(h.historyTitle(reading({ kind: 'exhaust_power', notes: 'Potência do exaustor ajustada para 65%' })), 'Exaustor ajustado para 65%')
  assert.equal(h.historyTitle(reading({ kind: 'exhaust_power', notes: 'Potência do exaustor registrada como 50%' })), 'Exaustor registrado em 50%')
  assert.equal(h.historyDetail(reading({ kind: 'exhaust_power', notes: 'Potência do exaustor ajustada para 65%' })), null)
  assert.equal(h.HISTORY_TAG.power.label, 'AJUSTE DE POTÊNCIA')
  assert.equal(h.historyTime(r), '12:17')
  assert.equal(h.historyA11yLabel(r), 'Leitura, 19 out às 12:17, 24 °C · 55 %, TESTE QA registro manual')
})

test('the list is grouped by local day, newest first, with HOJE and ONTEM', () => {
  const now = new Date(2026, 9, 19, 18, 0)
  const items = [at(2026, 10, 19, 12, 40), at(2026, 10, 19, 12, 17), at(2026, 10, 18, 21, 5), at(2026, 10, 16, 9, 40), at(2025, 12, 31, 8, 0)].map((observed_at, i) => reading({ id: String(i), observed_at }))
  const groups = h.groupByDay(items, now)
  assert.deepEqual(groups.map(g => g.label), ['HOJE · 19 OUT', 'ONTEM · 18 OUT', '16 OUT', '31 DEZ 2025'])
  assert.deepEqual(groups.map(g => g.items.length), [2, 1, 1, 1])
})

test('"Carregar mais" asks for the next offset until total', () => {
  assert.equal(h.nextHistoryOffset(50, 120), 50)
  assert.equal(h.nextHistoryOffset(120, 120), undefined)
  assert.equal(h.nextHistoryOffset(0, 0), undefined)
})

test('confirmation texts for deleting, archiving and restoring', () => {
  assert.equal(h.deleteReadingMessage(reading({ temperature_c: 24, humidity_rh: 55 })), 'A leitura de 24 °C e 55 % de 19 out, 12:17 sai do histórico e deixa de contar como medição atual do ambiente. Não dá para desfazer.')
  assert.equal(h.deleteReadingMessage(reading({ notes: 'x' })), 'A nota de 19 out, 12:17 sai do histórico. Não dá para desfazer.')
  assert.match(h.archiveGrowMessage(2, false), /^As 2 plantas deste ambiente também serão arquivadas/)
  assert.match(h.archiveGrowMessage(1, false), /^A planta deste ambiente também será arquivada/)
  assert.match(h.archiveGrowMessage(0, false), /^Ele sai do acompanhamento atual/)
  assert.match(h.archiveGrowMessage(1, true), /^Este é seu único ambiente ativo. Ele e a planta dele saem/)
  assert.match(h.RESTORE_GROW_MESSAGE, /plantas arquivadas junto com ele também voltam/)
  assert.equal(h.restoredMessage(2), 'Ambiente restaurado. 2 plantas voltaram para o acompanhamento.')
  assert.equal(h.restoredMessage(0), 'Ambiente restaurado.')
})

test('archived caption uses archived_at, or the start date for older archives', () => {
  assert.equal(h.archivedCaption({ archived_at: at(2026, 10, 19, 15, 0), start_date: '2026-10-02' }), 'Arquivado em 19 out')
  assert.equal(h.archivedCaption({ archived_at: null, start_date: '2026-10-02' }), 'Arquivado · iniciado em 2 out 2026')
})
