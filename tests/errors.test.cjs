// Copiado de letsgrow-mobile/tests/errors.test.cjs por scripts/sync-shared.mjs.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { getErrorMessage, planLimitMessage, rejectionMessage } = require('../src/shared/lib/errors.ts')

const http = (status, detail) => ({ message: `Request failed with status code ${status}`, response: { status, data: { detail } } })
const AI_LIMIT = 'Limite de 1 consultas de IA atingido este mes. Faca upgrade para continuar usando o Bob.'

test('plan limit 403s from subscription.py keep the server text', () => {
  assert.equal(planLimitMessage(http(403, AI_LIMIT)), AI_LIMIT)
  for (const detail of [
    'Limite de grows atingido para o plano FREE. Faca upgrade para continuar.',
    'Limite de vasos por grow atingido para o plano FREE.',
    'Limite de plantas atingido para o plano FREE (2 plantas). Faca upgrade para continuar.',
    'Sensores disponiveis a partir do plano Cultivador. Faca upgrade para ativar.',
  ]) assert.equal(planLimitMessage(http(403, detail)), detail)
})

test('other 403s and other statuses are not plan limits', () => {
  assert.equal(planLimitMessage(http(403, 'Conta inativa')), null)
  assert.equal(planLimitMessage(http(403, 'email_not_verified')), null)
  assert.equal(planLimitMessage(http(403, 'Uma ou mais plantas nao pertencem ao usuario')), null)
  assert.equal(planLimitMessage(http(500, AI_LIMIT)), null)
  assert.equal(planLimitMessage(http(402, { code: 'quote_required', message: 'Confirme o custo antes de continuar.' })), null)
  assert.equal(planLimitMessage(new Error('Network Error')), null)
  assert.equal(planLimitMessage(undefined), null)
})

test('server refusals show their reason; network and 5xx stay technical', () => {
  assert.equal(rejectionMessage(http(400, 'Mensagem vazia')), 'Mensagem vazia')
  assert.equal(rejectionMessage(http(422, [{ msg: 'Campo obrigatório' }])), 'Campo obrigatório')
  assert.equal(rejectionMessage(http(502, 'Bad gateway')), null)
  assert.equal(rejectionMessage(http(500, undefined)), null)
  assert.equal(rejectionMessage({ message: 'timeout of 15000ms exceeded', code: 'ECONNABORTED' }), null)
  // No readable detail: the axios "Request failed…" text is never shown as a reason.
  assert.equal(rejectionMessage(http(404, undefined)), null)
  assert.equal(getErrorMessage(http(403, AI_LIMIT)), AI_LIMIT)
})

test('payment errors ({code, message}) show the server message', () => {
  const detail = { code: 'purchase_account_mismatch', message: 'Esta compra pertence a outra conta.' }
  assert.equal(getErrorMessage(http(403, detail)), 'Esta compra pertence a outra conta.')
  assert.equal(getErrorMessage(http(503, { code: 'payments_unavailable', message: 'Compra ainda não disponível.' })), 'Compra ainda não disponível.')
})
