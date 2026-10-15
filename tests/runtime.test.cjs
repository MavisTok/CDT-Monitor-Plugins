const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const crypto = require('node:crypto');
const C = require('../src/core.js');
const runtime = fs.readFileSync(require.resolve('../surge/cdt-monitor.js'), 'utf8');
const setup = fs.readFileSync(require.resolve('../surge/cdt-setup.js'), 'utf8');
function config(extra = {}) {
  return C.validate({ allowControl: false, ...extra, accounts: extra.accounts || [{ id: 'hk', name: '香港', accessKeyId: 'testAK', accessKeySecret: 'testSecret', regionId: 'cn-hongkong', instanceId: 'i-test', maxTrafficGiB: 100 }] });
}
function storage(c) { return new Map(c ? [[C.CONFIG_KEY, JSON.stringify(c)]] : []); }
async function run({ c = config(), store = storage(c), op = 'panel', argument, handler, intent, trigger = 'editor', source = runtime, writeFail = false, input, loonName } = {}) {
  const requests = [], notifications = [], logs = [], timers = new Set();
  let calls = 0;
  const result = await new Promise((resolve, reject) => {
    const outer = setTimeout(() => reject(new Error('Mock runtime timed out')), 2500);
    const globals = {
      $argument: argument === undefined ? 'op=' + op : argument, $trigger: trigger, $input: input,
      $intent: intent ? { parameter: intent } : undefined,
      $loon: loonName ? 'Test Loon' : undefined,
      $script: loonName ? { name: loonName } : undefined,
      $persistentStore: { read: key => store.get(key) ?? null, write: (value, key) => { if (writeFail) return false; if (value === null) store.delete(key); else store.set(key, value); return true; } },
      $notification: { post: (...v) => notifications.push(v) },
      $httpClient: { post: (options, callback) => {
        const params = Object.fromEntries(new URLSearchParams(options.body)); requests.push({ options, params });
        try {
          if (params.Action) {
            const signature = params.Signature; delete params.Signature;
            const enc = s => encodeURIComponent(s).replace(/[!'()*]/g, x => '%' + x.charCodeAt(0).toString(16).toUpperCase());
            const query = Object.keys(params).sort().map(k => enc(k) + '=' + enc(params[k])).join('&');
            assert.equal(signature, crypto.createHmac('sha1', 'testSecret&').update('POST&%2F&' + enc(query)).digest('base64'));
          }
          let reply = handler ? handler(params, options, store) : undefined;
          if (!reply) {
            const json = params.Action === 'ListCdtInternetTraffic' ? { TrafficDetails: [{ BusinessRegionId: 'cn-hongkong', Traffic: C.GiB * 10 }] } : params.Action === 'DescribeInstanceStatus' ? { InstanceStatuses: { InstanceStatus: [{ InstanceId: 'i-test', Status: 'Running' }] } } : {};
            reply = { json: { RequestId: 'mock-request', ...json } };
          }
          queueMicrotask(() => callback(reply.error || null, { status: reply.status || 200 }, reply.raw !== undefined ? reply.raw : JSON.stringify(reply.json)));
        } catch (e) { clearTimeout(outer); reject(e); }
      } },
      console: { log: value => logs.push(value) },
      setTimeout: (fn, ms) => { const id = setTimeout(fn, ms); timers.add(id); return id; }, clearTimeout,
      $done: result => { calls++; clearTimeout(outer); for (const id of timers) clearTimeout(id); resolve(result); }
    };
    try { vm.runInNewContext(source, globals, { timeout: 1000 }); } catch (e) { clearTimeout(outer); reject(e); }
  });
  assert.equal(calls, 1);
  return { result, requests, notifications, logs, store, state: store.has(C.STATE_KEY) ? JSON.parse(store.get(C.STATE_KEY)) : undefined };
}
async function moduleArgument(overrides = {}, name = 'CDT-Panel') {
  const { scriptArgument } = await import('../tools/module-format.mjs');
  return scriptArgument(fs.readFileSync(require.resolve('../surge/CDT-Monitor.sgmodule'), 'utf8'), name, { access_key_id: 'testAK', access_key_secret: 'testSecret', instance_id: 'i-test', ...overrides });
}
test('unconfigured runtime has no network requests', async () => {
  const r = await run({ c: null }); assert.equal(r.requests.length, 0); assert.match(r.result.title, /尚未配置/);
});
test('first install and either missing module key never use cached credentials or send requests', async () => {
  const { scriptArgument } = await import('../tools/module-format.mjs');
  const source = fs.readFileSync(require.resolve('../surge/CDT-Monitor.sgmodule'), 'utf8');
  const fresh = await run({ c: null, argument: scriptArgument(source, 'CDT-Panel') });
  assert.match(fresh.result.title, /尚未配置/);
  assert.equal(fresh.requests.length, 0); assert.equal(fresh.store.size, 0);
  const store = storage(config());
  await run({ store, argument: await moduleArgument() });
  for (const values of [{ access_key_id: '未设置' }, { access_key_secret: '未设置' }]) {
    const before = [...store.entries()];
    const r = await run({ store, argument: await moduleArgument({ allow_control: 'true', threshold_action: 'stop', ...values }, 'CDT-Monitor'), intent: { op: 'stop', account: 'ecs-1', confirm: 'i-test' } });
    assert.match(r.result.title, /尚未配置/);
    assert.equal(r.requests.length, 0); assert.equal(r.notifications.length, 0);
    assert.deepEqual([...store.entries()], before);
  }
});
test('only RAM keys are needed for traffic monitoring; unused optional values are not persisted', async () => {
  const r = await run({ c: null, argument: await moduleArgument({ instance_id: '未设置', daily_report_time: '关闭' }) });
  assert.deepEqual(r.requests.map(r => r.params.Action), ['ListCdtInternetTraffic']);
  const saved = JSON.parse(r.store.get('cdt.local.module-config.v1'));
  assert.equal(saved.accounts[0].instanceId, '');
  assert.equal(saved.dailyReportTime, '');
  assert.equal(saved.notifications.telegram.botToken, '');
  assert.equal(saved.notifications.webhook.url, '');
  assert.deepEqual(saved.notifications.webhook.headers, {});
});
test('enabling notifications without replacing required placeholders fails before network access', async () => {
  for (const values of [{ telegram_enabled: 'true' }, { webhook_enabled: 'true' }]) {
    const r = await run({ c: null, argument: await moduleArgument(values) });
    assert.equal(r.result.style, 'error'); assert.equal(r.requests.length, 0); assert.equal(r.store.size, 0);
  }
});
test('panel queries exact ECS ID and does not perform control or notifications', async () => {
  const c = config({ allowControl: true }); c.accounts[0].thresholdAction = 'stop';
  const r = await run({ c, handler: p => p.Action === 'ListCdtInternetTraffic' ? { json: { RequestId: 'mock', TrafficDetails: [{ BusinessRegionId: 'cn-hongkong', Traffic: C.GiB * 96 }] } } : undefined });
  assert.deepEqual(r.requests.map(r => r.params.Action).sort(), ['DescribeInstanceStatus', 'ListCdtInternetTraffic']);
  assert.equal(r.requests.find(r => r.params.Action === 'DescribeInstanceStatus').params['InstanceId.1'], 'i-test');
  assert.equal(r.notifications.length, 0); assert.match(r.result.content, /96.00/);
});
test('monitor threshold stop reserves and persists action before HTTP', async () => {
  const c = config({ allowControl: true }); c.accounts[0].thresholdAction = 'stop';
  const r = await run({ c, op: 'monitor', handler: (p, _, store) => {
    if (p.Action === 'ListCdtInternetTraffic') return { json: { RequestId: 'mock', TrafficDetails: [{ BusinessRegionId: 'cn-hongkong', Traffic: C.GiB * 96 }] } };
    if (p.Action === 'StopInstance') assert.equal(JSON.parse(store.get(C.STATE_KEY)).accounts.hk.lastControl.status, 'pending');
  } });
  assert.equal(r.requests.filter(r => r.params.Action === 'StopInstance').length, 1);
  assert.equal(r.state.accounts.hk.status, 'Stopping');
  assert.equal(r.state.accounts.hk.lastControl.status, 'accepted');
  const next = await run({ c, store: r.store, op: 'monitor', handler: p => p.Action === 'ListCdtInternetTraffic' ? { json: { RequestId: 'mock', TrafficDetails: [{ BusinessRegionId: 'cn-hongkong', Traffic: C.GiB * 96 }] } } : undefined });
  assert.equal(next.requests.filter(r => r.params.Action === 'StopInstance').length, 0);
  assert.equal(next.notifications.filter(n => n[1].includes('流量阈值告警')).length, 0);
});
test('failed traffic preserves cache and blocks both keepalive and threshold stop', async () => {
  const c = config({ allowControl: true }); c.accounts[0].keepAlive = true; c.accounts[0].thresholdAction = 'stop';
  const first = await run({ c });
  const r = await run({ c, store: first.store, op: 'monitor', handler: p => p.Action === 'ListCdtInternetTraffic' ? { error: 'testSecret' } : { json: { RequestId: 'mock', InstanceStatuses: { InstanceStatus: [{ InstanceId: 'i-test', Status: 'Stopped' }] } } } });
  assert.equal(r.state.accounts.hk.trafficGiB, 10); assert.equal(r.state.accounts.hk.trafficFresh, false);
  assert.equal(r.requests.some(r => /^(Start|Stop)Instance$/.test(r.params.Action)), false);
  assert.match(r.result.content, /旧数据/); assert.equal(JSON.stringify(r.result).includes('testSecret'), false);
});
test('missing and empty traffic responses never become zero or trigger start', async () => {
  for (const json of [{ RequestId: 'mock' }, { RequestId: 'mock', TrafficDetails: [] }]) {
    const c = config({ allowControl: true }); c.accounts[0].keepAlive = true;
    const r = await run({ c, op: 'monitor', handler: p => p.Action === 'ListCdtInternetTraffic' ? { json } : { json: { RequestId: 'mock', InstanceStatuses: { InstanceStatus: [{ InstanceId: 'i-test', Status: 'Stopped' }] } } } });
    assert.equal(r.state.accounts.hk.trafficGiB, undefined); assert.equal(r.requests.some(r => r.params.Action === 'StartInstance'), false);
  }
});
test('explicit manual stop pauses automatic restart and validates confirmation', async () => {
  const c = config({ allowControl: true }); c.accounts[0].keepAlive = true;
  const bad = await run({ c, intent: { op: 'stop', account: 'hk', confirm: 'i-wrong' }, trigger: 'intent' });
  assert.equal(bad.requests.length, 0);
  const r = await run({ c, intent: { op: 'stop', account: 'hk', confirm: 'i-test' }, trigger: 'intent' });
  assert.equal(r.state.accounts.hk.manualPause, true);
  const next = await run({ c, store: r.store, op: 'monitor', handler: p => p.Action === 'DescribeInstanceStatus' ? { json: { RequestId: 'mock', InstanceStatuses: { InstanceStatus: [{ InstanceId: 'i-test', Status: 'Stopped' }] } } } : undefined });
  assert.equal(next.requests.some(r => r.params.Action === 'StartInstance'), false);
});
test('control timeout remains uncertain and does not retry immediately', async () => {
  const c = config({ allowControl: true });
  const r = await run({ c, intent: { op: 'stop', account: 'hk', confirm: 'i-test' }, trigger: 'intent', handler: p => p.Action === 'StopInstance' ? { error: 'socket timeout' } : undefined });
  assert.equal(r.state.accounts.hk.lastControl.status, 'uncertain');
  const again = await run({ c, store: r.store, intent: { op: 'stop', account: 'hk', confirm: 'i-test' }, trigger: 'intent' });
  assert.equal(again.requests.some(r => r.params.Action === 'StopInstance'), false);
});
test('active lease or failed persistent writes prevent requests', async () => {
  const c = config(), store = storage(c); store.set(C.LOCK_KEY, JSON.stringify({ token: 'other', expires: Date.now() + 100000 }));
  const r = await run({ c, store }); assert.equal(r.requests.length, 0); assert.equal(JSON.parse(store.get(C.LOCK_KEY)).token, 'other');
  const failed = await run({ writeFail: true }); assert.equal(failed.requests.length, 0);
});
test('same RAM credentials reuse account traffic request across instances', async () => {
  const c = config(); c.accounts.push({ ...c.accounts[0], id: 'hk2', instanceId: 'i-second' });
  const r = await run({ c, handler: p => p.Action === 'DescribeInstanceStatus' ? { json: { RequestId: 'mock', InstanceStatuses: { InstanceStatus: [{ InstanceId: p['InstanceId.1'], Status: 'Running' }] } } } : undefined });
  assert.equal(r.requests.filter(r => r.params.Action === 'ListCdtInternetTraffic').length, 1);
  assert.equal(r.state.accounts.hk2.trafficGiB, 10);
});
test('billing follows NextToken, includes refunds and preserves exact currency', async () => {
  const c = config(); c.accounts[0].billing = true;
  const r = await run({ c, handler: p => {
    if (p.Action === 'QueryAccountBalance') return { json: { RequestId: 'mock', Success: true, Data: { AvailableAmount: '12.50', Currency: 'USD' } } };
    if (p.Action === 'DescribeInstanceBill') {
      assert.equal(p.MaxResults, '300'); assert.equal(p.PageNum, undefined);
      return { json: { RequestId: 'mock', Success: true, Data: { NextToken: p.NextToken ? '' : 'page2', TotalCount: 2, Items: [{ InstanceID: 'i-test', Currency: 'USD', PretaxAmount: p.NextToken ? '-1.50' : '10.00' }] } } };
    }
  } });
  assert.equal(r.state.accounts.hk.billing.instanceCost, 8.5); assert.equal(r.state.accounts.hk.billing.billCurrency, 'USD');
  assert.equal(r.requests.filter(r => r.params.Action === 'DescribeInstanceBill').length, 2);
});
test('failed webhook remains in outbox and retries without duplicate local notification', async () => {
  const c = config(); c.notifications.webhook = { enabled: true, url: 'https://example.invalid/hook', headers: {} };
  const r = await run({ c, op: 'test-notify', handler: (p, o) => o.url.includes('example.invalid') ? { status: 500, raw: 'failed' } : undefined });
  assert.equal(r.state.outbox.length, 1); assert.equal(r.notifications.length, 1);
  const next = await run({ c, store: r.store, op: 'monitor', handler: (p, o) => o.url.includes('example.invalid') ? { status: 204, raw: '' } : undefined });
  assert.equal(next.state.outbox.length, 0); assert.equal(next.notifications.length, 0);
});
test('setup preserves prior configuration when validation fails and backs up on success', async () => {
  const c = config(), store = storage(c), original = store.get(C.CONFIG_KEY);
  const bad = await run({ c, store, source: setup }); assert.match(bad.result.title, /未保存/); assert.equal(store.get(C.CONFIG_KEY), original);
  const changed = config(); changed.accounts[0].name = 'new';
  const good = await run({ c, store, source: setup, intent: changed });
  assert.equal(store.get('cdt.local.config.backup.v1'), original); assert.match(good.result.title, /已保存/);
});
test('local history has no AccessKey or secret in exported output', async () => {
  const first = await run(); const r = await run({ store: first.store, op: 'history' });
  assert.equal(r.requests.length, 0); assert.equal(r.logs.join('').includes('testAK'), false); assert.equal(r.logs.join('').includes('testSecret'), false);
});
test('configuration changed during a query prevents subsequent control', async () => {
  const c = config({ allowControl: true }); c.accounts[0].thresholdAction = 'stop';
  const r = await run({ c, op: 'monitor', handler: (p, _, store) => {
    if (p.Action === 'ListCdtInternetTraffic') {
      store.set(C.CONFIG_KEY, JSON.stringify(config()));
      return { json: { RequestId: 'mock', TrafficDetails: [{ BusinessRegionId: 'cn-hongkong', Traffic: 96 * C.GiB }] } };
    }
  } });
  assert.equal(r.requests.some(r => r.params.Action === 'StopInstance'), false);
  assert.match(r.result.content, /配置已变更/);
});
test('a wrong instance response never authorizes keepalive', async () => {
  const c = config({ allowControl: true }); c.accounts[0].keepAlive = true;
  const r = await run({ c, op: 'monitor', handler: p => p.Action === 'DescribeInstanceStatus' ? { json: { RequestId: 'mock', InstanceStatuses: { InstanceStatus: [{ InstanceId: 'i-wrong', Status: 'Stopped' }] } } } : undefined });
  assert.equal(r.requests.some(r => r.params.Action === 'StartInstance'), false);
  assert.equal(r.state.accounts.hk.statusFresh, false);
});
test('incomplete billing pagination cannot replace a successful cached amount', async () => {
  const c = config(); c.accounts[0].billing = true;
  const store = storage(c);
  store.set(C.STATE_KEY, JSON.stringify({ version: 1, accounts: { hk: { identity: C.identity(c.accounts[0]), events: {}, history: [], daily: [], log: [], billing: { at: 0, cycle: '2026-01', balance: 5, currency: 'CNY', billCurrency: 'CNY', instanceCost: 20 } } }, notifications: {}, outbox: [] }));
  const r = await run({ c, store, handler: p => {
    if (p.Action === 'QueryAccountBalance') return { json: { RequestId: 'mock', Data: { AvailableAmount: '12.50', Currency: 'CNY' } } };
    if (p.Action === 'DescribeInstanceBill') return { json: { RequestId: 'mock', Data: { Items: [{ InstanceID: 'i-test', Currency: 'CNY', PretaxAmount: 10 }], NextToken: '', TotalCount: 2 } } };
  } });
  assert.equal(r.state.accounts.hk.billing.instanceCost, 20); assert.match(r.state.accounts.hk.billingError, /不完整/);
});
test('module parameters work without Setup and preserve legacy configuration/history', async () => {
  const c = config(), store = storage(c), original = store.get(C.CONFIG_KEY);
  const legacyState = JSON.stringify({ version: 1, accounts: {}, notifications: {}, outbox: [] });
  store.set(C.STATE_KEY, legacyState);
  const r = await run({ store, argument: await moduleArgument({ account_name: '模块里的实例', max_traffic_gib: '25' }) });
  assert.match(r.result.content, /模块里的实例/); assert.match(r.result.content, /10.00 \/ 25 GiB/);
  assert.equal(store.get(C.CONFIG_KEY), original); assert.equal(store.get(C.STATE_KEY), legacyState);
  assert.equal(JSON.parse(store.get('cdt.local.module-config.v1')).accounts[0].maxTrafficGiB, 25);
});
test('edited module threshold takes effect next run and backs up only module settings', async () => {
  const store = storage(null);
  await run({ store, argument: await moduleArgument({ max_traffic_gib: '100' }) });
  const r = await run({ store, argument: await moduleArgument({ max_traffic_gib: '10' }) });
  assert.equal(r.result.style, 'alert');
  assert.equal(JSON.parse(store.get('cdt.local.module-config.backup.v1')).accounts[0].maxTrafficGiB, 100);
  assert.equal(JSON.parse(store.get('cdt.local.module-config.v1')).accounts[0].maxTrafficGiB, 10);
});
test('invalid edited module parameters fail closed, never using previous control settings', async () => {
  const store = storage(null);
  await run({ store, argument: await moduleArgument() });
  const saved = store.get('cdt.local.module-config.v1');
  const r = await run({ store, argument: await moduleArgument({ allow_control: 'yes', threshold_action: 'stop' }, 'CDT-Monitor') });
  assert.equal(r.requests.length, 0); assert.match(r.result.content, /true 或 false/);
  assert.equal(store.get('cdt.local.module-config.v1'), saved);
});
test('local source keeps multi-account configuration authoritative', async () => {
  const c = config(); c.accounts.push({ ...c.accounts[0], id: 'other', instanceId: '' });
  const r = await run({ c, argument: await moduleArgument({ config_source: 'local', max_traffic_gib: '1', access_key_id: '未设置', access_key_secret: '未设置' }) });
  assert.match(r.result.content, /100 GiB/);
  assert.equal(Object.keys(r.state.accounts).length, 2);
  assert.equal(r.store.has('cdt.local.module-config.v1'), false);
});
test('Shortcuts cannot override module control permission via argument injection', async () => {
  const r = await run({ argument: await moduleArgument(), intent: { op: 'stop', account: 'ecs-1', confirm: 'i-test', allow_control: 'true' }, trigger: 'intent' });
  assert.equal(r.requests.length, 0); assert.match(r.result.content, /allowControl=true/);
});

const loonRuntime = fs.readFileSync(require.resolve('../loon/cdt-monitor.js'), 'utf8');
function loonArgument(extra = {}) {
  return { ...Object.fromEntries(require('../src/module-parameters.json').map(p => [p.key, p.default])), access_key_id: 'testAK', access_key_secret: 'testSecret', instance_id: 'i-test', ...extra };
}
function runLoon(options = {}) {
  return run({ source: loonRuntime, trigger: undefined, loonName: 'CDT-Refresh', argument: loonArgument(), ...options });
}
test('Loon refresh preserves object strings, returns summary, converts timeout and verifies TLS', async () => {
  const r = await runLoon({ argument: loonArgument({ account_name: '香港|"A"', request_timeout_seconds: '7' }) });
  assert.match(r.result.content, /香港\|"A"/);
  assert.ok(r.logs.some(l => l.includes('10.00')));
  for (const { options } of r.requests) {
    assert.equal(options.timeout, 7000); assert.equal(options.insecure, false);
    assert.equal(options['auto-redirect'], false); assert.equal(options['auto-cookie'], false);
  }
  assert.equal(r.store.has(C.LOCK_KEY), false);
  assert.equal(r.notifications.length, 0);
});
test('Loon invalid/missing configuration and unknown entry fail before network', async () => {
  for (const argument of [null, 'op=monitor', loonArgument({ access_key_id: '' }), loonArgument({ allow_control: 'yes' })]) {
    const r = await runLoon({ argument }); assert.equal(r.requests.length, 0);
  }
  const r = await runLoon({ loonName: 'Other' }); assert.equal(r.requests.length, 0);
});
test('Loon generic manual stop validates target; refresh ignores injected operation and intent', async () => {
  const argument = loonArgument({ allow_control: 'true', control_account: 'ecs-1', control_confirm: 'i-test' });
  const bad = await runLoon({ loonName: 'CDT-Stop', argument: { ...argument, control_confirm: 'i-wrong' } });
  assert.equal(bad.requests.length, 0);
  const good = await runLoon({ loonName: 'CDT-Stop', argument });
  assert.ok(good.requests.some(r => r.params.Action === 'StopInstance'));
  assert.equal(JSON.parse(good.store.get('cdt.local.module-state.v1')).accounts['ecs-1'].manualPause, true);
  const refresh = await runLoon({ argument: { ...argument, op: 'stop' }, intent: { op: 'stop', account: 'ecs-1', confirm: 'i-test' } });
  assert.equal(refresh.requests.some(r => /^(Start|Stop)Instance$/.test(r.params.Action)), false);
});
test('Loon cron applies shared threshold policy; failed traffic blocks control and releases lock', async () => {
  const argument = loonArgument({ allow_control: 'true', threshold_action: 'stop', max_traffic_gib: '100' });
  const r = await runLoon({ loonName: 'CDT-Monitor', argument, handler: p => p.Action === 'ListCdtInternetTraffic' ? { json: { RequestId: 'mock', TrafficDetails: [{ BusinessRegionId: 'cn-hongkong', Traffic: 96 * C.GiB }] } } : undefined });
  assert.ok(r.requests.some(r => r.params.Action === 'StopInstance'));
  assert.ok(r.notifications.length > 0);
  const failed = await runLoon({ loonName: 'CDT-Monitor', argument, handler: p => p.Action === 'ListCdtInternetTraffic' ? { error: 'testSecret' } : undefined });
  assert.equal(failed.requests.some(r => /^(Start|Stop)Instance$/.test(r.params.Action)), false);
  assert.equal(failed.store.has(C.LOCK_KEY), false);
  assert.equal(JSON.stringify(failed.result).includes('testSecret'), false);
});
test('Loon webhook timeout and failed delivery retry retain platform source without duplicate system notice', async () => {
  const argument = loonArgument({ webhook_enabled: 'true', webhook_url: 'https://example.invalid/hook' });
  const first = await runLoon({ loonName: 'CDT-Notify-Test', argument, handler: (p, options) => !p.Action ? { error: 'offline' } : undefined });
  const hook = first.requests.find(r => !r.params.Action);
  assert.equal(hook.options.timeout, 10000); assert.equal(hook.options.insecure, false);
  assert.equal(JSON.parse(hook.options.body).source, 'cdt-monitor-loon');
  assert.equal(JSON.parse(first.store.get('cdt.local.module-state.v1')).outbox.length, 1);
  const next = await runLoon({ loonName: 'CDT-Monitor', argument, store: first.store });
  assert.equal(JSON.parse(next.store.get('cdt.local.module-state.v1')).outbox.length, 0);
  assert.equal(next.notifications.length, 0);
});
test('Loon Setup imports JSON and history uses local configuration without exposing secrets', async () => {
  const c = config();
  const imported = await runLoon({ c: null, loonName: 'CDT-Setup', source: fs.readFileSync(require.resolve('../loon/cdt-setup.js'), 'utf8'), argument: { config_json: JSON.stringify(c) } });
  assert.ok(imported.store.has(C.CONFIG_KEY));
  const argument = loonArgument({ config_source: 'local' });
  await runLoon({ store: imported.store, argument });
  const r = await runLoon({ store: imported.store, argument, loonName: 'CDT-History' });
  assert.equal(r.requests.length, 0);
  assert.ok(JSON.parse(r.result.result)[0].hourly.length > 0);
  assert.equal(r.result.result.includes('testSecret'), false);
});
test('Loon manual start requires permission, checks threshold and clears manual pause', async () => {
  const argument = loonArgument({ allow_control: 'true', control_account: 'ecs-1', control_confirm: 'i-test' });
  const stopped = await runLoon({ loonName: 'CDT-Stop', argument });
  // Advance only the persisted cooldown, without bypassing the state machine.
  const state = JSON.parse(stopped.store.get('cdt.local.module-state.v1'));
  state.accounts['ecs-1'].lastControl.at = Date.now() - 11 * 60000;
  stopped.store.set('cdt.local.module-state.v1', JSON.stringify(state));
  const handler = p => p.Action === 'DescribeInstanceStatus' ? { json: { RequestId: 'mock', InstanceStatuses: { InstanceStatus: [{ InstanceId: 'i-test', Status: 'Stopped' }] } } } : undefined;
  const started = await runLoon({ loonName: 'CDT-Start', argument, store: stopped.store, handler });
  assert.ok(started.requests.some(r => r.params.Action === 'StartInstance'));
  assert.equal(JSON.parse(started.store.get('cdt.local.module-state.v1')).accounts['ecs-1'].manualPause, false);
  const denied = await runLoon({ loonName: 'CDT-Start', argument: { ...argument, allow_control: 'false' }, handler });
  assert.equal(denied.requests.length, 0);
  const over = await runLoon({ loonName: 'CDT-Start', argument: { ...argument, max_traffic_gib: '5' }, handler });
  assert.equal(over.requests.some(r => r.params.Action === 'StartInstance'), false);
});
