---
description: Alloy 一键安装：检测并安装 rtk / codegraph / openspec，提示 superpowers
allowed-tools: Bash
---

# /alloy:setup

逐项检测并安装缺失组件。只使用官方开源安装源。每装一项立即回读版本验证；失败给出手动命令兜底并继续下一项，绝不静默、绝不中断。

## 步骤

1. 运行 `node "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.js"`，记下缺失项清单。

2. **多宿主注册**：运行 `node "${CLAUDE_PLUGIN_ROOT}/scripts/setup-hosts.js"`。它会自动检测 claude/zcode/codex/workbuddy 四宿主并注册 alloy（已装跳过；codex CLI 失败自动降级写 config.toml；workbuddy 自动写配置并备份）。宿主 CLI 缺失属正常，输出 FAILED 才需处理——把失败详情打印给用户并给对应宿主的手动安装命令（见 README 多宿主安装矩阵）。

3. 对每个缺失项按当前平台安装（装一项验一项）：

   **openspec**（全平台）：
   - 装：`npm i -g @fission-ai/openspec`
   - 验：`openspec --version`
   - 兜底：https://github.com/Fission-AI/OpenSpec

   **codegraph**（全平台）：
   - 装：`npm i -g @colbymchenry/codegraph`
   - 验：`codegraph version`
   - 然后运行 `codegraph install`（官方安装器把 MCP server `codegraph serve --mcp` 写入 Claude Code 用户级配置并设置自动放行）。它可能是交互式命令：若当前环境无法应答 TTY 提示，改为提示用户在终端自行运行 `codegraph install`，不要挂起等待
   - 兜底（打印给用户手动执行）：`npx @colbymchenry/codegraph`（官方交互安装器）

   **rtk**（https://github.com/rtk-ai/rtk）：
   - macOS：`brew install rtk`；或 `curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/HEAD/install.sh | sh`
   - Linux：`curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/HEAD/install.sh | sh`（装入 `~/.local/bin`，提示用户确认 PATH）
   - Windows：自动安装链（源始终为官方渠道，逐级兜底）：
     ① `winget install rtk-ai.rtk`（官方 winget 包，Windows 内置；装完若 `rtk --version` 找不到命令，提示用户新开终端再验）
     ② winget 不可用/失败 → 直链 `https://github.com/rtk-ai/rtk/releases/latest/download/rtk-x86_64-pc-windows-msvc.zip`（`curl -sL` 下载，校验文件大小与 release API 中 `size` 一致）
     ③ 直链超时/连接被重置时，读注册表系统代理 `reg query "HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings" /v ProxyServer`，取到 `host:port` 后带 `-x http://host:port` 重试直链（企业网常见：本地代理客户端只服务浏览器，curl/git 默认不走）
     ④ 仍失败才打印手动步骤：浏览器打开 https://github.com/rtk-ai/rtk/releases 下载同名 zip
     直链路径安装时：解压 `rtk.exe` 到 PATH 内目录（如 `%USERPROFILE%\bin`；目录不存在先创建，确认在 PATH 后再验证），下载用完即删临时 zip
   - 兜底（打印给用户手动执行）：`cargo install --git https://github.com/rtk-ai/rtk`
   - 验：`rtk --version`

   **superpowers**（无法命令安装）：
   - 提示用户在 Claude Code 插件市场安装 superpowers（`/plugin marketplace add obra/superpowers`，作者官方市场；若已通过 claude-plugins-official 装过则跳过）

4. 重跑 `node "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.js"`，输出最终状态表（ok / MISSING）+ manifest 同步与宿主矩阵。

## 规则

- `npm` 不存在 → 提示先装 Node.js（https://nodejs.org），不代改系统配置。
- `cargo` 兜底同理：Rust 未装则只给链接（https://rustup.rs）。
- 任何一步失败：打印该组件手动安装命令与官网链接，继续下一项。
- 结束仍有 missing → 建议运行 `/alloy:status` 查看降级影响说明。
