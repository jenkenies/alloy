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

module.exports = { MARKETPLACE, PLUGIN, runShell, registerCliHost, appendCodexConfig, CLI_HOSTS };

if (require.main === module) {
  const root = path.resolve(__dirname, '..');
  for (const id of ['claude', 'zcode', 'codex']) {
    const r = registerCliHost(id, root);
    console.log(`${r.ok ? 'ok     ' : 'FAILED '}  ${id.padEnd(8)} ${r.detail}`);
  }
}
