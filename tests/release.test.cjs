const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const pkg = require('../package.json');

test('version upgrades keep module installation URLs stable while advancing runtime URLs', async () => {
  const { releaseInfo } = await import('../tools/release-info.mjs');
  const current = releaseInfo(pkg);
  const next = releaseInfo({ ...pkg, version: '99.0.0' });
  assert.deepEqual(next.install, current.install);
  assert.notEqual(next.scriptRoot, current.scriptRoot);
  const list = fs.readFileSync(require.resolve('../INSTALL-URLS.txt'), 'utf8');
  for (const url of Object.values(current.install)) {
    assert.match(url, /\/refs\/heads\/main\/CDT-Monitor(?:-Mac)?\.sgmodule$/);
    assert.ok(list.includes(url));
  }
});

test('release notes and documented installation URLs never recommend pinned modules', async () => {
  const { releaseInfo } = await import('../tools/release-info.mjs');
  const info = releaseInfo(pkg);
  const notes = execFileSync(process.execPath, [require.resolve('../tools/release-notes.mjs')], { encoding: 'utf8' });
  for (const text of [notes, ...['README.md', '安装说明.md'].map(name => fs.readFileSync(require.resolve('../' + name), 'utf8'))]) {
    for (const url of Object.values(info.install)) assert.ok(text.includes(url));
    assert.doesNotMatch(text, /https:\/\/raw\.githubusercontent\.com\/[^\s)]+\/v\d+\.\d+\.\d+\/CDT-Monitor[^\s)]*\.sgmodule/);
  }
});
