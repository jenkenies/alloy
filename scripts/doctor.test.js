'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { probe, detectSuperpowers, detectManifestSync, checkAll, exitCode, render } = require('./doctor.js');
const fs = require('fs');
const path = require('path');
const os = require('os');

test('detectManifestSync ok when versions match', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alloy-sync-'));
  for (const d of ['.claude-plugin', '.codebuddy-plugin']) {
    fs.mkdirSync(path.join(tmp, d));
    fs.writeFileSync(path.join(tmp, d, 'plugin.json'), JSON.stringify({ name: 'alloy', version: '0.4.0' }));
  }
  const r = detectManifestSync(tmp);
  assert.equal(r.ok, true);
  assert.match(r.detail, /0\.4\.0/);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('detectManifestSync fails on version mismatch', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alloy-desync-'));
  fs.mkdirSync(path.join(tmp, '.claude-plugin'));
  fs.mkdirSync(path.join(tmp, '.codebuddy-plugin'));
  fs.writeFileSync(path.join(tmp, '.claude-plugin', 'plugin.json'), JSON.stringify({ version: '0.4.0' }));
  fs.writeFileSync(path.join(tmp, '.codebuddy-plugin', 'plugin.json'), JSON.stringify({ version: '0.3.3' }));
  const r = detectManifestSync(tmp);
  assert.equal(r.ok, false);
  assert.match(r.detail, /0\.3\.3/);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('detectManifestSync fails when .codebuddy-plugin missing', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alloy-nocb-'));
  fs.mkdirSync(path.join(tmp, '.claude-plugin'));
  fs.writeFileSync(path.join(tmp, '.claude-plugin', 'plugin.json'), JSON.stringify({ version: '0.4.0' }));
  const r = detectManifestSync(tmp);
  assert.equal(r.ok, false);
  assert.match(r.detail, /codebuddy/);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('probe finds node on PATH', () => {
  const r = probe('node --version');
  assert.equal(r.ok, true);
  assert.match(r.detail, /^v\d+/);
});

test('probe reports missing for bogus command', () => {
  const r = probe('definitely-not-a-real-tool-xyz --version');
  assert.equal(r.ok, false);
});

test('detectSuperpowers reads real installed_plugins.json without throwing', () => {
  const r = detectSuperpowers();
  assert.equal(typeof r.ok, 'boolean');
  assert.equal(typeof r.detail, 'string');
});

test('checkAll returns 6 components', () => {
  const results = checkAll({
    runner: () => ({ ok: true, detail: 'v1' }),
    superpowersRunner: () => ({ ok: true, detail: 'plugin installed' }),
  });
  assert.equal(results.length, 6);
  assert.deepEqual(
    results.map((r) => r.name).sort(),
    ['caveman', 'codegraph', 'openspec', 'ponytail', 'rtk', 'superpowers']
  );
});

test('all ok gives exit code 0', () => {
  const results = checkAll({
    runner: () => ({ ok: true, detail: 'v1' }),
    superpowersRunner: () => ({ ok: true, detail: 'ok' }),
  });
  assert.equal(exitCode(results), 0);
});

test('one missing external tool degrades to exit code 1', () => {
  const fake = (cmd) =>
    cmd.startsWith('rtk') ? { ok: false, detail: 'not found' } : { ok: true, detail: 'v1' };
  const results = checkAll({ runner: fake, superpowersRunner: () => ({ ok: true, detail: 'ok' }) });
  assert.equal(exitCode(results), 1);
  assert.equal(results.find((r) => r.name === 'rtk').ok, false);
});

test('embedded skills always ok even when everything else missing', () => {
  const results = checkAll({
    runner: () => ({ ok: false, detail: 'x' }),
    superpowersRunner: () => ({ ok: false, detail: 'x' }),
  });
  assert.ok(results.find((r) => r.name === 'caveman').ok);
  assert.ok(results.find((r) => r.name === 'ponytail').ok);
});

test('render marks MISSING rows and prints install hints', () => {
  const out = render([
    { name: 'rtk', ok: false, detail: 'not found', install: 'brew install rtk' },
    { name: 'caveman', ok: true, detail: 'embedded in alloy', install: 'none' },
  ]);
  assert.match(out, /MISSING\s+rtk/);
  assert.match(out, /brew install rtk/);
  assert.match(out, /ok\s+caveman/);
});

test('probe strips trailing CR from CRLF output', () => {
  const r = probe('node -e "process.stdout.write(\'v1.2.3\\r\\n\')"');
  assert.equal(r.ok, true);
  assert.equal(r.detail, 'v1.2.3');
});

test('detectSuperpowers matches array structure of installed_plugins.json', () => {
  const os = require('os');
  const fs = require('fs');
  const path = require('path');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alloy-super-'));
  const dir = path.join(tmp, '.claude', 'plugins');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'installed_plugins.json'),
    JSON.stringify({ plugins: [{ name: 'superpowers', version: '3.0.0' }] })
  );
  const r = detectSuperpowers(tmp);
  assert.equal(r.ok, true);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('detectSuperpowers returns false when superpowers absent (object structure)', () => {
  const os = require('os');
  const fs = require('fs');
  const path = require('path');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alloy-nosuper-'));
  const dir = path.join(tmp, '.claude', 'plugins');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'installed_plugins.json'),
    JSON.stringify({ plugins: { 'other-plugin@1.0.0': { name: 'other-plugin' } } })
  );
  const r = detectSuperpowers(tmp);
  assert.equal(r.ok, false);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('probe reports failure detail for existing command with non-zero exit', () => {
  const r = probe('node -e "process.exit(3)"');
  assert.equal(r.ok, false);
  assert.match(r.detail, /failed/);
});
