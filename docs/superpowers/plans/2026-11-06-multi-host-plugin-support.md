# 多宿主插件支持实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** alloy 通过双 manifest 支持 Claude Code / ZCode / Codex / WorkBuddy 四宿主安装，`/alloy:setup` 提供全自动注册（codex CLI 直装、workbuddy 自动写配置），本地实弹验证。

**Architecture:** 仓库根新增 `.codebuddy-plugin/`（workbuddy 专用 manifest，内容与 `.claude-plugin/` 同步）；新模块 `scripts/setup-hosts.js` 承载四宿主检测与注册（读为主并入 doctor，写操作独立成文件）；doctor 增加 manifest 一致性与宿主矩阵输出。

**Tech Stack:** Node.js（CommonJS，无新增依赖）、node:test

**Spec:** docs/superpowers/specs/2026-11-06-multi-host-plugin-support-design.md

## Global Constraints

- 双 manifest version 必须一致；本次发布版本 **0.4.0**（minor：新功能）。
- 不改 skills/commands 内容；不加 npm 依赖（CommonJS + 内置模块）。
- 所有写配置动作：写前备份（`.bak`）、写后 JSON.parse 校验、失败回滚。
- 幂等：已注册宿主跳过，setup 可重复跑。
- 测试注入：runner / homedir / root 均可注入，测试不碰真实宿主配置。
- workbuddy known_marketplaces 条目字段对齐样例：`manifestName/type/source{source,path}/installLocation/description/lastUpdated/autoUpdate/isBuiltIn`，其中 `isBuiltIn:false`。
- workbuddy installed_plugins 条目字段对齐样例：`scope/installPath/version/installedAt/lastUpdated`。

---

### Task 1: `.codebuddy-plugin/` 双 manifest + doctor 版本一致性检查

**Files:**
- Create: `.codebuddy-plugin/marketplace.json`
- Create: `.codebuddy-plugin/plugin.json`
- Modify: `scripts/doctor.js`（新增 `detectManifestSync`）
- Test: `scripts/doctor.test.js`

**Interfaces:**
- Produces: `detectManifestSync(root) -> { ok, detail }`（Task 5 的 doctor 输出与 setup 前置检查调用）

- [ ] **Step 1: 写失败测试**（doctor.test.js 追加）

```js
const { detectManifestSync } = require('./doctor.js');
const fs = require('fs'); const path = require('path'); const os = require('os');

test('detectManifestSync ok when versions match', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alloy-sync-'));
  for (const d of ['.claude-plugin', '.codebuddy-plugin']) {
    fs.mkdirSync(path.join(tmp, d));
    fs.writeFileSync(path.join(tmp, d, 'plugin.json'), JSON.stringify({ name: 'alloy', version: '0.4.0' }));
  }
  const r = detectManifestSync(tmp);
  assert.equal(r.ok, true);
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
  assert.equal(detectManifestSync(tmp).ok, false);
  fs.rmSync(tmp, { recursive: true, force: true });
});
```

- [ ] **Step 2: 跑测试确认失败** — `node --test scripts/doctor.test.js`，Expected: detectManifestSync is not a function
- [ ] **Step 3: 实现**（doctor.js 追加函数并导出）

```js
function detectManifestSync(root) {
  const read = (dir) => {
    try {
      return JSON.parse(fs.readFileSync(path.join(root, dir, 'plugin.json'), 'utf8')).version;
    } catch { return null; }
  };
  const claudeV = read('.claude-plugin');
  const cbV = read('.codebuddy-plugin');
  if (!claudeV) return { ok: false, detail: '.claude-plugin/plugin.json unreadable' };
  if (!cbV) return { ok: false, detail: '.codebuddy-plugin/plugin.json missing — workbuddy 支持未就绪' };
  if (claudeV !== cbV) return { ok: false, detail: `version mismatch: claude=${claudeV} codebuddy=${cbV}` };
  return { ok: true, detail: `v${claudeV} synced` };
}
```

