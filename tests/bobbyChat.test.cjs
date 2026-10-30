// Copiado de letsgrow-mobile/tests/bobbyChat.test.cjs por scripts/sync-shared.mjs.
// Bobby chat (UX item 10) and the composer footer by billing mode (item 9, U1).
process.env.TZ = 'America/Sao_Paulo'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { greeting, composerFooter, starterSuggestions, groupConversations, quoteCard } = require('../src/shared/lib/bobbyChat.ts')
const { parseMarkdown, parseInline } = require('../src/shared/lib/markdown.ts')

const now = new Date(2026, 9, 22, 15, 0)

test('greeting by hour, first name only', () => {
  assert.equal(greeting('Pietro Bargieri', 9), 'Bom dia, Pietro')
  assert.equal(greeting('Pietro', 15), 'Boa tarde, Pietro')
  assert.equal(greeting('Pietro', 22), 'Boa noite, Pietro')
  assert.equal(greeting('Pietro', 3), 'Boa noite, Pietro')
  assert.equal(greeting(null, 15), 'Boa tarde')
})

test('composer footer follows the billing mode (U1)', () => {
  assert.deepEqual(composerFooter({ enabled: true, replaces_query_limit: true }, { used: 3, limit: 30 }).text, 'Nada é cobrado antes de você confirmar.')
  // B1 draws the credits footer without a link.
  assert.equal(composerFooter({ enabled: true, replaces_query_limit: true }, null).link, null)
  assert.equal(composerFooter({ enabled: true, replaces_query_limit: false }, { used: 3, limit: 30 }).text, 'Nada é cobrado antes de você confirmar. Cada mensagem também conta no limite mensal do plano.')
  const free = composerFooter({ enabled: false, replaces_query_limit: false }, { used: 12, limit: 30, renewsAt: '2026-11-01T03:00:00Z' }, now)
  assert.deepEqual([free.text, free.link, free.limitReached], ['12 de 30 consultas usadas este mês · renova em 1 nov', 'limit', false])
  assert.equal(composerFooter({ enabled: false, replaces_query_limit: false }, { used: 12, limit: 30 }, now).text, '12 de 30 consultas usadas este mês')
  const full = composerFooter({ enabled: false, replaces_query_limit: false }, { used: 30, limit: 30, renewsAt: '2026-11-01' }, now)
  assert.deepEqual([full.text, full.limitReached, full.month, full.renews, full.link], ['Você usou as 30 consultas deste mês · renova em 1 nov.', true, 'outubro', '1 nov', null])
  const none = composerFooter({ enabled: false, replaces_query_limit: false }, { used: 5, limit: null }, now)
  assert.deepEqual([none.text, none.link], ['Seu plano não tem limite mensal de consultas.', null])
})

test('starter suggestions come only from alerts and context, at most 4', () => {
  const plants = [{ id: 'a', name: 'Aurora', growName: 'Sala', lastWateringAt: '2026-10-20T12:00:00Z' }, { id: 'b', name: 'Blueberry', growName: 'Grow Fundo', lastWateringAt: '2026-10-21T12:00:00Z' }]
  const alerts = [{ alert_id: '1', plant_id: 'a', plant_name: 'Aurora', message: 'Umidade alta.' }]
  const s = starterSuggestions({ alerts, plants, lastRecordAt: '2026-10-21T12:00:00Z', now })
  assert.deepEqual(s.map(x => x.key), ['alert-1', 'water-a', 'week', 'photo'])
  assert.equal(s[0].subtitle, 'Alerta de hoje · Sala')
  assert.equal(s[1].title, 'Quando regar a Aurora de novo?')
  assert.equal(s[1].subtitle, 'Última rega há 2 dias')
  assert.ok(s[3].photo)
  // Nothing registered: no suggestions at all (no fixed intro questions).
  assert.deepEqual(starterSuggestions({ alerts: [], plants: [], now }), [])
  // No record in the last week: no "what changed" card.
  assert.deepEqual(starterSuggestions({ alerts: [], plants: [{ id: 'a', name: 'Aurora' }], lastRecordAt: '2026-10-01T12:00:00Z', now }).map(x => x.key), ['photo'])
  // Never more than 4.
  const many = starterSuggestions({ alerts: [1, 2, 3].map(i => ({ alert_id: String(i), plant_id: 'a', plant_name: 'Aurora', message: 'x' })), plants, lastRecordAt: '2026-10-22T10:00:00Z', now })
  assert.equal(many.length, 4)
})

test('drawer groups conversations by day', () => {
  const g = groupConversations([
    { id: '1', updated_at: '2026-10-22T13:00:00Z' }, { id: '2', updated_at: '2026-10-21T12:00:00Z' },
    { id: '3', updated_at: '2026-10-18T12:00:00Z' }, { id: '4', updated_at: '2026-09-01T12:00:00Z' }, { id: '5', updated_at: '2026-10-22T15:30:00Z' },
  ], now)
  assert.deepEqual(g.map(x => [x.label, x.items.map(i => i.id)]), [['HOJE', ['5', '1']], ['ONTEM', ['2']], ['ÚLTIMOS 7 DIAS', ['3']], ['ANTERIORES', ['4']]])
})

test('credit quote card text (B10)', () => {
  assert.deepEqual(quoteCard({ cost: 2, available: 18, after: 16, scope: { plant_name: 'Aurora' } }, 2),
    { title: 'Esta análise usa 2 créditos', body: 'Inclui as 2 fotos e os registros da Aurora.', balance: 'Saldo: 18 → 16 créditos.' })
  assert.equal(quoteCard({ cost: 1, available: 5, after: 4, scope: null }, 0).title, 'Esta mensagem usa 1 crédito')
})

test('restricted markdown: bold, lists, titles and tables, no links or images', () => {
  const blocks = parseMarkdown('Pelos seus registros, **o mais provável é pH alto**, e não falta.\n\n- A nutrição tinha 800 PPM\n- As regas tiveram **pH 6,8**\n\n## Próxima rega\n1. Medir\n2. Registrar\n\n| Dia | pH |\n|---|---|\n| 19 | 6,8 |\n\nVeja [o guia](https://x.y) ![img](a.png)')
  assert.deepEqual(blocks.map(b => b.kind), ['paragraph', 'bullets', 'heading', 'numbered', 'table', 'paragraph'])
  assert.deepEqual(blocks[0].inline, [{ text: 'Pelos seus registros, ' }, { text: 'o mais provável é pH alto', bold: true }, { text: ', e não falta.' }])
  assert.equal(blocks[1].items.length, 2)
  assert.deepEqual(blocks[4].rows, [['Dia', 'pH'], ['19', '6,8']])
  assert.deepEqual(blocks[5].inline, [{ text: 'Veja o guia ' }])
  assert.deepEqual(parseInline('a *b* c'), [{ text: 'a ' }, { text: 'b', italic: true }, { text: ' c' }])
  // Lines of one paragraph join with a space.
  assert.deepEqual(parseMarkdown('linha um\nlinha dois').map(b => b.inline.map(i => i.text).join('')), ['linha um linha dois'])
})
