---
name: alloy-orchestrator
description: >
  Alloy 核心编排：把 CodeGraph（代码上下文）、OpenSpec（变更规格）、Superpowers（TDD
  与 brainstorming 纪律）、RTK（输出压缩）、Caveman/Ponytail（极简风格）钉到同一条流水线。
  双模式：fast（explore→spec→实现→交付，主会话直接干）与 strict（增加 brainstorm 澄清、
  ceiling 门禁、subagent 驱动实现）。每个组件先检测可用性，缺失则按降级表降级，绝不中断。
  用于 /alloy:fast 与 /alloy:strict，或任何"先探查→再规格→实现→交付"的编码任务。
---

# Alloy 编排器

双模式执行编码任务。命令入口已选定模式：`/alloy:fast` → fast，`/alloy:strict` → strict。每阶段先查组件可用性，按降级表行动。全程遵循 caveman（输出极简）与 ponytail（代码极简）风格。

## 模式差异总览

| 阶段 | fast | strict |
|---|---|---|
| explore | ✅ | ✅ |
| brainstorm | ❌ | ✅（用户明确说跳过才可跳过） |
| spec | 缺口直接列出问用户 | ✅ + ceiling 五维检查 |
| 实现 | 主会话直接实现，永不派发 subagent | 任务 ≥3 → subagent 驱动；1-2 个 → 主会话直接实现 |
| 交付 | caveman 汇报 | caveman 汇报 +（若派发了 subagent）派发统计 |

## 阶段 0：环境探查（每会话一次）

运行 `node "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.js"` 记录各组件 ok/missing。本会话已运行过 /alloy:status 且此后未变环境时，直接复用其结果。doctor 自身运行失败或脚本缺失 → 视全部可选组件为 missing，直接按降级总表行动。

## 阶段 1：explore（上下文）

按序尝试，命中即停：

1. CodeGraph MCP 可用（工具列表含 `codegraph_explore`）→ 用它查询任务涉及的文件与符号。只取符号级结果，不整读大文件。若返回"项目未索引"类提示 → 建议用户跑 `codegraph init`，本次先走第 3 条。**调用超时或报错（MCP server 已注册但未运行的常见表现）→ 最多重试 1 次，仍失败立即回退第 2/3 条，交付时注明，不在这一步耗时间。**
2. CodeGraph CLI 可用（doctor 报 ok）→ `codegraph explore "<任务关键词>"`。
3. 均不可用 → Grep/Glob 自行探索；交付时注明"上下文未建图"。

本阶段及后续 shell 命令，rtk 可用时优先加 rtk 前缀走压缩输出（常用包装：`rtk grep ...`、`rtk git ...`、`rtk test ...`、`rtk ls ...`）。rtk 报错或不支持该命令时，回退原生命令，不重试不纠结。

## 阶段 2：brainstorm（需求澄清，仅 strict）

位置：explore 之后、spec 之前。superpowers brainstorming 技能可用 → 直接走该技能；不可用 → 走本节内置轻量协议（始终可用）。

提问纪律：

- 一次一问，聚焦：目的 / 约束 / 成功标准。
- **仅 4 类场景必须问**（默认不打扰）：①探索结果模糊 ②多方案难分优劣 ③需求有明显歧义 ④不可逆决策（选型、架构方向、数据结构变更）。
- 能自行合理决定的不问；不输出 TBD/TODO 占位符。

方案对比：2-3 个候选方案，统一维度对比表（复杂度 / 性能影响 / 兼容性 / 推荐度），**必须给出唯一推荐**及理由，禁止"都可以"。

结论（选定方案 + 澄清记录）作为 spec 提案的输入，不单独落盘文件；结论体现在 spec 中。用户明确说"跳过"时才可跳过本阶段。

## 阶段 3：spec（规格）