（module.exports 增加 `detectManifestSync`）

- [ ] **Step 4: 跑测试确认通过** — 同 Step 2，Expected: 全 PASS
- [ ] **Step 5: 创建两份 manifest**

`.codebuddy-plugin/marketplace.json`（name 与 claude 版一致）：

```json
{
  "name": "alloy-marketplace",
  "description": "Alloy plugin marketplace (CodeBuddy/WorkBuddy)",
  "owner": { "name": "Alloy" },
  "plugins": [
    {
      "name": "alloy",
      "source": "./",
      "version": "0.4.0",
      "description": "六家精华 + 严格开发全流程（OpenSpec + Superpowers + CodeGraph + RTK + Caveman + Ponytail）",
      "description_en": "All-in-one coding plugin: OpenSpec + Superpowers + CodeGraph + RTK + Caveman + Ponytail with strict spec-driven workflow",
      "category": "productivity",
      "author": { "name": "Alloy" },
      "license": "MIT",
      "skills": ["./skills/alloy-orchestrator", "./skills/alloy-subagents", "./skills/caveman", "./skills/ponytail"],
      "commands": ["./commands"]
    }
  ]
}
```

`.codebuddy-plugin/plugin.json`（version 与 claude 版同步 0.4.0）：

```json
{
  "name": "alloy",
  "version": "0.4.0",
  "description": "六家精华合一的编码插件（同 claude 版描述）",
  "description_en": "All-in-one coding plugin: spec-driven workflow, TDD discipline, code graph, output compression, minimal output & minimal diff.",
  "author": { "name": "Alloy" },
  "license": "MIT",
  "category": "productivity",
  "keywords": ["openspec", "superpowers", "codegraph", "rtk", "caveman", "ponytail"],
  "commands": "./commands",
  "skills": "./skills"
}
```

（同时 `.claude-plugin/plugin.json` version → 0.4.0；`.claude-plugin/marketplace.json` 不动）

- [ ] **Step 6: 复跑 doctor.test 全绿 + 提交** `git commit -m "feat: 双 manifest 支持 workbuddy（.codebuddy-plugin/）+ doctor 版本一致性检查"`

### Task 2: doctor 宿主检测（四宿主矩阵）

**Files:**
- Modify: `scripts/doctor.js`（新增 `detectHosts`）
- Test: `scripts/doctor.test.js`

**Interfaces:**
- Consumes: `probe`（doctor 现有）
- Produces: `detectHosts({ probe, homedir }) -> [{ id, ok, registered, detail }]`（Task 5 render 与 setup-hosts 复用）

- [ ] **Step 1: 写失败测试**

```js
const { detectHosts } = require('./doctor.js');

test('detectHosts reports presence and registration per host', () => {
  const fs = require('fs'); const path = require('path'); const os = require('os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alloy-hosts-'));
  fs.mkdirSync(path.join(tmp, '.workbuddy', 'plugins'), { recursive: true });
  fs.writeFileSync(path.join(tmp, '.workbuddy', 'plugins', 'known_marketplaces.json'),
    JSON.stringify({ 'alloy-marketplace': { manifestName: 'alloy-marketplace' } }));
  const fakeProbe = (cmd) =>
    cmd.startsWith('claude') ? { ok: true, detail: '1.0' } : { ok: false, detail: 'not found' };
  const hosts = detectHosts({ probe: fakeProbe, homedir: tmp });
  const byId = Object.fromEntries(hosts.map((h) => [h.id, h]));
  assert.equal(byId.claude.ok, true);
  assert.equal(byId.zcode.ok, false);
  assert.equal(byId.workbuddy.ok, true);
  assert.equal(byId.workbuddy.registered, true);
  assert.equal(byId.codex.ok, false);
  fs.rmSync(tmp, { recursive: true, force: true });
});
```

- [ ] **Step 2: 跑测试确认失败**
- [ ] **Step 3: 实现**（doctor.js）

