'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { registerCliHost, appendCodexConfig, registerWorkbuddy, setupHosts } = require('./setup-hosts.js');
const fs = require('fs');
const path = require('path');
const os = require('os');

function makeWbHome(tmp) {
  const plugins = path.join(tmp, '.workbuddy', 'plugins');
  fs.mkdirSync(plugins, { recursive: true });
  fs.writeFileSync(
    path.join(plugins, 'known_marketplaces.json'),
    JSON.stringify({
      'workbuddy-builtin': { manifestName: 'workbuddy-builtin', type: 'directory', isBuiltIn: true },
    })
  );
  fs.writeFileSync(
    path.join(plugins, 'installed_plugins.json'),
    JSON.stringify({
      version: 2,
      plugins: {
        'ardot@workbuddy-builtin': [
          { scope: 'user', installPath: 'C:\\x', version: '1', installedAt: 't', lastUpdated: 't' },
        ],
      },
    })
  );
  return plugins;
}

function makeRepo(tmp, prefix) {
  const repo = fs.mkdtempSync(path.join(tmp, prefix));
  fs.mkdirSync(path.join(repo, '.codebuddy-plugin'));
  fs.writeFileSync(
    path.join(repo, '.codebuddy-plugin', 'plugin.json'),
    JSON.stringify({ name: 'alloy', version: '0.4.0' })
  );
  fs.writeFileSync(path.join(repo, 'SKILL-PROBE.txt'), 'x');
  return repo;
}

test('registerWorkbuddy writes marketplace entry, cache copy and installed entry', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alloy-wb-'));
  const repo = makeRepo(tmp, 'alloy-src-');
  makeWbHome(tmp);
  const r = registerWorkbuddy(repo, { homedir: tmp });
  assert.equal(r.ok, true, r.detail);
  const plugins = path.join(tmp, '.workbuddy', 'plugins');
  const km = JSON.parse(fs.readFileSync(path.join(plugins, 'known_marketplaces.json'), 'utf8'));
  assert.equal(km['alloy-marketplace'].type, 'directory');
  assert.equal(km['alloy-marketplace'].source.path, repo);
  assert.equal(km['alloy-marketplace'].installLocation, repo);
  assert.equal(km['alloy-marketplace'].isBuiltIn, false);
  assert.ok(fs.existsSync(path.join(plugins, 'known_marketplaces.json.alloy-bak')));
  const ip = JSON.parse(fs.readFileSync(path.join(plugins, 'installed_plugins.json'), 'utf8'));
  const entry = ip.plugins['alloy@alloy-marketplace'][0];
  assert.equal(entry.version, '0.4.0');
  assert.equal(entry.scope, 'user');
  assert.ok(fs.existsSync(path.join(entry.installPath, 'SKILL-PROBE.txt')));
  assert.ok(fs.existsSync(path.join(entry.installPath, '.codebuddy-plugin', 'plugin.json')));
  assert.ok(fs.existsSync(path.join(plugins, 'installed_plugins.json.alloy-bak')));
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.rmSync(repo, { recursive: true, force: true });
});

test('registerWorkbuddy is idempotent', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alloy-wb2-'));
  const repo = makeRepo(tmp, 'alloy-src2-');
  makeWbHome(tmp);
  assert.equal(registerWorkbuddy(repo, { homedir: tmp }).ok, true);
  const r2 = registerWorkbuddy(repo, { homedir: tmp });
  assert.equal(r2.ok, true);
  assert.equal(r2.changed, false);
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.rmSync(repo, { recursive: true, force: true });
});

test('registerWorkbuddy refuses broken JSON', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alloy-wb3-'));
  const repo = makeRepo(tmp, 'alloy-src3-');
  const plugins = makeWbHome(tmp);
  fs.writeFileSync(path.join(plugins, 'known_marketplaces.json'), '{broken');
  const r = registerWorkbuddy(repo, { homedir: tmp });
  assert.equal(r.ok, false);
  assert.match(r.detail, /invalid JSON|parse/i);
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.rmSync(repo, { recursive: true, force: true });
});

test('registerWorkbuddy reports repo missing manifest', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alloy-wb4-'));
  const bare = fs.mkdtempSync(path.join(tmp, 'bare-'));
  makeWbHome(tmp);
  const r2 = registerWorkbuddy(bare, { homedir: tmp }); // repo 没有 .codebuddy-plugin
  assert.equal(r2.ok, false);
  assert.match(r2.detail, /missing .codebuddy-plugin/);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('setupHosts covers four hosts, skips absent CLIs and absent workbuddy', () => {
  const r = setupHosts('X:\\r', {
    runner: () => ({ ok: true, detail: 'done' }),
    probe: () => ({ ok: false, detail: 'not found' }), // 三个 CLI 都不存在
    homedir: null, // workbuddy 目录不可见 → 跳过
  });
  assert.deepEqual(r.map((x) => x.host), ['claude', 'zcode', 'codex', 'workbuddy']);
  assert.ok(r.every((x) => x.ok === false));
  assert.match(r[3].detail, /跳过/);
});

test('setupHosts registers CLI hosts when present and falls back for codex', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alloy-sh-'));
  fs.mkdirSync(path.join(tmp, '.codex'), { recursive: true });
  fs.writeFileSync(path.join(tmp, '.codex', 'config.toml'), 'x = 1\n');
  let codexAddFailed = false;
  const r = setupHosts('D:\\repo', {
    runner: (cmd) => {
      // codex 的 CLI 全部失败，触发 config.toml 降级
      if (cmd.startsWith('codex')) {
        codexAddFailed = true;
        return { ok: false, detail: 'boom' };
      }
      return { ok: true, detail: 'done' };
    },
    probe: (cmd) => ({ ok: true, detail: 'v1' }), // 三个 CLI 都存在
    homedir: tmp,
    // workbuddy 目录不存在 → 跳过
  });
  const byHost = Object.fromEntries(r.map((x) => [x.host, x]));
  assert.equal(byHost.claude.ok, true);
  assert.equal(byHost.zcode.ok, true);
  assert.equal(byHost.codex.ok, true);
  assert.match(byHost.codex.detail, /config\.toml/);
  const txt = fs.readFileSync(path.join(tmp, '.codex', 'config.toml'), 'utf8');
  assert.match(txt, /\[marketplaces\.alloy-marketplace\]/);
  assert.equal(byHost.workbuddy.ok, false);
  fs.rmSync(tmp, { recursive: true, force: true });
});

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
      return cmd.includes('list') ? { ok: true, detail: 'plugins:\n- alloy@alloy-marketplace [enabled]' } : { ok: true, detail: '' };
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
