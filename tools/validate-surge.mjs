import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { renderModule, scriptArgument } from './module-format.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = '/Applications/Surge.app/Contents/Applications/surge-cli';
if (!fs.existsSync(cli)) throw new Error('Surge Mac CLI is not installed; Node tests remain available.');
for (const name of ['CDT-Monitor.sgmodule', 'CDT-Monitor-Mac.sgmodule', 'CDT-Monitor-Local.sgmodule', 'CDT-Monitor-Local-Mac.sgmodule']) {
  const module = renderModule(fs.readFileSync(path.join(root, name), 'utf8'));
  const file = path.join(root, '.validation.' + name + '.conf');
  fs.writeFileSync(file, '[General]\nloglevel=notify\n\n' + module + '\n[Rule]\nFINAL,DIRECT\n');
  const checked = spawnSync(cli, ['--check', file], { encoding: 'utf8', timeout: 20000 });
  process.stdout.write(name + ':\n' + checked.stdout + checked.stderr);
  if (checked.status !== 0) process.exit(1);
}
// Run the distributed script inside real Surge, with isolated mocks. No active profile
// changes, no writes to Surge storage and no outbound requests are possible.
const smoke = path.join(root, '.validation.smoke.js');
const source = fs.readFileSync(path.join(root, 'cdt-monitor.js'), 'utf8');
const initialArgument = scriptArgument(fs.readFileSync(path.join(root, 'CDT-Monitor-Mac.sgmodule'), 'utf8'), 'CDT-Panel');
fs.writeFileSync(smoke, `(function ($persistentStore, $httpClient, $notification, $argument, $input, $intent, $trigger) {\n${source}\n})({ read: function () { return null; }, write: function () { throw new Error('Unexpected storage write'); } }, { post: function () { throw new Error('Unexpected HTTP request'); } }, { post: function () { throw new Error('Unexpected notification'); } }, ${JSON.stringify(initialArgument)}, null, null, 'editor');\n`);
const evaluated = spawnSync(cli, ['script', 'evaluate', smoke, 'generic', '10'], { encoding: 'utf8', timeout: 20000 });
process.stdout.write('Native Surge smoke test:\n' + evaluated.stdout + evaluated.stderr);
if (evaluated.status !== 0 || !evaluated.stdout.includes('尚未配置')) process.exit(1);
const configuredSmoke = path.join(root, '.validation.configured-smoke.js');
const fakeConfig = { allowControl: true, accounts: [{ id: 'native-test', name: '原生模拟实例', accessKeyId: 'FAKEKEY', accessKeySecret: 'FAKESECRET', regionId: 'cn-hongkong', instanceId: 'i-fake', maxTrafficGiB: 100, thresholdAction: 'stop' }], notifications: { system: false } };
const nativeModuleArgument = scriptArgument(fs.readFileSync(path.join(root, 'CDT-Monitor-Mac.sgmodule'), 'utf8'), 'CDT-Monitor', {
  account_id: 'native-test', account_name: '原生模块参数实例', access_key_id: 'FAKEKEY', access_key_secret: 'FAKESECRET', instance_id: 'i-fake', max_traffic_gib: '100', allow_control: 'true', threshold_action: 'stop', system_notification: 'false'
});
fs.writeFileSync(configuredSmoke, `(function () {
  var fakeStore = { 'cdt.local.config.v1': ${JSON.stringify(JSON.stringify(fakeConfig))} };
  var queries = [];
  var mockStore = { read: function (key) { return fakeStore[key] || null; }, write: function (value, key) { if (value === null) delete fakeStore[key]; else fakeStore[key] = value; return true; } };
  var mockClient = { post: function (options, callback) {
    var params = {};
    options.body.split('&').forEach(function (pair) { var p = pair.indexOf('='); params[decodeURIComponent(pair.slice(0, p))] = decodeURIComponent(pair.slice(p + 1)); });
    queries.push(params.Action);
    var result = { RequestId: 'native-mock-only' };
    if (params.Action === 'ListCdtInternetTraffic') result.TrafficDetails = [{ BusinessRegionId: 'cn-hongkong', Traffic: 96 * 1073741824 }];
    else if (params.Action === 'DescribeInstanceStatus') {
      if (params['InstanceId.1'] !== 'i-fake') throw new Error('Instance filtering failed');
      result.InstanceStatuses = { InstanceStatus: [{ InstanceId: 'i-fake', Status: 'Running' }] };
    } else if (params.Action === 'StopInstance') {
      if (JSON.parse(fakeStore['cdt.local.module-state.v1']).accounts['native-test'].lastControl.status !== 'pending') throw new Error('Control was not reserved');
    } else throw new Error('Unexpected action');
    setTimeout(function () { callback(null, { status: 200 }, JSON.stringify(result)); }, 1);
  } };
  var realDone = $done;
  (function ($persistentStore, $httpClient, $notification, $argument, $input, $intent, $trigger, $done) {
${source}
    if (CDT.hmac('key', 'The quick brown fox jumps over the lazy dog') !== '3nybhbi3iqa8ino29wqQcBydtNk=') throw new Error('Native HMAC failed');
  })(mockStore, mockClient, { post: function () { throw new Error('Unexpected notification'); } }, ${JSON.stringify(nativeModuleArgument)}, null, null, 'editor', function (result) {
    var saved = JSON.parse(fakeStore['cdt.local.module-state.v1'] || '{}');
    if (!saved.accounts || saved.accounts['native-test'].lastControl.status !== 'accepted' || queries.join(',') !== 'ListCdtInternetTraffic,DescribeInstanceStatus,StopInstance') {
      realDone({ error: 'Native mock workflow failed', detail: result }); return;
    }
    realDone({ nativeMockPassed: true, queries: queries, panel: result });
  });
})();\n`);
const configured = spawnSync(cli, ['script', 'evaluate', configuredSmoke, 'generic', '10'], { encoding: 'utf8', timeout: 20000 });
process.stdout.write('Native Surge configured mock test:\n' + configured.stdout + configured.stderr);
if (configured.status !== 0 || !configured.stdout.includes('"nativeMockPassed" : true')) process.exit(1);