```js
function detectHosts({ probe = (c) => (c === 'node --version' ? { ok: true, detail: '' } : probeDefault(c)), homedir = os.homedir() } = {}) {
  // CLI 宿主：claude/zcode/codex 探测 <cli> --version；注册状态：
  //   claude/zcode → <cli> plugin list 输出含 alloy@；codex → config.toml 含 alloy@alloy-marketplace
  // workbuddy：~/.workbuddy/plugins/known_marketplaces.json 存在且含 alloy-marketplace 键
  const host = (id, ok, registered, detail) => ({ id, ok, registered, detail });
  const out = [];
  const cliHosts = [
    { id: 'claude', cmd: 'claude --version', listCmd: 'claude plugin list' },
    { id: 'zcode', cmd: 'zcode --version', listCmd: 'zcode plugins list' },
    { id: 'codex', cmd: 'codex --version' },
  ];
  for (const h of cliHosts) {
    const p = probe(h.cmd);
    if (!p.ok) { out.push(host(h.id, false, false, 'CLI not found')); continue; }
    let registered = false;
    if (h.listCmd) registered = probe(h.listCmd).detail.includes('alloy@');
    else {
      try {
        registered = fs.readFileSync(path.join(homedir, '.codex', 'config.toml'), 'utf8').includes('alloy@alloy-marketplace');
      } catch { registered = false; }
    }
    out.push(host(h.id, true, registered, registered ? 'alloy installed' : 'alloy not installed'));
  }
  let wbOk = false, wbReg = false;
  try {
    const km = JSON.parse(fs.readFileSync(path.join(homedir, '.workbuddy', 'plugins', 'known_marketplaces.json'), 'utf8'));
    wbOk = true; wbReg = Object.keys(km).includes('alloy-marketplace');
  } catch { /* host absent */ }
  out.push(host('workbuddy', wbOk, wbReg, !wbOk ? '~/.workbuddy not found' : wbReg ? 'alloy registered' : 'alloy not registered'));
  return out;
}
```

（probe 默认参数实现为：未注入时用模块内 probe；实现时保持签名 `detectHosts({ probe, homedir } = {})`，probe 缺省 = 模块 probe。）

- [ ] **Step 4: 跑测试通过**；**Step 5: 提交** `feat: doctor 四宿主检测矩阵`

### Task 3: setup-hosts.js——claude / zcode / codex 注册

**Files:**
- Create: `scripts/setup-hosts.js`
- Test: `scripts/setup-hosts.test.js`

**Interfaces:**
- Produces:
  - `registerCliHost(hostId, root, { runner }) -> { ok, detail, changed }`
  - `registerWorkbuddy(root, { homedir }) -> { ok, detail, changed }`（Task 4）
  - `setupHosts(root, { runner, homedir, probe }) -> [{ host, ok, detail, changed }]`

- [ ] **Step 1: 写失败测试**

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { registerCliHost } = require('./setup-hosts.js');

