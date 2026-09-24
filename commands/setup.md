---
description: Alloy 一键安装：检测并安装 rtk / codegraph / openspec，提示 superpowers
allowed-tools: Bash
---

# /alloy:setup

逐项检测并安装缺失组件。只使用官方开源安装源。每装一项立即回读版本验证；失败给出手动命令兜底并继续下一项，绝不静默、绝不中断。

## 步骤

1. 运行 `node "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.js"`，记下缺失项清单。

2. 对每个缺失项按当前平台安装（装一项验一项）：

   **openspec**（全平台）：
   - 装：`npm i -g @fission-ai/openspec`
   - 验：`openspec --version`
   - 兜底：https://github.com/Fission-AI/OpenSpec

   **codegraph**（全平台）：
   - 装：`npm i -g @colbymchenry/codegraph`
   - 验：`codegraph version`
   - 然后运行 `codegraph install`（官方安装器把 MCP server `codegraph serve --mcp` 写入 Claude Code 用户级配置并设置自动放行；交互选项选 Claude Code / 所有项目）
   - 兜底：`npx @colbymchenry/codegraph`（官方交互安装器）

   **rtk**（https://github.com/rtk-ai/rtk）：
   - macOS：`brew install rtk`；或 `curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh`
   - Linux：`curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh`（装入 `~/.local/bin`，提示用户确认 PATH）
   - Windows：从 https://github.com/rtk-ai/rtk/releases 下载 `rtk-x86_64-pc-windows-msvc.zip`，解压 `rtk.exe` 到 PATH 内目录（如 `%USERPROFILE%\bin`）
   - 兜底：`cargo install --git https://github.com/rtk-ai/rtk`
   - 验：`rtk --version`

   **superpowers**（无法命令安装）：
   - 提示用户在 Claude Code 插件市场安装 superpowers（官方 marketplace：claude-plugins-official）

3. 重跑 `node "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.js"`，输出最终状态表（ok / MISSING）。

## 规则

- `npm` 不存在 → 提示先装 Node.js（https://nodejs.org），不代改系统配置。
- `cargo` 兜底同理：Rust 未装则只给链接（https://rustup.rs）。
- 任何一步失败：打印该组件手动安装命令与官网链接，继续下一项。
- 结束仍有 missing → 建议运行 `/alloy:status` 查看降级影响说明。
