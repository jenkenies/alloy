'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { probe, detectSuperpowers, checkAll, exitCode, render } = require('./doctor.js');

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