test('registerCliHost claude runs marketplace add then install', () => {
  const calls = [];
  const r = registerCliHost('claude', 'D:\\repo\\alloy', {
    runner: (cmd) => { calls.push(cmd); return { ok: true, detail: 'added' }; },
  });
  assert.equal(r.ok, true);
  assert.match(calls[0], /claude plugin marketplace add "D:\\\\?repo/);
  assert.match(calls[1], /claude plugin install alloy@alloy-marketplace/);
});

test('registerCliHost treats already-registered marketplace as success', () => {
  const r = registerCliHost('zcode', 'X:\\r', {
    runner: (cmd) => ({ ok: false, detail: cmd.includes('marketplace') ? 'marketplace already registered' : 'ok' }),
  });
  assert.equal(r.ok, true);
});

test('registerCliHost reports failure without throwing', () => {
  const r = registerCliHost('codex', 'X:\\r', { runner: () => ({ ok: false, detail: 'boom' }) });
  assert.equal(r.ok, false);
  assert.match(r.detail, /boom|marketplace/);
});
```

- [ ] **Step 2: 跑失败**；**Step 3: 实现**

```js
#!/usr/bin/env node
'use strict';
// 四宿主注册引擎：claude/zcode/codex 走各自 CLI；workbuddy 直写配置（备份+校验+回滚）。
// 幂等：已注册跳过。所有 runner 可注入，测试不碰真实环境。
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const MARKETPLACE = 'alloy-marketplace';
const PLUGIN = 'alloy';

const CLI_HOSTS = {
  claude: {
    add: (root) => `claude plugin marketplace add "${root}"`,
    install: () => `claude plugin install ${PLUGIN}@${MARKETPLACE}`,
    list: () => 'claude plugin list',
  },
  zcode: {
    add: (root) => `zcode plugins marketplace add "${root}"`,
    install: () => `zcode plugins install ${PLUGIN}@${MARKETPLACE}`,
    list: () => 'zcode plugins list',
  },
  codex: {
    add: (root) => `codex plugin marketplace add "${root}"`,
    install: () => `codex plugin add ${PLUGIN}@${MARKETPLACE}`,
    list: () => 'codex plugin list',
  },
};

const ALREADY = /already|exists|registered|up.to.date/i;

function runShell(cmd) {
  try {
    const out = execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000, maxBuffer: 4 * 1024 * 1024 });
    return { ok: true, detail: String(out).trim().split(/\r?\n/)[0].slice(0, 100) };
  } catch (err) {
    const detail = String((err.stdout || '') + (err.stderr || '')).trim().split(/\r?\n/)[0].slice(0, 100) || `exit ${err.status}`;
    return { ok: false, detail };
  }
}

function registerCliHost(hostId, root, { runner = runShell } = {}) {
  const h = CLI_HOSTS[hostId];
  if (!h) return { ok: false, detail: `unknown host: ${hostId}`, changed: false };
  const installed = runner(h.list());
  if (installed.ok && /alloy@/.test(installed.detail)) return { ok: true, detail: 'already installed', changed: false };
  const added = runner(h.add(root));
  if (!added.ok && !ALREADY.test(added.detail)) return { ok: false, detail: `marketplace add failed: ${added.detail}`, changed: false };
  const ins = runner(h.install());
  if (!ins.ok && !ALREADY.test(ins.detail)) return { ok: false, detail: `install failed: ${ins.detail}`, changed: !(!added.ok) };
  return { ok: true, detail: ins.ok ? ins.detail : 'already installed', changed: true };
}
```

（codex 降级路径：`registerCliHost('codex')` 失败时由 `setupHosts` 调 `appendCodexConfig(root, homedir)`——Task 3 只实现 CLI 路径 + `appendCodexConfig` 骨架并测降级。）

codex 降级实现与测试：

```js
function appendCodexConfig(root, homedir) {
  const cfg = path.join(homedir, '.codex', 'config.toml');
  try {
    if (fs.readFileSync(cfg, 'utf8').includes(`[plugins."${PLUGIN}@${MARKETPLACE}"]`)) return { ok: true, detail: 'already in config.toml', changed: false };
    const backup = cfg + '.alloy-bak';
    const original = fs.readFileSync(cfg, 'utf8');
    fs.writeFileSync(backup, original);
    const winRoot = root.startsWith('\\\\?\\') ? root : '\\\\?\\' + root;
    const ts = new Date().toISOString();
    const block = `\n[marketplaces.${MARKETPLACE}]\nlast_updated = "${ts}"\nsource_type = "local"\nsource = '${winRoot.replace(/'/g, "''")}'\n\n[plugins."${PLUGIN}@${MARKETPLACE}"]\nenabled = true\n`;
    fs.writeFileSync(cfg, original + block);
    return { ok: true, detail: 'config.toml updated (backup: config.toml.alloy-bak)', changed: true };
  } catch (e) {
    return { ok: false, detail: `config.toml update failed: ${e.message}`, changed: false };
  }
}
```

```js
test('appendCodexConfig appends local marketplace block with backup', () => {
  const fs = require('fs'); const path = require('path'); const os = require('os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alloy-codex-'));
  const dir = path.join(tmp, '.codex'); fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, 'config.toml'), '[tui]\nfoo = 1\n');
  const { appendCodexConfig } = require('./setup-hosts.js');
  const r = appendCodexConfig('D:\\repo\\alloy', tmp);
  assert.equal(r.ok, true);
  const txt = fs.readFileSync(path.join(dir, 'config.toml'), 'utf8');
  assert.match(txt, /\[marketplaces\.alloy-marketplace\]/);
  assert.match(txt, /source_type = "local"/);
  assert.match(txt, /\\\\\?\\D:\\\\?repo/);
  assert.ok(fs.existsSync(path.join(dir, 'config.toml.alloy-bak')));
  fs.rmSync(tmp, { recursive: true, force: true });
});
```

- [ ] **Step 4: 跑测试通过**；**Step 5: 提交** `feat: setup-hosts claude/zcode/codex CLI 注册 + codex config 降级`

### Task 4: setup-hosts.js——workbuddy 自动注册

**Files:**
- Modify: `scripts/setup-hosts.js`
- Test: `scripts/setup-hosts.test.js`

**Interfaces:**
- Consumes: 常量 MARKETPLACE/PLUGIN
- Produces: `registerWorkbuddy(root, { homedir }) -> { ok, detail, changed }`

- [ ] **Step 1: 写失败测试**

```js
const { registerWorkbuddy } = require('./setup-hosts.js');

