'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { registerCliHost, appendCodexConfig } = require('./setup-hosts.js');
const fs = require('fs');
const path = require('path');
const os = require('os');

test('registerCliHost claude runs marketplace add then install', () => {
  const calls = [];
  const r = registerCliHost('claude', 'D:\\repo\\alloy', {
    runner: (cmd) => {
      calls.push(cmd);
      return cmd.includes('list') ? { ok: true, detail: 'no alloy here' } : { ok: true, detail: 'added' };
    },
  });
  assert.equal(r.ok, true);
  assert.match(calls[0], /claude plugin list/);
  assert.match(calls[1], /claude plugin marketplace add "D:\\repo\\alloy"/);
  assert.match(calls[2], /claude plugin install alloy@alloy-marketplace/);
});

test('registerCliHost skips install when already installed', () => {
  const calls = [];
  const r = registerCliHost('zcode', 'X:\\r', {
    runner: (cmd) => {
      calls.push(cmd);
      return cmd.includes('list') ? { ok: true, detail: 'alloy@alloy-marketplace 0.3.3' } : { ok: true, detail: '' };
    },
  });
  assert.equal(r.ok, true);
  assert.equal(r.changed, false);
  assert.equal(calls.length, 1);
});

test('registerCliHost treats already-registered marketplace as success', () => {
  const r = registerCliHost('zcode', 'X:\\r', {
    runner: (cmd) => ({
      ok: false,
      detail: cmd.includes('marketplace') ? 'marketplace already registered' : 'boom',
    }),
  });
  assert.equal(r.ok, true);
});

test('registerCliHost reports failure without throwing', () => {
  const r = registerCliHost('codex', 'X:\\r', { runner: () => ({ ok: false, detail: 'boom' }) });
  assert.equal(r.ok, false);
  assert.match(r.detail, /boom|marketplace/);
});

test('registerCliHost rejects unknown host', () => {
  const r = registerCliHost('unknown', 'X:\\r', { runner: () => ({ ok: true, detail: '' }) });
  assert.equal(r.ok, false);
});

test('appendCodexConfig appends local marketplace block with backup', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alloy-codex-'));
  const dir = path.join(tmp, '.codex');
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, 'config.toml'), '[tui]\nfoo = 1\n');
  const r = appendCodexConfig('D:\\repo\\alloy', tmp);
  assert.equal(r.ok, true);
  const txt = fs.readFileSync(path.join(dir, 'config.toml'), 'utf8');
  assert.match(txt, /\[marketplaces\.alloy-marketplace\]/);
  assert.match(txt, /source_type = "local"/);
  assert.match(txt, /\\\\\?\\D:\\repo\\alloy/);
  assert.match(txt, /\[plugins\."alloy@alloy-marketplace"\]/);
  assert.ok(fs.existsSync(path.join(dir, 'config.toml.alloy-bak')));
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('appendCodexConfig is idempotent', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alloy-codex2-'));
  const dir = path.join(tmp, '.codex');
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, 'config.toml'), 'x = 1\n');
  assert.equal(appendCodexConfig('D:\\r', tmp).ok, true);
  const r2 = appendCodexConfig('D:\\r', tmp);
  assert.equal(r2.ok, true);
  assert.equal(r2.changed, false);
  const txt = fs.readFileSync(path.join(dir, 'config.toml'), 'utf8');
  assert.equal((txt.match(/\[marketplaces\.alloy-marketplace\]/g) || []).length, 1);
  fs.rmSync(tmp, { recursive: true, force: true });
});
