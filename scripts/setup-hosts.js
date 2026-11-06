#!/usr/bin/env node
'use strict';
// 四宿主注册引擎：claude/zcode/codex 走各自 CLI；workbuddy 直写配置（备份+校验+回滚）。
// 幂等：已注册跳过。runner/homedir 可注入，测试不碰真实环境。
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

// 各宿主 CLI 对"已注册/已安装"的提示措辞不一，宽松匹配
const ALREADY = /already|exists|registered|up.to.date|installed/i;

function runShell(cmd) {
  try {
    const out = execSync(cmd, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 30000,
      maxBuffer: 4 * 1024 * 1024,
    });
    return { ok: true, detail: String(out).trim().split(/\r?\n/)[0].slice(0, 100) };
  } catch (err) {
    const detail =
      String((err.stdout || '') + (err.stderr || ''))
        .trim()
        .split(/\r?\n/)[0]
        .slice(0, 100) || `exit ${err.status}`;
    return { ok: false, detail };
  }
}

function registerCliHost(hostId, root, { runner = runShell } = {}) {
  const h = CLI_HOSTS[hostId];
  if (!h) return { ok: false, detail: `unknown host: ${hostId}`, changed: false };
  const installed = runner(h.list());
  if (installed.ok && /alloy@/.test(installed.detail)) {
    return { ok: true, detail: 'already installed', changed: false };
  }
  const added = runner(h.add(root));
  if (!added.ok && !ALREADY.test(added.detail)) {
    return { ok: false, detail: `marketplace add failed: ${added.detail}`, changed: false };
  }
  const ins = runner(h.install());
  if (!ins.ok && !ALREADY.test(ins.detail)) {
    return { ok: false, detail: `install failed: ${ins.detail}`, changed: !added.ok ? false : true };
  }
  return { ok: true, detail: ins.ok ? ins.detail : 'already installed', changed: true };
}

// codex CLI 降级：直接追加 config.toml（备份后追加新表段，TOML 追加新表安全）
function appendCodexConfig(root, homedir = os.homedir()) {
  const cfg = path.join(homedir, '.codex', 'config.toml');
  try {
    const original = fs.readFileSync(cfg, 'utf8');
    if (original.includes(`[plugins."${PLUGIN}@${MARKETPLACE}"]`)) {
      return { ok: true, detail: 'already in config.toml', changed: false };
    }
    fs.writeFileSync(cfg + '.alloy-bak', original);
    const winRoot = root.startsWith('\\\\?\\') ? root : '\\\\?\\' + root;
    const ts = new Date().toISOString();
    const block =
      `\n[marketplaces.${MARKETPLACE}]\nlast_updated = "${ts}"\nsource_type = "local"\n` +
      `source = '${winRoot.replace(/'/g, "''")}'\n\n[plugins."${PLUGIN}@${MARKETPLACE}"]\nenabled = true\n`;
    fs.writeFileSync(cfg, original + block);
    return { ok: true, detail: 'config.toml updated (backup: config.toml.alloy-bak)', changed: true };
  } catch (e) {
    return { ok: false, detail: `config.toml update failed: ${e.message}`, changed: false };
  }
}