function makeWbHome(tmp) {
  const plugins = path.join(tmp, '.workbuddy', 'plugins');
  fs.mkdirSync(plugins, { recursive: true });
  fs.writeFileSync(path.join(plugins, 'known_marketplaces.json'), JSON.stringify({
    'workbuddy-builtin': { manifestName: 'workbuddy-builtin', type: 'directory', isBuiltIn: true },
  }));
  fs.writeFileSync(path.join(plugins, 'installed_plugins.json'), JSON.stringify({
    version: 2, plugins: { 'ardot@workbuddy-builtin': [{ scope: 'user', installPath: 'C:\\x', version: '1', installedAt: 't', lastUpdated: 't' }] },
  }));
  return plugins;
}

test('registerWorkbuddy writes marketplace entry, cache copy and installed entry', () => {
  const fs = require('fs'); const path = require('path'); const os = require('os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alloy-wb-'));
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'alloy-src-'));
  fs.mkdirSync(path.join(repo, '.codebuddy-plugin'));
  fs.writeFileSync(path.join(repo, '.codebuddy-plugin', 'plugin.json'), JSON.stringify({ name: 'alloy', version: '0.4.0' }));
  fs.writeFileSync(path.join(repo, 'SKILL-PROBE.txt'), 'x');
  makeWbHome(tmp);
  const r = registerWorkbuddy(repo, { homedir: tmp });
  assert.equal(r.ok, true, r.detail);
  const plugins = path.join(tmp, '.workbuddy', 'plugins');
  const km = JSON.parse(fs.readFileSync(path.join(plugins, 'known_marketplaces.json'), 'utf8'));
  assert.equal(km['alloy-marketplace'].type, 'directory');
  assert.equal(km['alloy-marketplace'].isBuiltIn, false);
  assert.ok(fs.existsSync(path.join(plugins, 'known_marketplaces.json.alloy-bak')));
  const ip = JSON.parse(fs.readFileSync(path.join(plugins, 'installed_plugins.json'), 'utf8'));
  const entry = ip.plugins['alloy@alloy-marketplace'][0];
  assert.equal(entry.version, '0.4.0');
  assert.ok(fs.existsSync(path.join(entry.installPath, 'SKILL-PROBE.txt')));
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.rmSync(repo, { recursive: true, force: true });
});

