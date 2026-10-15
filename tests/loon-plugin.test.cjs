const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const pkg = require('../package.json');
const text = fs.readFileSync(require.resolve('../loon/CDT-Monitor.plugin'), 'utf8');
test('Loon plugin binds declared arguments and reserves control fields for generic entries', () => {
  assert.match(text, /^#!name=CDT Monitor/);
  assert.match(text, /#!loon_version=3\.5\.1\(983\)/);
  const declared = new Set([...text.matchAll(/^(\w+) = input,/gm)].map(m => m[1]));
  const scripts = text.split('[Script]\n')[1].trim().split('\n').filter(line => !line.startsWith('#'));
  assert.equal(scripts.length, 7);
  assert.equal(scripts.filter(l => l.startsWith('cron ')).length, 1);
  for (const line of scripts) {
    for (const m of line.matchAll(/\$\{(\w+)\}/g)) assert.ok(declared.has(m[1]));
    assert.ok(line.includes(`/v${pkg.version}/loon/`));
    if (/tag="CDT-(Start|Stop)"/.test(line)) {
      assert.ok(line.startsWith('generic then '));
      assert.ok(line.includes('${control_confirm}'));
      assert.ok(line.includes('${control_account}'));
    } else assert.ok(!line.includes('${control_confirm}'));
  }
});
