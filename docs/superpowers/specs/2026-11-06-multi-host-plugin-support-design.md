# 多宿主插件支持设计（zcode / codex / workbuddy）

- 日期：2026-11-06
- 状态：已确认（设计门禁通过）
- 决策记录：目标形态=文档+脚本；脚本入口=并入 /alloy:setup；方案=A 双 manifest 并存

## 1. 背景与动机

alloy 目前只以 Claude Code 插件形式分发（`.claude-plugin/marketplace.json`）。用户环境中共有四个 AI 编码宿主：Claude Code、ZCode、Codex、WorkBuddy，希望 alloy 能在全部四个宿主中通过各自插件机制安装。

本机实探（2026-11-06）结论：四家插件机制同源（agent skills 目录 + SKILL.md 通用；marketplace 缓存结构一致），差异集中在 manifest 目录名与 marketplace 注册方式。

### 四宿主机制实探对照

| 宿主 | marketplace 清单位置 | 插件 manifest | 支持源类型 | 注册方式 | 本机证据 |
|---|---|---|---|---|---|
| Claude Code | `.claude-plugin/marketplace.json` | `.claude-plugin/plugin.json` | git/github/directory | `claude plugin marketplace add` + `install` | 原生，alloy 已装 0.3.3 |
| ZCode | 同 claude | 同 claude | 同 claude | `zcode plugins marketplace add` + `install` | alloy 已装 0.3.3 |
| Codex | 同 claude | 同 claude | `local`（config.toml `source_type="local"`） | 手动编辑 `~/.codex/config.toml` 加 `[marketplaces.<name>]` 段 | specpowers 先例：`[marketplaces.specpowers-marketplace]` source 指向本地目录，缓存含 commands/skills/hooks |
| WorkBuddy | `.codebuddy-plugin/marketplace.json` | `.codebuddy-plugin/plugin.json` | directory + zip | UI 安装（或 known_marketplaces.json，字段多不自动写） | known_marketplaces.json 含 directory 类型源；第三方插件（codebuddy-plugins-official）用 `.codebuddy-plugin/` manifest；字段结构与 claude 基本一致，多 `description_en`、`category` |

## 2. 目标 / 非目标

**目标**
1. 仓库单一事实源：skills/commands 内容不改，四宿主共用。
2. WorkBuddy 可通过 directory 源安装（新增 `.codebuddy-plugin/` manifest）。
3. `/alloy:setup` 提供四宿主检测与注册引导（能自动的自动，有风险的给指引）。
4. README 提供四宿主安装矩阵。

**非目标**
- 不为 workbuddy 做 zip 打包与远端发布（方案 B/C 已否决；zip 源仅在 directory 源验证失败时作为后备议题重新提出）。
- 不自动改 workbuddy 的 `known_marketplaces.json`（字段多、无 schema 文档，写入风险高）。
- 不做跨平台脚本（当前环境 Windows；bash 兼容顺带保留，不专门测试）。
- 不改 skills/commands 内容本身。

## 3. 设计

### 3.1 仓库结构：双 manifest 并存（方案 A）

```
alloy/
  .claude-plugin/          # 现有，服务 claude/zcode/codex
    marketplace.json
    plugin.json
  .codebuddy-plugin/       # 新增，服务 workbuddy
    marketplace.json       # name=alloy-marketplace（与 claude 版同名，保证插件 ID 一致）
    plugin.json            # name/version/description 与 claude 版同步；补 description_en
  skills/  commands/  scripts/   # 不动
```

规则：
- 两份 manifest 的 `version` 必须一致；bump 版本时同改两处。
- `.codebuddy-plugin/marketplace.json` 的 plugins 数组指向仓库根（`source: "./"`），字段名以本机 codebuddy-plugins-official 现有插件 manifest 为参照（实现时实弹比对确认）。
- doctor.js 新增一致性检查：两份 manifest version 不一致 → 报错并指出两处路径。

### 3.2 /alloy:setup 多宿主注册环节

**doctor.js 扩展（宿主检测）**：
- 检测四宿主：`claude`/`zcode`/`codex` CLI 是否在 PATH；`~/.workbuddy/` 目录是否存在。
- 各宿主 alloy 注册状态：claude/zcode 查 plugin list；codex 查 config.toml 是否有 `[marketplaces.alloy-marketplace]`；workbuddy 查 known_marketplaces.json 是否含 alloy-marketplace。
- doctor 输出矩阵：每宿主一行（已安装版本 / 未安装 / 宿主不存在）。

**setup 命令注册动作**（幂等，已注册跳过）：

| 宿主 | 动作 | 自动化 |
|---|---|---|
| claude | `claude plugin marketplace add <仓库绝对路径>` + `claude plugin install alloy@alloy-marketplace` | 直接执行 |
| zcode | `zcode plugins marketplace add <仓库绝对路径>` + `zcode plugins install alloy@alloy-marketplace` | 直接执行 |
| codex | config.toml 无该段 → 生成 TOML 片段（`[marketplaces.alloy-marketplace]`，`source_type="local"`，`source='\\?\<仓库绝对路径>'` 对齐 specpowers 格式）→ 展示片段，用户确认后追加写入（TOML 追加新表段安全；不引入 TOML 解析库） | 半自动（确认后写入） |
| workbuddy | 输出 UI 分步指引（设置→插件→添加本地 marketplace→选仓库目录→安装 alloy）；不自动写配置 | 仅指引 |

setup 流程顺序：环境探查（现有）→ **宿主检测与注册引导（新增）** → 外部 CLI 安装（现有）。若宿主 CLI 不存在则跳过并注明，不中断。

### 3.3 README 多宿主安装矩阵

新增「多宿主安装」节，内容：
- 四宿主安装命令/操作对照表（与 3.2 动作一致，供手动安装）。
- slash 命令支持差异说明：claude/zcode 全量支持 `/alloy:*`；codex/workbuddy 以 skills 方式加载，commands 生效情况以实装验证结果写入（实测前标注"待验证"）。
- 落盘目录说明不变（产物仍落 `docs/superpowers/`，与宿主无关）。

## 4. 验证方式

1. **单元**：doctor.test.js 补用例——四宿主检测逻辑、双 manifest version 一致性检查、codex TOML 片段生成格式。
2. **实弹**：本机四宿主全环境验证——claude/zcode 已装（回归确认不破坏）；codex 追加配置段后 `codex` 内确认插件加载、skills/commands 可见性；workbuddy UI 安装 directory 源后确认插件加载。实测结果回写 README 的"待验证"标注。
3. **幂等**：重复跑 setup，已注册宿主全部跳过。

## 5. 风险与降级

| 风险 | 应对 |
|---|---|
| workbuddy directory 源实际不认 `.codebuddy-plugin/` manifest 或字段缺失 | 实装验证第一步即暴露；按 codebuddy 官方插件字段补齐；仍失败则该宿主降级为 zip 打包议题（重新进入设计，不阻塞其他三宿主） |
| codex 手动追加 TOML 段破坏 config.toml | 仅追加新表段（不动既有段）；写入前备份 config.toml（`.bak` 后缀，沿用既有 bak 习惯） |
| 双 manifest 版本漂移 | doctor 一致性检查拦截（3.1 规则） |
| codex/workbuddy 的 commands 机制不生效 | skills 层不受影响（alloy 核心是 skills 驱动）；commands 失效仅影响快捷入口，README 如实标注 |