test('registerWorkbuddy is idempotent and validates JSON before write', () => {
  const fs = require('fs'); const path = require('path'); const os = require('os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alloy-wb2-'));
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'alloy-src2-'));
  makeWbHome(tmp);
  const r1 = registerWorkbuddy(repo, { homedir: tmp });
  assert.equal(r1.ok, true);
  const r2 = registerWorkbuddy(repo, { homedir: tmp });
  assert.equal(r2.ok, true);
  assert.equal(r2.changed, false);
  // 损坏的 known_marketplaces.json → 拒绝写入
  const plugins = path.join(tmp, '.workbuddy', 'plugins');
  fs.writeFileSync(path.join(plugins, 'known_marketplaces.json'), '{broken');
  const r3 = registerWorkbuddy(repo, { homedir: tmp });
  assert.equal(r3.ok, false);
  assert.match(r3.detail, /invalid JSON|parse/i);
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.rmSync(repo, { recursive: true, force: true });
});
```

- [ ] **Step 2: 跑失败**；**Step 3: 实现**

```js
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (e.name === '.git' || e.name === 'logs') continue;
    const s = path.join(src, e.name), d = path.join(dest, e.name);
    if (e.isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
}

function registerWorkbuddy(root, { homedir = os.homedir() } = {}) {
  const plugins = path.join(homedir, '.workbuddy', 'plugins');
  const kmPath = path.join(plugins, 'known_marketplaces.json');
  const ipPath = path.join(plugins, 'installed_plugins.json');
  try {
    const km = JSON.parse(fs.readFileSync(kmPath, 'utf8'));
    if (km[MARKETPLACE]) return { ok: true, detail: 'marketplace already registered', changed: false };
    let manifest;
    try { manifest = JSON.parse(fs.readFileSync(path.join(root, '.codebuddy-plugin', 'plugin.json'), 'utf8')); }
    catch { return { ok: false, detail: 'repo missing .codebuddy-plugin/plugin.json', changed: false }; }
    const version = manifest.version;
    const cacheDir = path.join(plugins, 'cache', MARKETPLACE, PLUGIN, version);
    copyDir(root, cacheDir);
    fs.writeFileSync(kmPath + '.alloy-bak', JSON.stringify(km, null, 2));
    km[MARKETPLACE] = {
      manifestName: MARKETPLACE, type: 'directory',
      source: { source: 'directory', path: root },
      installLocation: root,
      description: `Marketplace from ${root}`,
      lastUpdated: new Date().toISOString(), autoUpdate: false, isBuiltIn: false,
    };
    fs.writeFileSync(kmPath, JSON.stringify(km, null, 2));
    let ip = { version: 2, plugins: {} };
    try { ip = JSON.parse(fs.readFileSync(ipPath, 'utf8')); } catch { /* 首装缺文件，用空结构 */ }
    const now = new Date().toISOString();
    const entry = { scope: 'user', installPath: cacheDir, version, installedAt: now, lastUpdated: now };
    if (ip.plugins && ip.plugins[`${PLUGIN}@${MARKETPLACE}`]) ip.plugins[`${PLUGIN}@${MARKETPLACE}`][0] = entry;
    else if (ip.plugins) ip.plugins[`${PLUGIN}@${MARKETPLACE}`] = [entry];
    else ip.plugins = { [`${PLUGIN}@${MARKETPLACE}`]: [entry] };
    fs.writeFileSync(ipPath + '.alloy-bak', JSON.stringify(ip, null, 2));
    fs.writeFileSync(ipPath, JSON.stringify(ip, null, 2));
    // 写后校验：两个 JSON 必须可解析，否则回滚
    for (const p of [kmPath, ipPath]) JSON.parse(fs.readFileSync(p, 'utf8'));
    return { ok: true, detail: `installed v${version}; 请打开 WorkBuddy 插件页确认 alloy 出现`, changed: true };
  } catch (e) {
    for (const p of [kmPath, ipPath]) {
      const bak = p + '.alloy-bak';
      try { if (fs.existsSync(bak)) fs.writeFileSync(p, fs.readFileSync(bak)); } catch { /* 保留现状 */ }
    }
    return { ok: false, detail: `workbuddy register failed: ${e.message}（已回滚）`, changed: false };
  }
}
```

- [ ] **Step 4: 跑测试通过**；**Step 5: 提交** `feat: workbuddy 自动注册（marketplace+installed+cache，备份回滚）`

### Task 5: setupHosts 总入口 + doctor/setup/status 接入

**Files:**
- Modify: `scripts/setup-hosts.js`（新增 `setupHosts`）
- Modify: `scripts/doctor.js`（render 接入宿主矩阵与 manifest 检查）
- Modify: `commands/setup.md`、`commands/status.md`
- Test: `scripts/setup-hosts.test.js`

**Interfaces:**
- Produces: `setupHosts(root, { runner, homedir }) -> [{ host, ok, detail, changed }]`；doctor 输出末尾追加宿主矩阵段

- [ ] **Step 1: 写失败测试**

```js
const { setupHosts } = require('./setup-hosts.js');

