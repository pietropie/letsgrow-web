// Só da web (não vem do mobile): mostrador de créditos e uso do Bobby, UX item 16 (estados U1–U9, C1–C5).
const { test } = require('node:test')
const assert = require('node:assert/strict')
const u = require('../src/lib/usage.ts')
const { USAGE_FIXTURES: F } = require('../src/lib/usage-fixtures.ts')

test('dates read only the calendar part', () => {
  assert.equal(u.usageDay('2026-11-01'), '1 nov')
  assert.equal(u.usageDay('2026-12-01T03:00:00Z'), '1 dez')
  assert.equal(u.usageMonth('2026-10-01'), 'outubro')
  assert.equal(u.usageDay(null), null)
})

test('U1 normal: remaining in the centre, used, total and renewal beside it', () => {
  const v = u.meterView(F.U1.usage)
  assert.equal(v.title, 'BOBBY · CONSULTAS DE OUTUBRO')
  assert.equal(v.tag, null)
  assert.equal(v.center, 18)
  assert.equal(v.centerCaption, 'RESTAM')
  assert.deepEqual(v.stats, [{ label: 'USADAS', value: '12' }, { label: 'TOTAL NO MÊS', value: '30' }, { label: 'RENOVA', value: '1 nov' }])
  assert.equal(v.arc.used, 0.4)
  assert.deepEqual(v.link, { label: 'Ver histórico de uso', to: 'history' })
})

test('U2 near the end and U3 exhausted', () => {
  const near = u.meterView(F.U2.usage)
  assert.equal(near.tag.label, 'PERTO DO FIM')
  assert.equal(near.note, 'Restam 3 consultas até 1 nov. Depois, o Bobby pausa até a renovação.')
  assert.equal(near.link.to, 'plans')
  const out = u.meterView(F.U3.usage)
  assert.equal(out.tag.label, 'ESGOTADO')
  assert.equal(out.center, 0)
  assert.deepEqual(out.arc, { used: 1, tone: 'error' })
  assert.equal(out.stats[2].label, 'VOLTA EM')
  assert.equal(out.note, 'Você usou as 30 consultas de outubro. O Bobby volta em 1 nov.')
  assert.equal(out.primary, 'plans')
})

test('U4 unlimited: used only, no arc; the compact is hidden', () => {
  const v = u.meterView(F.U4.usage)
  assert.equal(v.arc, null)
  assert.equal(v.center, 12)
  assert.equal(v.centerCaption, 'USADAS EM OUTUBRO')
  assert.equal(u.compactView(F.U4.usage), null)
  assert.equal(u.usageNotice(F.U4.usage), null)
})

test('U5–U8 credits', () => {
  const v = u.meterView(F.U5.usage)
  assert.equal(v.center, 120)
  assert.deepEqual(v.stats.map(s => s.value), ['80 de 100', '40', '20', '1 nov'])
  // The arc is the month's fraction, as the backend computes near_limit: used / (used + remaining).
  assert.equal(v.arc.used, 20 / 140)
  assert.equal(u.meterView({ ...F.U5.usage, credits: { ...F.U5.usage.credits, used_in_period: 0, remaining: 0 } }).arc.used, 1)
  const near = u.meterView(F.U6.usage, true)
  assert.equal(near.secondary, 'packs')
  const out = u.meterView(F.U7.usage, true)
  assert.equal(out.note, 'Seu saldo acabou. O plano volta com 100 créditos em 1 nov.')
  assert.deepEqual([out.primary, out.secondary], ['packs', 'plans'])
  assert.deepEqual([u.meterView(F.U7.usage, false).primary, u.meterView(F.U7.usage, false).secondary], ['plans', null])
  const extras = u.meterView(F.U8.usage)
  assert.equal(extras.arc, null)
  assert.equal(extras.note, 'Créditos comprados à parte. 25 vencem em 12 dez.')
  const broke = u.meterView({ ...F.U8.usage, credits: { ...F.U8.usage.credits, remaining: 0, extra_balance: 0, next_expiry: null }, near_limit: true, exhausted: true }, false)
  assert.deepEqual([broke.tag.label, broke.note, broke.primary], ['ESGOTADO', 'Seu saldo acabou.', 'plans'])
})

test('U9 both: the queries arc plus the credits line', () => {
  const v = u.meterView(F.U9.usage)
  assert.equal(v.center, 18)
  assert.deepEqual(v.stats.at(-1), { label: 'CRÉDITOS', value: '120 disponíveis' })
  assert.match(v.note, /também contam no limite/)
})

test('compact C1–C5 and the Início notice', () => {
  assert.equal(u.compactView(F.U1.usage).text, '12 de 30 consultas · renova 1 nov')
  assert.deepEqual([u.compactView(F.U2.usage).text, u.compactView(F.U2.usage).tone], ['27 de 30 usadas · restam 3', 'alert'])
  assert.deepEqual([u.compactView(F.U3.usage).text, u.compactView(F.U3.usage).tone], ['30 de 30 usadas · volta em 1 nov', 'error'])
  assert.equal(u.compactView(F.U5.usage).text, '120 créditos · plano renova 1 nov')
  assert.equal(u.compactView(F.U8.usage).bar, null)
  assert.equal(u.compactView(F.U9.usage).text, '12 de 30 consultas · 120 créditos')
  assert.equal(u.usageNotice(F.U1.usage), null)
  assert.deepEqual(u.usageNotice(F.U2.usage), { title: 'Bobby perto do limite', meta: '27 de 30 usadas · restam 3' })
  assert.equal(u.usageNotice(F.U7.usage).title, 'Créditos do Bobby acabaram')
})

test('unlimited without a counter (live API, Grower Pro): no number is made up', () => {
  const live = { mode: 'unlimited', period: { start: '2026-11-01T00:00:00Z', renews_at: '2026-12-01T00:00:00Z' }, queries: null, credits: null, near_limit: false, exhausted: false, warning_threshold: 0.8 }
  const v = u.meterView(live)
  assert.equal(v.center, null)
  assert.equal(v.title, 'BOBBY · CONSULTAS DE NOVEMBRO')
  assert.equal(v.tag.label, 'SEM LIMITE')
  assert.equal(u.compactView(live), null)
  assert.equal(u.usageNotice(live), null)
})
