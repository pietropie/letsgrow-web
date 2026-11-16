// Só da web: erros das telas de entrada (UX item 25), com os textos reais do backend (auth.py).
const { test } = require('node:test')
const assert = require('node:assert/strict')
const e = require('../src/lib/entry.ts')

const http = (status, detail) => ({ response: { status, data: { detail } } })

test('login: wrong credentials mark both fields', () => {
  const r = e.loginError(http(401, 'Credenciais inválidas'))
  assert.equal(r.title, 'E-mail ou senha incorretos')
  assert.deepEqual(r.fields, ['email', 'password'])
})

test('login: inactive, rate limit, offline and unknown', () => {
  assert.equal(e.loginError(http(403, 'Conta inativa')).title, 'Conta inativa')
  assert.equal(e.loginError(http(429, 'x')).title, 'Muitas tentativas')
  assert.equal(e.loginError(new Error('Sem conexão com o servidor. Confira sua internet e tente de novo.')).title, 'Sem conexão')
  assert.deepEqual(e.loginError(http(500, 'Erro interno')), { title: 'Não foi possível entrar', body: 'Erro interno', fields: [] })
})

test('register: e-mail in use marks the e-mail; 422 keeps the server message', () => {
  const r = e.registerError(http(409, 'Email ou username já em uso'))
  assert.equal(r.title, 'E-mail já cadastrado')
  assert.deepEqual(r.fields, ['email'])
  assert.equal(e.registerError(http(422, [{ msg: 'Value error, idade' }])).body, 'Value error, idade')
})

test('code: invalid or expired marks the display; short password marks the password', () => {
  const r = e.codeError(http(400, 'Código inválido ou expirado'))
  assert.equal(r.title, 'Código inválido ou expirado')
  assert.deepEqual(r.fields, ['code'])
  assert.deepEqual(e.codeError(http(422, 'A senha deve ter ao menos 8 caracteres')).fields, ['password'])
})

test('code cells: six, digits only', () => {
  assert.deepEqual(e.codeCells('48a1'), ['4', '8', '1', null, null, null])
  assert.deepEqual(e.codeCells('12345678'), ['1', '2', '3', '4', '5', '6'])
})