test('setupHosts covers four hosts and skips uninstalled CLIs', () => {
  const r = setupHosts('X:\\r', {
    runner: () => ({ ok: true, detail: 'done' }),
    probe: () => ({ ok: false, detail: 'not found' }),   // 三个 CLI 都不存在
    homedir: null,                                        // workbuddy 也跳过（homedir 不可用）
  });
  assert.deepEqual(r.map((x) => x.host), ['claude', 'zcode', 'codex', 'workbuddy']);
  assert.ok(r.every((x) => x.ok === false));
});
```

- [ ] **Step 2: 跑失败**；**Step 3: 实现**

```js
function setupHosts(root, { runner, homedir = os.homedir(), probe } = {}) {
  const out = [];
  for (const id of ['claude', 'zcode', 'codex']) {
    const cliOk = runShell ? undefined : undefined; // 探测走 doctor.detectHosts 或直接 probe
    const p = probe ? probe(`${id} --version`) : runShell(`${id} --version`);
    if (!p.ok) { out.push({ host: id, ok: false, detail: `${id} CLI 未安装，跳过`, changed: false }); continue; }
    out.push({ host: id, ...registerCliHost(id, root, { runner }) });
    // codex CLI 注册失败 → config.toml 降级
    if (id === 'codex' && !out[out.length - 1].ok && homedir) {
      const fb = appendCodexConfig(root, homedir);
      if (fb.ok) out[out.length - 1] = { host: id, ...fb };
    }
  }
  const wbHome = homedir && fs.existsSync(path.join(homedir, '.workbuddy')) ? homedir : null;
  out.push(wbHome
    ? { host: 'workbuddy', ...registerWorkbuddy(root, { homedir: wbHome }) }
    : { host: 'workbuddy', ok: false, detail: '~/.workbuddy 不存在，跳过', changed: false });
  return out;
}
```

（实现时清理骨架里无效的 `cliOk` 行。）

doctor.js `render` 末尾追加：

```js
  // 宿主矩阵 + manifest 同步（doctor 入口 checkAll 已含则省略；实现时在 checkAll 后追加独立段）
