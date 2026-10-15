const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const C = require('../src/core.js');
const pkg = require('../package.json');
const moduleConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../egern/CDT-Monitor.yaml'), 'utf8'));
const stash = JSON.parse(fs.readFileSync(path.join(__dirname, '../stash/CDT-Monitor.stoverride'), 'utf8'));
async function run({ name = 'CDT-Refresh', env = {}, store = new Map(), cron, widgetFamily, failure = false, setup = false, hookFailure = false } = {}) {
  const requests = [], notices = [];
  const ctx = {
    script: { name }, env: { ...moduleConfig.scriptings.find(v => Object.values(v)[0].name === name)?.[name === 'CDT-Monitor' ? 'schedule' : 'generic']?.env, access_key_id: 'testAK', access_key_secret: 'testSecret', instance_id: 'i-test', ...env },
    ...(cron !== undefined ? { cron } : {}), ...(widgetFamily !== undefined ? { widgetFamily } : {}),
    storage: { get: key => store.get(key) ?? null, set: (key, value) => { assert.equal(typeof value, 'string'); store.set(key, value); }, delete: key => store.delete(key) },
    notify: value => notices.push(value),
    http: { post: async (url, options) => {
      requests.push({ url, options });
      if (failure) throw new Error('testSecret');
      const p = Object.fromEntries(new URLSearchParams(options.body));
      if (!p.Action && hookFailure) throw new Error('offline');
      const json = p.Action === 'ListCdtInternetTraffic' ? { TrafficDetails: [{ BusinessRegionId: 'cn-hongkong', Traffic: C.GiB * 10 }] } : p.Action === 'DescribeInstanceStatus' ? { InstanceStatuses: { InstanceStatus: [{ InstanceId: 'i-test', Status: 'Running' }] } } : {};
      return { status: 200, text: async () => JSON.stringify({ RequestId: 'mock', ...json }) };
    } }
  };
  const source = fs.readFileSync(path.join(__dirname, '../egern/' + (setup ? 'cdt-setup.js' : 'cdt-monitor.js')), 'utf8');
  const imported = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  const result = await imported.default(ctx);
  return { result, requests, notices, store };
}
test('Egern native ctx wrapper returns Widget DSL, milliseconds and strict HTTP options', async () => {
  const r = await run();
  assert.equal(r.result.type, 'widget');
  assert.match(r.result.children[1].text, /10.00/);
  assert.equal(r.store.has(C.LOCK_KEY), false);
  for (const { options } of r.requests) {
    assert.equal(options.timeout, 10000); assert.equal(options.redirect, 'manual');
    assert.equal(options.credentials, 'omit'); assert.equal(options.insecureTls, false);
  }
});
test('Egern schedule executes shared policy and returns no widget', async () => {
  const r = await run({ name: 'CDT-Monitor', cron: '*/10 * * * *', env: { allow_control: 'true', threshold_action: 'stop', max_traffic_gib: '5' } });
  assert.equal(r.result, undefined);
  assert.ok(r.requests.some(v => new URLSearchParams(v.options.body).get('Action') === 'StopInstance'));
});
test('Egern control is blocked from widgets and schedules; manual validates confirmation', async () => {
  const env = { allow_control: 'true', control_account: 'ecs-1', control_confirm: 'i-test' };
  const widget = await run({ name: 'CDT-Stop', env, widgetFamily: 'systemSmall' });
  assert.equal(widget.requests.some(v => /^(Start|Stop)Instance$/.test(new URLSearchParams(v.options.body).get('Action'))), false);
  const schedule = await run({ name: 'CDT-Stop', env, cron: '* * * * *' }); assert.equal(schedule.requests.length, 0);
  const bad = await run({ name: 'CDT-Stop', env: { ...env, control_confirm: 'wrong' } }); assert.equal(bad.requests.length, 0);
  const good = await run({ name: 'CDT-Stop', env });
  assert.ok(good.requests.some(v => new URLSearchParams(v.options.body).get('Action') === 'StopInstance'));
});
test('Egern network failure redacts errors and releases lease; blank Setup gives help', async () => {
  const r = await run({ failure: true });
  assert.equal(JSON.stringify(r.result).includes('testSecret'), false);
  assert.equal(r.store.has(C.LOCK_KEY), false);
  const setup = await run({ name: 'CDT-Setup', setup: true });
  assert.match(setup.result.children[0].text, /仅高级JSON导入/); assert.equal(setup.store.size, 0);
});
test('generated YAML structures declare actual defaults, pin scripts and keep control out of automatic UI', () => {
  assert.equal(moduleConfig.env_schema.access_key_id.default_value, '未设置');
  for (const entry of moduleConfig.scriptings) {
    const [kind, script] = Object.entries(entry)[0];
    assert.ok(script.script_url.includes('/v' + pkg.version + '/egern/'));
    assert.ok(script.script_url.includes('/CDT-Monitor-Plugins/'));
    if (kind === 'schedule') { assert.equal(script.name, 'CDT-Monitor'); assert.equal(script.env.control_confirm, undefined); }
  }
  assert.equal(stash['arguments-version'], 1);
  assert.equal(stash.tiles.length, 1); assert.equal(stash.tiles[0].name, 'CDT-Refresh');
  assert.equal(stash.cron.script.length, 1); assert.equal(stash.cron.script[0].name, 'CDT-Monitor');
  const argument = stash.cron.script[0].argument.replace(/\$\{args\.(\w+)\|json\}/g, (_, key) => JSON.stringify(stash.arguments[key].default));
  assert.equal(JSON.parse(argument).config_source, 'module');
  assert.equal(JSON.parse(argument).control_confirm, undefined);
});
test('Egern Setup imports and backs up local JSON; history is read-only and private', async () => {
  const config = C.validate({ accounts: [{ id: 'ecs-1', accessKeyId: 'testAK', accessKeySecret: 'testSecret', regionId: 'cn-hongkong', instanceId: 'i-test', maxTrafficGiB: 100 }] });
  const store = new Map();
  const env = { config_json: JSON.stringify(config) };
  await run({ name: 'CDT-Setup', setup: true, env, store });
  assert.ok(store.has(C.CONFIG_KEY));
  await run({ name: 'CDT-Setup', setup: true, env, store });
  assert.ok(store.has('cdt.local.config.backup.v1'));
  await run({ env: { config_source: 'local' }, store });
  const history = await run({ name: 'CDT-History', env: { config_source: 'local' }, store });
  assert.equal(history.requests.length, 0);
  assert.equal(JSON.stringify(history.result).includes('testSecret'), false);
  const blocked = await run({ name: 'CDT-Setup', setup: true, env, store: new Map(), widgetFamily: 'systemSmall' });
  assert.equal(blocked.store.size, 0);
});
test('Egern webhook retry retains events without repeating successful system notifications', async () => {
  const env = { webhook_enabled: 'true', webhook_url: 'https://example.invalid/hook' };
  const first = await run({ name: 'CDT-Notify-Test', env, hookFailure: true });
  assert.equal(JSON.parse(first.store.get('cdt.local.module-state.v1')).outbox.length, 1);
  const hook = first.requests.find(r => !new URLSearchParams(r.options.body).has('Action'));
  assert.equal(JSON.parse(hook.options.body).source, 'cdt-monitor-egern');
  const next = await run({ name: 'CDT-Monitor', cron: '*/10 * * * *', env, store: first.store });
  assert.equal(JSON.parse(next.store.get('cdt.local.module-state.v1')).outbox.length, 0);
  assert.equal(next.notices.length, 0);
});
