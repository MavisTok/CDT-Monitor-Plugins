const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const C = require('../src/core.js');
const parameters = require('../src/module-parameters.json');
const defaults = Object.fromEntries(parameters.map(p => [p.key, p.default]));
vm.runInNewContext(fs.readFileSync(require.resolve('../src/module-config.js'), 'utf8'), { CDT: C, MODULE_PARAMETER_DEFAULTS: defaults });
const source = fs.readFileSync(require.resolve('../surge/CDT-Monitor.sgmodule'), 'utf8');
const moduleNames = ['CDT-Monitor.sgmodule', 'CDT-Monitor-Mac.sgmodule', 'CDT-Monitor-Local.sgmodule', 'CDT-Monitor-Local-Mac.sgmodule'];

test('module metadata starts at byte zero and fields propagate to every runtime script', async () => {
  const { defaultsFromModule, scriptArgument } = await import('../tools/module-format.mjs');
  for (const name of moduleNames) {
    const module = fs.readFileSync(require.resolve('../surge/' + name), 'utf8');
    assert.match(module, /^#!name=CDT Monitor 本地版\n#!desc=v\d+\.\d+\.\d+ .+\n/, name);
    const header = module.split('\n\n')[0].split('\n');
    assert.ok(header.every(line => line.startsWith('#!')), name + ': uninterrupted metadata header');
    assert.deepEqual({ ...defaultsFromModule(module) }, defaults, name);
    assert.ok(Object.values(defaultsFromModule(module)).every(value => typeof value === 'string' && value.length > 0), name + ': no missing argument defaults');
    for (const script of ['CDT-Panel', 'CDT-Monitor', 'CDT-Refresh', 'CDT-Control', 'CDT-History', 'CDT-Notify-Test']) {
      const argument = scriptArgument(module, script, { access_key_id: 'testAK', access_key_secret: 'testSecret' });
      const parsed = C.parseModuleArguments(argument);
      assert.equal(parsed.source, 'module'); assert.equal(parsed.config.accounts[0].accessKeyId, 'testAK');
      assert.equal(argument.split('|').length, parameters.length + 2);
    }
  }
});
test('installable modules use release-pinned GitHub scripts; local variants remain portable', () => {
  const pkg = require('../package.json');
  const repo = pkg.repository.url.replace('https://github.com/', '').replace(/\.git$/, '');
  for (const name of moduleNames) {
    const module = fs.readFileSync(require.resolve('../surge/' + name), 'utf8');
    const scripts = [...module.matchAll(/script-path="([^"]+)"/g)].map(match => match[1]);
    assert.equal(scripts.length, 7, name);
    for (const script of scripts) {
      const file = script.endsWith('cdt-setup.js') ? 'cdt-setup.js' : 'cdt-monitor.js';
      assert.equal(script, name.includes('-Local') ? file : `https://raw.githubusercontent.com/${repo}/v${pkg.version}/surge/${file}`, name);
      assert.ok(fs.existsSync(require.resolve('../surge/' + file)));
    }
    assert.equal(module.includes('wake-system=true'), !name.includes('-Mac'), name);
    assert.equal(module.includes('#!system=mac'), name.includes('-Mac'), name);
  }
});
test('parameter transport preserves URL queries, punctuation, Unicode and empty fields', async () => {
  const { scriptArgument } = await import('../tools/module-format.mjs');
  const argument = scriptArgument(source, 'CDT-Panel', {
    access_key_id: 'testAK', access_key_secret: 'a+/=&%20secret', account_name: '香港 ECS, 100% & A=B',
    webhook_enabled: 'true', webhook_url: 'https://example.invalid/hook?a=1&b=x%20y+z', webhook_authorization: 'Bearer abc+/=', daily_report_time: '关闭'
  });
  const config = C.parseModuleArguments(argument).config;
  assert.equal(config.accounts[0].accessKeySecret, 'a+/=&%20secret');
  assert.equal(config.accounts[0].name, '香港 ECS, 100% & A=B');
  assert.equal(config.notifications.webhook.url, 'https://example.invalid/hook?a=1&b=x%20y+z');
  assert.equal(config.notifications.webhook.headers.Authorization, 'Bearer abc+/=');
  assert.equal(config.dailyReportTime, '');
});
test('only complete reserved optional values are cleared; required empty substitutions fail validation', async () => {
  const { scriptArgument, renderModule } = await import('../tools/module-format.mjs');
  const parsed = C.parseModuleArguments(scriptArgument(source, 'CDT-Panel', {
    access_key_id: 'testAK', access_key_secret: 'abc未设置XYZ', account_name: '未设置', daily_report_time: '关闭'
  })).config;
  assert.equal(parsed.accounts[0].accessKeySecret, 'abc未设置XYZ');
  assert.equal(parsed.accounts[0].name, '未设置');
  assert.equal(parsed.accounts[0].instanceId, '');
  assert.equal(parsed.notifications.telegram.botToken, '');
  assert.equal(parsed.notifications.webhook.url, '');
  assert.deepEqual(Object.keys(parsed.notifications.webhook.headers), []);
  assert.equal(parsed.dailyReportTime, '');
  assert.throws(() => renderModule(source, { access_key_secret: '' }), /Missing module argument value/);
});
test('malformed parameter payloads and unresolved placeholders cannot enable control', async () => {
  const { scriptArgument } = await import('../tools/module-format.mjs');
  const valid = scriptArgument(source, 'CDT-Panel', { access_key_id: 'testAK', access_key_secret: 'testSecret' });
  for (const tail of ['|allow_control=true', '|injected=true']) assert.throws(() => C.parseModuleArguments(valid + tail));
  for (const value of ['{{{access_key_id}}}', 'x"y', 'x\ny']) assert.throws(() => C.parseModuleArguments(valid.replace('access_key_id=testAK', 'access_key_id=' + value)));
  assert.throws(() => C.parseModuleArguments(valid.replace('max_traffic_gib=200', 'max_traffic_gib=')));
});