```

具体接入：doctor.js `if (require.main === module)` 块改为：

```js
if (require.main === module) {
  const results = checkAll();
  console.log(render(results));
  const root = path.resolve(__dirname, '..');
  console.log('\nmanifest:', detectManifestSync(root).detail);
  console.log('\nhosts:');
  for (const h of detectHosts({})) {
    console.log(`  ${h.ok ? (h.registered ? 'installed' : 'ok     ') : 'absent '}  ${h.id.padEnd(10)} ${h.detail}`);
  }
  process.exit(exitCode(results) || (detectManifestSync(root).ok ? 0 : 1));
}
```

`commands/setup.md` 步骤 1 后新增步骤：

```markdown
2. **多宿主注册**：运行 `node "${CLAUDE_PLUGIN_ROOT}/scripts/setup-hosts.js"`，按输出逐宿主确认（已装跳过、失败看降级提示）；宿主 CLI 缺失属正常，跳过即可。随后继续原步骤 2 的组件安装。
```

`commands/status.md` 末尾补一行：宿主矩阵说明（doctor 输出 hosts 段的含义）。

- [ ] **Step 4: 跑两个测试文件全绿**；**Step 5: 提交** `feat: setupHosts 总入口 + doctor/setup/status 宿主接入`

### Task 6: README 矩阵 + 实弹验证 + 发布

**Files:**
- Modify: `README.md`（快速开始节后加「多宿主安装」）
- Modify: `.claude-plugin/marketplace.json`（plugins[0].description 无需改；仅核对）

- [ ] **Step 1: README 多宿主安装矩阵**

在「快速开始」后插入：

```markdown
## 多宿主安装

同一仓库支持四个宿主；内容层（skills/commands）完全一致。

| 宿主 | 安装方式 | slash 命令 |
|---|---|---|
| Claude Code | `/plugin marketplace add <仓库>` → `/plugin install alloy@alloy-marketplace` | ✅ `/alloy:*` 全量 |
| ZCode | `zcode plugins marketplace add <仓库>` → `zcode plugins install alloy@alloy-marketplace` | ✅ `/alloy:*` 全量 |
| Codex | `codex plugin marketplace add <仓库>` → `codex plugin add alloy@alloy-marketplace` | 实测回填 |
| WorkBuddy | 设置→插件→本地 marketplace→选仓库目录→安装 alloy（或 `/alloy:setup` 自动注册） | 实测回填 |

一键注册到已安装的宿主：任一宿主里跑 `/alloy:setup`（自动检测并注册，幂等可重跑）。
```

- [ ] **Step 2: 实弹验证（本机）**

```bash
# 1. 测试全绿
node --test scripts/doctor.test.js scripts/setup-hosts.test.js

# 2. doctor 实跑（含新宿主矩阵）
node scripts/doctor.js

# 3. codex 实装
codex plugin marketplace add D:\code\agent\alloy
codex plugin add alloy@alloy-marketplace
codex plugin list   # 复核出现 alloy

# 4. workbuddy 实装（node 直接调注册函数）
node -e "console.log(JSON.stringify(require('./scripts/setup-hosts.js').registerWorkbuddy('D:\\\\code\\\\agent\\\\alloy', {}), null, 2))"
# 然后 JSON.parse 校验两个配置文件 + 提示用户开 WorkBuddy UI 确认

# 5. claude/zcode 回归
claude plugin list | grep alloy
zcode plugins list | grep alloy

# 6. 幂等回归：setup-hosts.js 实跑两遍，第二遍全跳过
```

- [ ] **Step 3: 回填 README「实测回填」两格**（codex/workbuddy commands 实际表现）
- [ ] **Step 4: 提交 + 双宿主更新插件**

```bash
git add -A && git commit -m "feat: 多宿主支持发布 0.4.0（双 manifest + setup 四宿主注册 + README 矩阵）"
claude plugin update alloy@alloy-marketplace
zcode plugins update alloy@alloy-marketplace
```

- [ ] **Step 5: workbuddy UI 确认**（提示用户：打开 WorkBuddy 插件页确认 alloy 出现并可加载）

## Self-Review

- Spec 覆盖：§3.1→Task1；§3.2 doctor 检测→Task2、四宿主注册→Task3/4/5、setup/status 接入→Task5；§3.3→Task6；§4 验证→各任务测试步 + Task6 实弹。无缺口。
- 占位符扫描：无 TBD/TODO；「实测回填」是 Task6 Step3 的显式交付项而非占位。
- 类型一致性：`registerCliHost(hostId, root, {runner})`、`registerWorkbuddy(root, {homedir})`、`setupHosts(root, {runner, homedir, probe})`、`detectManifestSync(root)`、`detectHosts({probe, homedir})` 各处签名一致。
