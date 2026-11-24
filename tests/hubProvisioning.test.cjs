// Copiado de letsgrow-mobile/tests/hubProvisioning.test.cjs por scripts/sync-shared.mjs.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const h = require('../src/shared/lib/hubProvisioning.ts')

test('UUIDs follow the contract: service 0001, info/scan/config/status 0002–0005', () => {
  assert.equal(h.HUB_SERVICE_UUID, '6c670001-4c47-4875-6200-000000000000')
  assert.equal(h.HUB_CHAR.info, '6c670002-4c47-4875-6200-000000000000')
  assert.equal(h.HUB_CHAR.scan, '6c670003-4c47-4875-6200-000000000000')
  assert.equal(h.HUB_CHAR.config, '6c670004-4c47-4875-6200-000000000000')
  assert.equal(h.HUB_CHAR.status, '6c670005-4c47-4875-6200-000000000000')
})

test('Hub names and MACs', () => {
  assert.ok(h.isHubName('LetsGrow-Hub-3F2A'))
  assert.ok(!h.isHubName('LetsGrow-Hub-'))
  assert.ok(!h.isHubName('ESP32'))
  assert.ok(!h.isHubName(null))
  assert.equal(h.hubSuffix('LetsGrow-Hub-3f2a'), '3F2A')
  assert.equal(h.normalizeMac('aa:bb:cc:dd:ee:ff'), 'AABBCCDDEEFF')
  assert.equal(h.normalizeMac('AABBCC'), null)
  assert.equal(h.formatMac('AABBCCDDEEFF'), 'AA:BB:CC:DD:EE:FF')
})

test('base64 round-trips UTF-8 (SSIDs and passwords with accents and emoji)', () => {
  for (const s of ['', 'a', 'ab', 'abc', 'Casa_2G', 'Ação & café ☕', 'rede 🌱 verde', '{"ssid":"x"}']) {
    assert.equal(h.base64ToText(h.textToBase64(s)), s, s)
  }
  assert.equal(h.textToBase64('{"op":"scan"}'), Buffer.from('{"op":"scan"}').toString('base64'))
  assert.equal(h.textToBase64('Ação'), Buffer.from('Ação').toString('base64'))
  assert.equal(h.base64ToText(Buffer.from('São Paulo 🌿').toString('base64')), 'São Paulo 🌿')
})

test('info: needs a valid MAC, fills defaults', () => {
  assert.deepEqual(h.parseInfo('{"mac":"aabbccddeeff","fw":"1.2","model":"hub","proto":1,"relays":4}'),
    { mac: 'AABBCCDDEEFF', fw: '1.2', model: 'hub', proto: 1, relays: 4 })
  assert.equal(h.parseInfo('{"fw":"1"}'), null)
  assert.equal(h.parseInfo('não é json'), null)
  assert.equal(h.parseInfo(null), null)
})

test('scan: hidden networks out, strongest AP per SSID, sorted, at most 15', () => {
  const nets = h.parseScan(JSON.stringify({ nets: [
    { ssid: 'Fraca', rssi: -85, sec: true },
    { ssid: '', rssi: -30, sec: true },
    { ssid: 'Casa_2G', rssi: -70, sec: true },
    { ssid: 'Casa_2G', rssi: -48, sec: true },
    { ssid: 'Visitantes', rssi: -60, sec: false },
  ] }))
  assert.deepEqual(nets.map(n => n.ssid), ['Casa_2G', 'Visitantes', 'Fraca'])
  assert.equal(nets[0].rssi, -48)
  assert.equal(nets[1].sec, false)
  const many = h.parseScan(JSON.stringify({ nets: Array.from({ length: 30 }, (_, i) => ({ ssid: `n${i}`, rssi: -40 - i, sec: true })) }))
  assert.equal(many.length, 15)
  assert.equal(h.parseScan('{"op":"scan"}'), null)
})

test('status: known states only, err kept', () => {
  assert.deepEqual(h.parseStatus('{"state":"wifi_failed","err":"wifi_auth"}'), { state: 'wifi_failed', err: 'wifi_auth' })
  assert.deepEqual(h.parseStatus('{"state":"activating","err":""}'), { state: 'activating' })
  assert.equal(h.parseStatus('{"state":"rebooting"}'), null)
  assert.equal(h.parseStatus(''), null)
})

test('config payload carries ssid, pass, grow_id and code', () => {
  assert.deepEqual(JSON.parse(h.buildConfig({ ssid: 'Casa', pass: 'segredo123', growId: 'g-1', code: 'ABCD2345' })),
    { ssid: 'Casa', pass: 'segredo123', grow_id: 'g-1', code: 'ABCD2345' })
})

test('Wi-Fi form: name required, WPA 8–63 chars, open network needs no password', () => {
  assert.equal(h.wifiFormError('', 'x', true), 'Digite o nome da rede.')
  assert.equal(h.wifiFormError('Casa', '', true), 'Digite a senha do Wi-Fi.')
  assert.match(h.wifiFormError('Casa', '1234567', true), /8 caracteres/)
  assert.equal(h.wifiFormError('Casa', '12345678', true), null)
  assert.equal(h.wifiFormError('Aberta', '', false), null)
  assert.match(h.wifiFormError('x'.repeat(33), '12345678', true), /32/)
  assert.match(h.wifiFormError('Casa', 'x'.repeat(64), true), /63/)
})

test('signal bars and labels', () => {
  assert.equal(h.signalBars(-40), 4)
  assert.equal(h.signalBars(-60), 3)
  assert.equal(h.signalBars(-72), 2)
  assert.equal(h.signalBars(-90), 1)
  assert.equal(h.signalLabel(-50), 'SINAL FORTE')
  assert.equal(h.signalLabel(-90), 'SINAL FRACO')
})

