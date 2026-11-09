// Só da web (não vem do mobile): Planos v2, UX item 19b (W28, W29; S6 e S6c). A regra é do backend; aqui só o texto.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const r = require('../src/lib/recommendation.ts')
const { RECOMMENDATION_FIXTURES: F } = require('../src/lib/recommendation-fixtures.ts')

const exhausted = { queries: { used: 1, total: 1 }, exhausted: true, near_limit: true }
const unused = { queries: { used: 0, total: 1 }, exhausted: false, near_limit: false }

test('W28/S6: limits reached, dark card "RECOMENDADO PARA VOCÊ" citing both limits', () => {
  const v = r.recommendationView(F.R1, exhausted, 'Free', 'Jardineiro')
  assert.deepEqual(v.usage.rows.map(x => [x.label, x.value, x.fill, x.tag && x.tag.label]), [
    ['Plantas', '1 de 1', 1, 'NO LIMITE'], ['Bobby neste mês', '1 de 1', 1, 'ESGOTADO'], ['Ambientes', '1 de 1', 1, null]])
  assert.equal(v.usage.conclusion, 'Você chegou ao limite de plantas e do Bobby no Free.')
  assert.equal(v.usage.tone, 'alert')
  assert.equal(v.highlight.tag, 'RECOMENDADO PARA VOCÊ')
  assert.equal(v.highlight.dark, true)
  assert.equal(v.highlight.reason, 'Cobre os dois limites que você atingiu: plantas e Bobby.')
  assert.deepEqual(v.highlight.changes, [
    { label: 'Plantas ao mesmo tempo', from: '1', to: '2', same: false },
    { label: 'Conversas com o Bobby', from: '1', to: '4 por mês', same: false },
    { label: 'Ambientes', from: null, to: '1 (igual)', same: true }])
  assert.deepEqual(v.highlight.benefits, ['Cultive duas genéticas no mesmo ciclo e compare', 'Tire dúvidas com o Bobby toda semana, da rega à colheita', 'Tudo do Free continua: diário, fotos, timer da luz e clima'])
})

test('S6c: no reason, light card "PRÓXIMO PASSO" and "O Free ainda cobre o seu uso"', () => {
  const v = r.recommendationView(F.R2, unused, 'Free', 'Jardineiro')
  assert.equal(v.usage.tone, 'calm')
  assert.equal(v.usage.conclusion, 'O Free ainda cobre o seu uso. Quando quiser mais espaço, o próximo passo é o Jardineiro.')
  assert.deepEqual(v.usage.rows.map(x => x.tag), [null, null, null])
  assert.equal(v.highlight.tag, 'PRÓXIMO PASSO')
  assert.equal(v.highlight.dark, false)
  assert.equal(v.highlight.reason, 'Para quando você quiser cuidar de mais de uma planta ou conversar mais com o Bobby.')
})

test('one limit, near limit only and no plan above', () => {
  const one = r.recommendationView({ ...F.R1, reasons: ['plants_limit'], covers: ['plants_limit'] }, unused, 'Free', 'Jardineiro')
  assert.equal(one.highlight.reason, 'Cobre o limite que você atingiu: plantas.')
  const near = r.recommendationView({ ...F.R1, reasons: ['queries_near_limit'], covers: ['queries_near_limit'] }, { queries: { used: 4, total: 5 }, exhausted: false, near_limit: true }, 'Free', 'Jardineiro')
  assert.deepEqual([near.highlight.tag, near.highlight.reason, near.usage.rows[1].tag.label], ['RECOMENDADO PARA VOCÊ', 'Para o Bobby não parar antes do fim do mês.', 'PERTO DO FIM'])
  const top = r.recommendationView(F.R3, { queries: { used: 3, total: 4 }, exhausted: false, near_limit: true }, 'Jardineiro', null)
  assert.equal(top.highlight, null)
  assert.equal(top.usage.conclusion, 'O Bobby está perto do limite deste mês.')
})

test('unlimited targets and the Bobby row only with a monthly total', () => {
  const v = r.recommendationView({ ...F.R1, changes: [{ key: 'plants', from: 2, to: null }, { key: 'queries', from: 4, to: null }] }, { queries: { used: 12, total: null }, exhausted: false, near_limit: false }, 'Jardineiro', 'Grower Pro')
  assert.deepEqual(v.highlight.changes.map(c => c.to), ['Sem limite', 'Sem limite'])
  assert.equal(v.highlight.benefits[0], 'Cultive quantas genéticas quiser e compare')
  assert.equal(v.highlight.benefits.at(-1), 'Tudo do Jardineiro continua')
  assert.deepEqual(v.usage.rows.map(x => x.key), ['plants', 'grows'])
})

test('"Menos de R$ 1 por dia" only when price / 30 < 1', () => {
  assert.equal(r.underOneRealADay(24.9), true)
  assert.equal(r.underOneRealADay(30), false)
  assert.equal(r.underOneRealADay(44.9), false)
  assert.equal(r.underOneRealADay(null), false)
})

test('the reason text uses covers, not reasons; booleans and extra keys stay out of "O que muda"', () => {
  const partial = r.recommendationView({ ...F.R1, reasons: ['plants_limit', 'grows_limit'], covers: ['plants_limit'] }, unused, 'Free', 'Jardineiro')
  assert.equal(partial.usage.conclusion, 'Você chegou ao limite de plantas e de ambientes no Free.')
  assert.equal(partial.highlight.tag, 'RECOMENDADO PARA VOCÊ')
  assert.equal(partial.highlight.reason, 'Cobre o limite que você atingiu: plantas.')
  assert.deepEqual(partial.highlight.changes.map(c => c.label), ['Plantas ao mesmo tempo', 'Conversas com o Bobby', 'Ambientes'])
  const sensors = r.recommendationView({ ...F.R1, changes: [...F.R1.changes.filter(c => c.key !== 'sensors'), { key: 'sensors', from: false, to: true }] }, exhausted, 'Free', 'Cultivador')
  assert.ok(sensors.highlight.benefits.includes('Conecte sensores ao ambiente'))
})

test('top plan from the live API: totals of 9999 read as "sem limite", no highlight', () => {
  const live = { current_plan: 'grower_pro', plan_key: null, reasons: [], covers: [], usage: { plants: { used: 1, total: 9999 }, grows: { used: 1, total: 9999 } }, changes: [] }
  const v = r.recommendationView(live, { mode: 'unlimited', queries: null, exhausted: false, near_limit: false }, 'Grower Pro', null)
  assert.deepEqual(v.usage.rows.map(x => [x.label, x.value, x.fill]), [['Plantas', '1 · sem limite', 0], ['Bobby neste mês', 'Sem limite', 0], ['Ambientes', '1 · sem limite', 0]])
  assert.equal(v.usage.conclusion, 'O Grower Pro não tem limite de plantas, ambientes nem do Bobby.')
  assert.equal(v.highlight, null)
  const paid = r.recommendationView({ ...live, current_plan: 'jardineiro', usage: { plants: { used: 1, total: 2 }, grows: { used: 1, total: 1 } } }, { mode: 'queries', queries: { used: 1, total: 4 }, exhausted: false, near_limit: false }, 'Jardineiro', null)
  assert.equal(paid.usage.conclusion, 'O Jardineiro cobre o seu uso. Não há plano acima à venda.')
})
