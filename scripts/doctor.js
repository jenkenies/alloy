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

function probe(cmd) {
  try {
    const out = execSync(cmd, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 4000,
      maxBuffer: 4 * 1024 * 1024,
    });
    return { ok: true, detail: String(out).trim().split(/\r?\n/)[0].slice(0, 80) };
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

module.exports = { probe, detectSuperpowers, checkAll, exitCode, render, EXTERNAL_TOOLS };

if (require.main === module) {
  const results = checkAll();
  console.log(render(results));
  process.exit(exitCode(results));
}
