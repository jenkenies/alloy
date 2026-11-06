# Alloy

装一个插件 = 六家精华 + 一套严格开发全流程。

| 能力 | 来源 | 作用 |
|---|---|---|
| spec 驱动流程 | [OpenSpec](https://github.com/Fission-AI/OpenSpec) | 变更规格先行 |
| TDD 纪律 | [Superpowers](https://github.com/obra/superpowers) | 测试先行工作流 |
| 代码图谱 | [CodeGraph](https://github.com/colbymchenry/codegraph) | 精准代码上下文，100% 本地 |
| 输出压缩 | [RTK](https://github.com/rtk-ai/rtk) | 命令输出进上下文前先瘦身 |
| 输出极简 | [Caveman](https://github.com/JuliusBrussee/caveman) | 回答省 token |
| 代码极简 | [Ponytail](https://github.com/DietrichGebert/ponytail) | 最小 diff，~54% 减代码量 |
| 需求澄清 | Alloy v0.2 内置 | brainstorm：模糊点清单一次性确认 + 唯一推荐方案 |
| subagent 驱动 | Alloy v0.2 内置 | 多任务双阶段审查实现 |
| 严格全流程 | Alloy v0.3 内置 | 七阶段：需求澄清→设计方案→实施计划→编码→自测验证，3 门禁 |
| 落盘续跑 | Alloy v0.3 内置 | 产物落盘 docs/superpowers/（specs/plans 标准目录），中断/换会话从 status 续跑 |

## 快速开始

在 Claude Code 中安装：

```text
/plugin marketplace add <本仓库路径或 git url>
/plugin install alloy@alloy-marketplace
/alloy:setup
```

1. 装完先跑 `/alloy:status` 体检：缺什么组件一目了然（CLI 缺失可一键补装）。
2. 直接派任务：`/alloy:fast 修复登录页白屏问题` 或 `/alloy:strict 给订单模块加退款接口`。

## 多宿主安装

同一仓库支持四个宿主，内容层（skills/commands）完全一致，产物落盘目录（`docs/superpowers/`）与宿主无关：

| 宿主 | 安装方式 | slash 命令 |
|---|---|---|
| Claude Code | `/plugin marketplace add <仓库>` → `/plugin install alloy@alloy-marketplace` | ✅ `/alloy:*` 全量 |
| ZCode | `zcode plugins marketplace add <仓库>` → `zcode plugins install alloy@alloy-marketplace` | ✅ `/alloy:*` 全量 |
| Codex | `codex plugin marketplace add <仓库>` → `codex plugin add alloy@alloy-marketplace` | skills 生效；`/alloy:*` 入口以 Codex 内实际呈现为准（commands 已进插件缓存） |
| WorkBuddy | 设置 → 插件 → 添加本地 marketplace（选仓库目录）→ 安装 alloy | skills 生效；入口以 WorkBuddy 内实际呈现为准 |

**一键注册**：任一宿主里跑 `/alloy:setup`（或 `node <仓库>/scripts/setup-hosts.js`）——自动检测已安装的宿主并注册（claude/zcode/codex 走 CLI，workbuddy 自动写配置并备份），已注册跳过，幂等可重跑。

## 两个工作流怎么选

| 你的任务 | 用哪个 |
|---|---|
| 改 bug、小改动、需求一句话能说清 | `/alloy:fast` |
| 新功能、多文件改动、需求有歧义、要产出设计文档 | `/alloy:strict` |

拿不准就用 strict——它只是在 3 个关键节点多问你两次，其余全自动。

## strict 七阶段全流程

```
explore → brainstorm → spec → plan → implement → verify → 交付
            │门禁1        │  门禁2（spec+plan 合并确认）   │门禁3
```

每个门禁你会看到什么、怎么回复：

- **门禁 1（需求澄清）**：AI 把所有模糊点列成清单，每项带唯一推荐方案 → 回复 `确认 / 全部按推荐 / 指出修改点`
- **门禁 2（方案+计划）**：展示设计方案摘要 + 任务拆解清单 → 同上回复；确认后方案冻结
- **门禁 3（验收）**：自测验证报告（全量测试 + 验收标准逐条核对）→ 回复 `通过`，或列出问题打回修复

门禁交互长这样：

> ⏸ **门禁 1** | 待确认 3 项：① 退款金额校验放接口层还是服务层（推荐：服务层，理由…）② …
> 请回复：**确认 / 全部按推荐 / 指出修改点**

你回复后流程继续。**门禁处 AI 不会自己往下跑——这是故意的暂停，不是卡住。**

## 产物与续跑

strict 每阶段产物落盘 `docs/superpowers/`（对齐 superpowers 目录规范：specs/plans 按类型分目录，文件名 `<日期>-<任务slug>-<类型>.md`）：

| 产物 | 位置 | 内容 |
|---|---|---|
| 澄清记录 | specs/<任务>-clarifications.md | 探索结论 + 模糊点清单 + 你的裁决记录 |
| 设计方案 | specs/<任务>-design.md | 动机 / 方案 / 改动点 / 验收标准 |
| 实施计划 | plans/<任务>-plan.md | 每任务：文件/步骤/验证命令/依赖 |
| 验证报告 | verify/<任务>-report.md | 测试结果 + 验收标准逐条核对 |
| 任务状态 | status/<任务>-status.md | 当前阶段 / 门禁状态 / 续跑指令 |

**续跑**：任务中断或换会话后，说"继续 alloy 任务"或 `/alloy:strict`（留空任务描述），从 status 记录的阶段恢复，已完成阶段不重做。

## 常用命令速查

| 命令 | 作用 |
|---|---|
| `/alloy:fast <任务>` | 极简四阶段：explore → spec → 实现 → 交付 |
| `/alloy:strict <任务>` | 严谨七阶段全流程（见上） |
| `/alloy:strict`（留空） | 续跑进行中的任务 |
| `/alloy:status` | 组件体检 + token 节省统计 |
| `/alloy:setup` | 一键安装缺失 CLI（rtk / codegraph / openspec） |

## 排障 FAQ

- **停在某处不动了？** 大概率在门禁等你：找"门禁 N"提示，回复其中的选项即可继续。
- **subagent 很慢或没响应？** 已内置超时止损与升级链（自动退回主会话或升级给你）；频繁出现先跑 `/alloy:status` 查组件与模型状态。
- **交付里出现"上下文未建图 / 手写规格 / 轻量纪律"？** 对应组件缺失自动降级，跑 `/alloy:setup` 补装即可。
- **不想被问太多？** 小任务用 fast；strict 下明确说"跳过 brainstorm"，会记录并在交付注明。
- **组件缺失会中断任务吗？** 不会，自动降级不中断。

## 内部 skills（给想深入了解的人）

| skill | 干嘛 | 需要你手动调吗 |
|---|---|---|
| alloy-orchestrator | 七阶段/四阶段编排骨架 + 门禁协议 | 否，命令自动加载 |
| alloy-subagents | 多任务 subagent 派发与双阶段审查协议 | 否，strict 任务 ≥3 自动触发 |
| caveman / ponytail | 输出极简 / 代码极简风格 | 否，全程自动生效 |

日常只需记住 `/alloy:fast` 与 `/alloy:strict` 两条命令，其余自动。

## License

MIT。上游组件 attribution 见 [NOTICE.md](NOTICE.md)。
