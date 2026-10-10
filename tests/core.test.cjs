const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const C = require('../src/core.js');

function config() {
  return C.validate({ allowControl: true, accounts: [{ id: 'hk', accessKeyId: 'testAK', accessKeySecret: 'testSecret', regionId: 'cn-hongkong', instanceId: 'i-test', maxTrafficGiB: 100, thresholdAction: 'stop', keepAlive: true }] });
}
test('SHA1/HMAC match Node crypto across Unicode and multi-block/long keys', () => {
  for (const input of ['', 'abc', '中文 🔐', 'x'.repeat(1000)]) {
    assert.equal(Buffer.from(C.sha1(C.utf8(input))).toString('hex'), crypto.createHash('sha1').update(input).digest('hex'));
    for (const key of ['', 'secret', '密钥', 'k'.repeat(100)]) assert.equal(C.hmac(key, input), crypto.createHmac('sha1', key).update(input).digest('base64'));
  }
});
test('RPC signature uses exact sorted RFC3986 POST canonical form', () => {
  const params = { Action: 'StartInstance', Timestamp: '2026-10-08T04:00:00Z', 'InstanceId.1': 'i-test', Test: "a b+~!*'()中", Signature: 'ignored' };
  const enc = value => encodeURIComponent(value).replace(/[!'()*]/g, ch => '%' + ch.charCodeAt(0).toString(16).toUpperCase());
  const query = Object.keys(params).filter(k => k !== 'Signature').sort().map(k => enc(k) + '=' + enc(params[k])).join('&');
  const expected = crypto.createHmac('sha1', 'secret&').update('POST&%2F&' + enc(query)).digest('base64');
  assert.equal(C.signature(params, 'secret'), expected);
});
test('CDT classifies Hong Kong as overseas and aggregates bytes using GiB', () => {
  assert.deepEqual(C.traffic({ Data: { TrafficDetails: [{ BusinessRegionId: 'cn-beijing', Traffic: 2 * C.GiB }, { BusinessRegionId: 'cn-hongkong', Traffic: String(C.GiB) }, { BusinessRegionId: 'ap-southeast-1', Traffic: 3 * C.GiB }] } }), { china: 2, international: 4 });
  for (const result of [{}, { TrafficDetails: [] }, { TrafficDetails: [{ BusinessRegionId: 'cn-hongkong', Traffic: null }] }, { TrafficDetails: [{ BusinessRegionId: '', Traffic: 0 }] }]) assert.throws(() => C.traffic(result));
});
test('exact instance matching never borrows another instance state', () => {
  const result = { InstanceStatuses: { InstanceStatus: [{ InstanceId: 'i-other', Status: 'Stopped' }, { InstanceId: 'i-test', Status: 'Running' }] } };
  assert.equal(C.instanceStatus(result, 'i-test'), 'Running');
  assert.throws(() => C.instanceStatus(result, 'i-missing'));
});
test('configuration rejects unsafe, ambiguous and placeholder controls', () => {
  const c = config();
  c.allowControl = false;
  assert.throws(() => C.validate(c));
  const dup = config(); dup.accounts.push({ ...dup.accounts[0], id: 'dup' });
  assert.throws(() => C.validate(dup), /同一实例/);
  for (const invalid of [0, -1, NaN, '100']) { const c = config(); c.accounts[0].maxTrafficGiB = invalid; assert.throws(() => C.validate(c)); }
  const placeholder = config(); placeholder.accounts[0].accessKeySecret = '填写'; assert.throws(() => C.validate(placeholder));
  const badTime = config(); badTime.accounts[0].schedule = { enabled: true, start: '23:55', stop: '00:00' }; assert.throws(() => C.validate(badTime));
});
test('freshness and threshold protection outrank schedule/keepalive', () => {
  const c = config(), a = c.accounts[0], now = Date.parse('2026-10-08T00:00:00Z');
  const snap = { status: 'Stopped', trafficGiB: 10, statusFresh: true, trafficFresh: true };
  assert.equal(C.decide(a, snap, now, c).action, 'start');
  for (const change of [{ trafficFresh: false }, { statusFresh: false }, { trafficGiB: 95 }, { manualPause: true }, { status: 'Starting' }]) assert.equal(C.decide(a, { ...snap, ...change }, now, c), null);
  assert.equal(C.decide(a, { ...snap, status: 'Running', trafficGiB: 95 }, now, c).action, 'stop');
});
test('cross-midnight schedule and ten-minute compensation use scheduled date', () => {
  const now = Date.parse('2026-10-08T16:03:00Z'); // local Oct 9 00:03
  assert.equal(C.due(now, 480, '23:55'), '2026-10-08');
  assert.equal(C.due(now + 120000, 480, '23:55'), null);
  const c = config(), a = c.accounts[0]; a.schedule = { enabled: true, start: '23:55', stop: '07:00' };
  assert.equal(C.decide(a, { status: 'Stopped', trafficGiB: 10, statusFresh: true, trafficFresh: true }, now, c).key, 'start:2026-10-08');
  assert.equal(C.decide(a, { status: 'Stopped', trafficGiB: 10, statusFresh: true, trafficFresh: true }, Date.parse('2026-10-09T04:00:00Z'), c), null);
});
test('signed amounts accept refunds while traffic rejects negative values', () => {
  assert.equal(C.money('-12.50'), -12.5);
  assert.equal(C.money('1,234.50'), 1234.5);
  assert.throws(() => C.amount(-1));
  assert.throws(() => C.money(''));
});
test('errors redact credential and notification header values', () => {
  const c = config(); c.notifications.webhook.headers = { Authorization: 'Bearer private' };
  assert.equal(C.redact('testAK testSecret Bearer private', c), '[REDACTED] [REDACTED] [REDACTED]');
});
