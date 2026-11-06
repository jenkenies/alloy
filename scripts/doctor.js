#!/usr/bin/env node
'use strict';
// Alloy 组件体检：检测 rtk / openspec / codegraph / superpowers；
// caveman / ponytail 内嵌本插件，恒可用。
// 退出码：0 = 全部可用；1 = 有组件缺失（降级运行）。
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const EXTERNAL_TOOLS = [
  {
    name: 'rtk',
    probes: ['rtk --version', 'rtk version'],
    install:
      'macOS: brew install rtk | Linux: curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/HEAD/install.sh | sh | Windows: 下载 https://github.com/rtk-ai/rtk/releases 的 rtk-x86_64-pc-windows-msvc.zip | 兜底: cargo install --git https://github.com/rtk-ai/rtk',
  },
  {
    name: 'openspec',
    probes: ['openspec --version'],
    install: 'npm i -g @fission-ai/openspec',
  },
  {
    name: 'codegraph',
    probes: ['codegraph version', 'codegraph --version'],
    install: 'npm i -g @colbymchenry/codegraph && codegraph install',
  },
];

function probe(cmd, { full = false } = {}) {
  try {
    const out = execSync(cmd, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 4000,
      maxBuffer: 4 * 1024 * 1024,
    });
    const text = String(out).trim();
    // full=true 保留多行全文（注册状态检查需要看到非首行的 alloy 行）
    const detail = full ? text.slice(0, 4000) : text.split(/\r?\n/)[0].slice(0, 80);
    return { ok: true, detail };
  } catch (err) {
    // ENOENT = 命令不存在（真缺失）；其他 = 命令存在但运行失败，detail 带原因，避免误报"not found"
    if (err && err.code === 'ENOENT') return { ok: false, detail: 'not found' };
    const stderr = (err.stderr && String(err.stderr).trim().split(/\r?\n/)[0].slice(0, 60)) || '';
    return { ok: false, detail: `failed${err.status != null ? ` (exit ${err.status})` : ''}${stderr ? `: ${stderr}` : ''}` };
  }
}

function detectSuperpowers(homedir = os.homedir()) {
  try {
    const p = path.join(homedir, '.claude', 'plugins', 'installed_plugins.json');
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    const raw = data.plugins || data;
    // 兼容两种常见结构：数组（元素为字符串或 {name,…}）与对象（key 为插件标识）
    const names = Array.isArray(raw)
      ? raw.map((e) => (typeof e === 'string' ? e : e.name || e.id || ''))
      : Object.keys(raw);
    const ok = names.some((n) => n.includes('superpowers'));
    return { ok, detail: ok ? 'plugin installed' : 'plugin not installed' };
  } catch {
    return { ok: false, detail: 'cannot read installed_plugins.json' };
  }
}

// 双 manifest 版本一致性：.claude-plugin 与 .codebuddy-plugin 的 plugin.json version 必须一致
function detectManifestSync(root) {
  const read = (dir) => {
    try {
      return JSON.parse(fs.readFileSync(path.join(root, dir, 'plugin.json'), 'utf8')).version;
    } catch {
      return null;
    }
  };
  const claudeV = read('.claude-plugin');
  const cbV = read('.codebuddy-plugin');
  if (!claudeV) return { ok: false, detail: '.claude-plugin/plugin.json unreadable' };
  if (!cbV) return { ok: false, detail: '.codebuddy-plugin/plugin.json missing — workbuddy 支持未就绪' };
  if (claudeV !== cbV) return { ok: false, detail: `version mismatch: claude=${claudeV} codebuddy=${cbV}` };
  return { ok: true, detail: `v${claudeV} synced` };
}

function checkAll({ runner = probe, superpowersRunner = detectSuperpowers } = {}) {
  const results = [];
  for (const tool of EXTERNAL_TOOLS) {
    let r = { ok: false, detail: 'not found' };
    for (const p of tool.probes) {
      r = runner(p);
      if (r.ok) break;
    }
    results.push({ name: tool.name, ...r, install: tool.install });
  }
  results.push({
    name: 'superpowers',
    ...superpowersRunner(),
    install: '插件市场安装 superpowers（/plugin marketplace add obra/superpowers）',
  });
  for (const name of ['caveman', 'ponytail']) {
    results.push({ name, ok: true, detail: 'embedded in alloy', install: 'none' });
  }
  return results;
}

function exitCode(results) {
  return results.every((r) => r.ok) ? 0 : 1;
}

function render(results) {
  const lines = results.map(
    (r) => `${r.ok ? 'ok     ' : 'MISSING'}  ${r.name.padEnd(12)} ${r.detail}`
  );
  const missing = results.filter((r) => !r.ok);
  if (missing.length) {
    lines.push('', 'install hints:');
    for (const m of missing) lines.push(`  ${m.name}: ${m.install}`);
  }
  return lines.join('\n');
}

// 四宿主检测：claude/zcode/codex 探测 CLI 并查注册状态；workbuddy 查 ~/.workbuddy 注册记录
function detectHosts({ probe: probeFn = probe, homedir = os.homedir() } = {}) {
  const out = [];
  const cliHosts = [
    { id: 'claude', cmd: 'claude --version', listCmd: 'claude plugin list' },
    { id: 'zcode', cmd: 'zcode --version', listCmd: 'zcode plugins list' },
    { id: 'codex', cmd: 'codex --version' },
  ];
  for (const h of cliHosts) {
    const p = probeFn(h.cmd);
    if (!p.ok) {
      out.push({ id: h.id, ok: false, registered: false, detail: 'CLI not found' });
      continue;
    }
    let registered = false;
    if (h.listCmd) {
      registered = probeFn(h.listCmd, { full: true }).detail.includes('alloy@');
    } else {
      try {
        registered = fs
          .readFileSync(path.join(homedir, '.codex', 'config.toml'), 'utf8')
          .includes('alloy@alloy-marketplace');
      } catch {
        registered = false;
      }
    }
    out.push({ id: h.id, ok: true, registered, detail: registered ? 'alloy installed' : 'alloy not installed' });
  }
  let wbOk = false;
  let wbReg = false;
  try {
    const km = JSON.parse(fs.readFileSync(path.join(homedir, '.workbuddy', 'plugins', 'known_marketplaces.json'), 'utf8'));
    wbOk = true;
    wbReg = Object.keys(km).includes('alloy-marketplace');
  } catch {
    // 宿主不存在或无插件记录
  }
  out.push({
    id: 'workbuddy',
    ok: wbOk,
    registered: wbReg,
    detail: !wbOk ? '~/.workbuddy not found' : wbReg ? 'alloy registered' : 'alloy not registered',
  });
  return out;
}

module.exports = { probe, detectSuperpowers, detectManifestSync, detectHosts, checkAll, exitCode, render, EXTERNAL_TOOLS };

if (require.main === module) {
  const results = checkAll();
  console.log(render(results));
  const root = path.resolve(__dirname, '..');
  const sync = detectManifestSync(root);
  console.log(`\nmanifest: ${sync.ok ? 'ok     ' : 'FAILED '} ${sync.detail}`);
  console.log('\nhosts:');
  for (const h of detectHosts({})) {
    const mark = !h.ok ? 'absent ' : h.registered ? 'installed' : 'present ';
    console.log(`  ${mark}  ${h.id.padEnd(10)} ${h.detail}`);
  }
  process.exit(exitCode(results) || (sync.ok ? 0 : 1));
}