test('progress follows status.state (H5)', () => {
  assert.equal(h.progressIndex('idle'), 0)
  assert.equal(h.progressIndex('wifi_connecting'), 1)
  assert.equal(h.progressIndex('activating'), 2)
  assert.equal(h.progressIndex('done'), 3)
  assert.equal(h.progressIndex('wifi_failed'), 1)
  assert.equal(h.progressIndex('activation_failed'), 2)
})

test('failed states map to errors; missing err falls back per step', () => {
  assert.equal(h.statusError({ state: 'activating' }), null)
  assert.equal(h.statusError({ state: 'done' }), null)
  for (const err of ['wifi_auth', 'wifi_no_ap', 'wifi_timeout']) assert.equal(h.statusError({ state: 'wifi_failed', err }), err)
  for (const err of ['http', 'code_invalid', 'code_expired', 'bad_request']) assert.equal(h.statusError({ state: 'activation_failed', err }), err)
  assert.equal(h.statusError({ state: 'wifi_failed' }), 'wifi_timeout')
  assert.equal(h.statusError({ state: 'activation_failed' }), 'http')
  assert.equal(h.statusError({ state: 'activation_failed', err: 'novo_erro' }), 'http')
})

test('error copy and next action for every error (H7)', () => {
  const auth = h.errorCopy('wifi_auth', 'Casa_2G')
  assert.equal(auth.title, 'Senha do Wi-Fi incorreta')
  assert.match(auth.body, /Casa_2G/)
  assert.equal(auth.primary, 'password')
  assert.equal(auth.secondary, 'network')
  assert.equal(h.errorCopy('wifi_no_ap').primary, 'network')
  assert.equal(h.errorCopy('wifi_timeout').primary, 'retry')
  assert.equal(h.errorCopy('http').title, 'Sem internet no Hub')
  for (const err of ['code_invalid', 'code_expired']) {
    const c = h.errorCopy(err)
    assert.equal(c.primary, 'retry')
    assert.equal(c.newCode, true)
  }
  assert.equal(h.errorCopy('bad_request').title, 'Dados incompletos')
  assert.equal(h.errorCopy('ble_disconnected').primary, 'rescan')
  assert.match(h.errorCopy('ble_disconnected').body, /15 minutos/)
  assert.equal(h.errorCopy('claim_failed').primary, 'retry')
  assert.equal(h.errorCopy('unknown').primary, 'retry')
  for (const err of ['wifi_auth', 'wifi_no_ap', 'wifi_timeout', 'http', 'code_invalid', 'code_expired', 'bad_request', 'ble_disconnected', 'claim_failed', 'unknown']) {
    const c = h.errorCopy(err)
    assert.ok(c.title && c.body && h.ERROR_ACTION_LABEL[c.primary], err)
    if (c.secondary) assert.notEqual(c.secondary, c.primary, err)
  }
})

test('a stale failure right after rewriting config is ignored', () => {
  const failed = { state: 'wifi_failed', err: 'wifi_auth' }
  assert.equal(h.acceptStatus(failed, { written: false, sawProgress: false, msSinceWrite: 0 }), false)
  assert.equal(h.acceptStatus(failed, { written: true, sawProgress: false, msSinceWrite: 200 }), false)
  assert.equal(h.acceptStatus(failed, { written: true, sawProgress: true, msSinceWrite: 200 }), true)
  assert.equal(h.acceptStatus(failed, { written: true, sawProgress: false, msSinceWrite: 5000 }), true)
  assert.equal(h.acceptStatus({ state: 'wifi_connecting' }, { written: true, sawProgress: false, msSinceWrite: 10 }), true)
})

test('claim code is renewed when missing, invalid or about to expire', () => {
  const now = Date.parse('2026-11-24T12:00:00Z')
  assert.equal(h.needsNewCode(null, now), true)
  assert.equal(h.needsNewCode({ expires_at: 'x' }, now), true)
  assert.equal(h.needsNewCode({ expires_at: '2026-11-24T12:00:30Z' }, now), true)
  assert.equal(h.needsNewCode({ expires_at: '2026-11-24T12:10:00Z' }, now), false)
})

const dev = (id, extra) => ({ id, esp32_mac: '000000000000', module_type: 'satellite', is_paired: false, is_online: false, ...extra })

test('devices: the activated Hub by MAC, the grow Hub, new pending satellites', () => {
  const list = [
    dev('h1', { esp32_mac: 'AA:BB:CC:DD:EE:01', module_type: 'hub', is_paired: true }),
    dev('h2', { esp32_mac: 'aabbccddee02', module_type: 'hub', is_paired: true, is_online: true }),
    dev('s1'),
  ]
  assert.equal(h.findHub(list, 'AABBCCDDEE01').id, 'h1')
  assert.equal(h.findHub(list, 'AA:BB:CC:DD:EE:02').id, 'h2')
  assert.equal(h.findHub(list, 'AABBCCDDEE99'), null)
  assert.equal(h.growHub(list).id, 'h2')
  assert.equal(h.growHub([dev('s')]), null)
  assert.equal(h.newPendingDevice(list, new Set(['s1'])), null)
  assert.equal(h.newPendingDevice([...list, dev('s2')], new Set(['s1'])).id, 's2')
})

test('pairing window countdown and errors (S2)', () => {
  assert.equal(h.secondsLeft(10_500, 0), 11)
  assert.equal(h.secondsLeft(1000, 5000), 0)
  assert.match(h.pairingErrorCopy(503), /servidor/)
  assert.match(h.pairingErrorCopy(404), /não foi encontrado/)
  assert.match(h.pairingErrorCopy(undefined), /offline/)
})
