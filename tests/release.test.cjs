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
    assert.match(url, /\/refs\/heads\/main\/(surge|loon|egern|stash)\/CDT-Monitor(?:-Mac)?\.(sgmodule|plugin|yaml|stoverride)$/);
    assert.ok(list.includes(url));
  }
});

test('release notes and documented installation URLs never recommend pinned modules', async () => {
  const { releaseInfo } = await import('../tools/release-info.mjs');
  const info = releaseInfo(pkg);
  const notes = execFileSync(process.execPath, [require.resolve('../tools/release-notes.mjs')], { encoding: 'utf8' });
  for (const text of [notes, fs.readFileSync(require.resolve('../README.md'), 'utf8')]) {
    for (const url of Object.values(info.install)) assert.ok(text.includes(url));
    assert.doesNotMatch(text, /https:\/\/raw\.githubusercontent\.com\/[^\s)]+\/v\d+\.\d+\.\d+\/CDT-Monitor[^\s)]*\.sgmodule/);
  }
});

test('moved platform documentation and Surge URL schemes point to the new locations', async () => {
  const path = require('node:path');
  const root = path.resolve(__dirname, '..');
  for (const file of ['README.md', 'surge/README.md', 'surge/安装说明.md', 'loon/README.md', 'egern/README.md', 'stash/README.md']) {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    for (const [, link] of text.matchAll(/\]\(([^)]+)\)/g)) {
      if (/^[a-z]+:|^#/i.test(link)) continue;
      assert.ok(fs.existsSync(path.resolve(root, path.dirname(file), link.split('#')[0])), file + ': ' + link);
    }
  }
  const { releaseInfo } = await import('../tools/release-info.mjs');
  const info = releaseInfo(pkg);
  const guide = fs.readFileSync(path.join(root, 'surge/安装说明.md'), 'utf8');
  for (const url of [info.install.ios, info.install.mac]) {
    assert.ok(guide.includes(url));
    assert.ok(guide.includes(encodeURIComponent(url)));
  }
});