// workbuddy：模拟 UI 安装——注册 directory marketplace + 复制插件到 cache + 追加 installed 条目。
// 全程备份（.alloy-bak）、写后 JSON 校验、失败回滚。
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (e.name === '.git' || e.name === 'logs') continue;
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function registerWorkbuddy(root, { homedir = os.homedir() } = {}) {
  const plugins = path.join(homedir, '.workbuddy', 'plugins');
  const kmPath = path.join(plugins, 'known_marketplaces.json');
  const ipPath = path.join(plugins, 'installed_plugins.json');
  let kmOriginal = null;
  let ipOriginal = null;
  try {
    try {
      kmOriginal = fs.readFileSync(kmPath, 'utf8');
      JSON.parse(kmOriginal); // 损坏的 JSON 直接拒绝，不盲写
    } catch {
      throw new Error(`known_marketplaces.json invalid JSON — refuse to write`);
    }
    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(path.join(root, '.codebuddy-plugin', 'plugin.json'), 'utf8'));
    } catch {
      throw new Error(`repo missing .codebuddy-plugin/plugin.json: ${root}`);
    }
    const version = manifest.version;
    const cacheDir = path.join(plugins, 'cache', MARKETPLACE, PLUGIN, version);
    if (kmOriginal && JSON.parse(kmOriginal)[MARKETPLACE]) {
      return { ok: true, detail: 'marketplace already registered', changed: false };
    }
    copyDir(root, cacheDir);
    fs.writeFileSync(kmPath + '.alloy-bak', kmOriginal);
    const km = JSON.parse(kmOriginal);
    km[MARKETPLACE] = {
      manifestName: MARKETPLACE,
      type: 'directory',
      source: { source: 'directory', path: root },
      installLocation: root,
      description: `Marketplace from ${root}`,
      lastUpdated: new Date().toISOString(),
      autoUpdate: false,
      isBuiltIn: false,
    };
    fs.writeFileSync(kmPath, JSON.stringify(km, null, 2));

    try {
      ipOriginal = fs.readFileSync(ipPath, 'utf8');
    } catch {
      ipOriginal = JSON.stringify({ version: 2, plugins: {} });
    }
    fs.writeFileSync(ipPath + '.alloy-bak', ipOriginal);
    const ip = JSON.parse(ipOriginal);
    if (!ip.plugins) ip.plugins = {};
    const now = new Date().toISOString();
    const entry = { scope: 'user', installPath: cacheDir, version, installedAt: now, lastUpdated: now };
    if (Array.isArray(ip.plugins[`${PLUGIN}@${MARKETPLACE}`])) {
      ip.plugins[`${PLUGIN}@${MARKETPLACE}`][0] = entry;
    } else {
      ip.plugins[`${PLUGIN}@${MARKETPLACE}`] = [entry];
    }
    fs.writeFileSync(ipPath, JSON.stringify(ip, null, 2));

    // 写后校验：两个文件必须仍是可解析 JSON，否则回滚
    JSON.parse(fs.readFileSync(kmPath, 'utf8'));
    JSON.parse(fs.readFileSync(ipPath, 'utf8'));
    return {
      ok: true,
      detail: `installed v${version}; 请打开 WorkBuddy 插件页确认 alloy 出现`,
      changed: true,
    };
  } catch (e) {
    for (const [p, orig] of [[kmPath, kmOriginal], [ipPath, ipOriginal]]) {
      try {
        if (orig !== null) fs.writeFileSync(p, orig);
      } catch {
        // 回滚尽力而为
      }
    }
    return { ok: false, detail: `workbuddy register failed: ${e.message}（已回滚）`, changed: false };
  }
}

// 总入口：依次注册四宿主。CLI 缺失/workbuddy 不存在则跳过；codex CLI 失败时降级写 config.toml。
function setupHosts(root, { runner = runShell, homedir = os.homedir(), probe } = {}) {
  const out = [];
  for (const id of ['claude', 'zcode', 'codex']) {
    const p = probe ? probe(`${id} --version`) : runShell(`${id} --version`);
    if (!p.ok) {
      out.push({ host: id, ok: false, detail: `${id} CLI 未安装，跳过`, changed: false });
      continue;
    }
    const r = registerCliHost(id, root, { runner });
    out.push({ host: id, ...r });
    if (id === 'codex' && !r.ok && homedir) {
      const fb = appendCodexConfig(root, homedir);
      if (fb.ok) out[out.length - 1] = { host: id, ...fb };
    }
  }
  const wbHome = homedir && fs.existsSync(path.join(homedir, '.workbuddy')) ? homedir : null;
  out.push(
    wbHome
      ? { host: 'workbuddy', ...registerWorkbuddy(root, { homedir: wbHome }) }
      : { host: 'workbuddy', ok: false, detail: '~/.workbuddy 不存在，跳过', changed: false }
  );
  return out;
}

module.exports = {
  MARKETPLACE,
  PLUGIN,
  runShell,
  registerCliHost,
  appendCodexConfig,
  registerWorkbuddy,
  setupHosts,
  CLI_HOSTS,
};

if (require.main === module) {
  const root = path.resolve(__dirname, '..');
  const results = setupHosts(root);
  for (const r of results) {
    console.log(`${r.ok ? 'ok     ' : 'FAILED '}  ${r.host.padEnd(10)} ${r.detail}`);
  }
  const failed = results.filter((r) => !r.ok && !/跳过/.test(r.detail));
  process.exit(failed.length ? 1 : 0);
}