- openspec 可用（doctor 报 ok）→ 用 openspec 创建变更提案（proposal/spec/tasks），向用户展示摘要并等确认。
- 不可用 → 在 `docs/specs/` 手写 markdown 规格（≤30 行：动机 / 改动点 / 验收标准），等用户确认。
- **规格未经用户确认，不得进入实现阶段。** 用户明确说跳过规格时才可跳过。
- 等待用户确认是**故意的暂停点（门禁）**，不是卡死：向用户说明"规格已产出，等你确认后进入实现"，用户已确认或跳过时不再等待。
- fast 模式发现需求缺口时，直接列出问用户（不走 brainstorm、不跑 ceiling）。

### ceiling 五维检查（仅 strict，spec 产出后、请求确认前跑）

| 维度 | 检查内容 |
|---|---|
| 完整性 | 动机 / 改动点 / 验收标准逐项非空 |
| 自洽性 | 文档内部无冲突（裁决规则：专门章节 > 顺带提及，后文 > 前文） |
| 可测性 | 验收标准能否导出可执行验证（测试场景/命令） |
| 明确性 | 无二义表述；歧义取"不改变现有行为"的理解 |
| 边界一致性 | 改动范围与任务描述边界交叉核对 |

判定：

- 五维全过 → 展示 spec 摘要，等用户确认后进实现。
- 方案未定或存在不可判矛盾 → 停靠：
  1. spec 标题标注 `[未收敛]`
  2. 内容改为：候选方向 + 各自 trade-off + **待裁决清单**（每项含：问题 / 选项 / 推荐项）
  3. **同会话内**停靠等用户裁决；裁决后从 spec 阶段续跑
  4. explore / brainstorm 已产出的上下文与结论不重做（零浪费）
  5. 停靠不是失败；交付时注明停靠原因与待裁决项

## 阶段 4：实现

遵循 ponytail：先爬最小阶梯——能复用现有代码吗？标准库有吗？已装依赖能解吗？能一行吗？最后才是最小实现。

- superpowers 可用 → 走其 test-driven-development 技能：测试先行，RED→GREEN→REFACTOR。
- 不可用 → 仍执行同等纪律：先写失败测试 → 最小实现 → 运行验证。测试框架跟项目现状，不新引入。

### 派发判定（仅 strict）

- spec 拆解后任务 **≥3 个** → 按 `alloy-subagents` skill 派发 subagent 驱动实现（每任务新 implementer + 双阶段审查；其性能规则：修复轮热续原实例、独立审查可并行、小任务合并审查——照做，这是防慢防卡的关键）。
- 任务 **1-2 个** → 主会话直接实现（brief 准备成本 > 收益）。
- **fast 模式永不派发 subagent。**
- Task 工具不可用 → strict 退回主会话顺序实现；brief 字段表（见 alloy-subagents）仍用于任务组织，不浪费。

## 阶段 5：交付

遵循 caveman：汇报 ≤10 行，动词开头，必含四项：改了啥 / 测了啥 / 风险 / 下一步。

- strict 且走了 subagent → 附派发统计：subagent 数 / 审查轮次。
- 本会话降级过的组件在此注明（如"上下文未建图""规格为手写 markdown""ceiling 停靠，待裁决项 N 个"）；strict 且用户要求跳过 brainstorm 时，注明"brainstorm 被跳过，规格直接产出"。
- handoffs 提示：末尾一行建议下一步（如"可运行 /alloy:status 查看组件统计"）。

## 降级总表

| 组件 | 检测方式 | 不可用时 |
|---|---|---|
| codegraph | MCP 工具列表含 `codegraph_explore`，或 doctor 报 ok | Grep/Glob 探索，交付注明"未建图" |
| rtk | doctor 报 ok | 原生命令，不加前缀 |
| openspec | doctor 报 ok | `docs/specs/` 手写规格 |
| superpowers | doctor 报 ok | 内置轻量 TDD 纪律（测试先行）；strict 的 brainstorm 走内置轻量提问协议（阶段 2 规则，始终可用） |
| Task 工具（subagent 派发） | 运行时工具可用性 | strict 实现阶段退回主会话顺序实现；brief 字段表仍用于任务组织 |
| caveman / ponytail | 内嵌，恒可用 | 不适用 |
