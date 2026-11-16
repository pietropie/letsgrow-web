// Só da web: cabeçalhos que o BFF manda à API (IP do navegador e chave do BFF), proteção da API fase 1.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const b = require('../src/lib/server/bff-headers.ts')

const h = obj => ({ get: n => obj[n.toLowerCase()] ?? null })

test('no secret: no header at all', () => {
  assert.deepEqual(b.bffHeaders(h({ 'x-forwarded-for': '1.2.3.4' }), undefined), {})
  assert.deepEqual(b.bffHeaders(h({ 'x-forwarded-for': '1.2.3.4' }), ''), {})
})

test('with secret: key and the client IP', () => {
  assert.deepEqual(b.bffHeaders(h({ 'x-forwarded-for': '1.2.3.4' }), 's3'), { 'X-LetsGrow-BFF-Key': 's3', 'X-LetsGrow-Client-IP': '1.2.3.4' })
})

test('a list in x-forwarded-for: the last one', () => {
  assert.equal(b.clientIp(h({ 'x-forwarded-for': '9.9.9.9, 1.2.3.4' })), '1.2.3.4')
  assert.equal(b.clientIp(h({ 'x-forwarded-for': '2001:db8::1' })), '2001:db8::1')
})

test('no forwarded header: x-real-ip, or only the key', () => {
  assert.equal(b.clientIp(h({ 'x-real-ip': '5.6.7.8' })), '5.6.7.8')
  assert.deepEqual(b.bffHeaders(h({}), 's3'), { 'X-LetsGrow-BFF-Key': 's3' })
  assert.deepEqual(b.bffHeaders(null, 's3'), { 'X-LetsGrow-BFF-Key': 's3' })
})
