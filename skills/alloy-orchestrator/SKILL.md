---
name: alloy-orchestrator
description: >
  Alloy 核心编排：把 CodeGraph（代码上下文）、OpenSpec（变更规格）、Superpowers（TDD
  纪律）、RTK（输出压缩）、Caveman/Ponytail（极简风格）钉到同一条流水线：
  explore → spec → 实现 → 交付。每个组件先检测可用性，缺失则按降级表降级，绝不中断。
  用于 /alloy:flow，或任何"先探查→再规格→实现→交付"的编码任务。
---

# Alloy 编排器

按四阶段执行编码任务。每阶段先查组件可用性，按降级表行动。全程遵循 caveman（输出极简）与 ponytail（代码极简）风格。

## 阶段 0：环境探查（每会话一次）

运行 `node "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.js"` 记录各组件 ok/missing。本会话已运行过 /alloy:status 且此后未变环境时，直接复用其结果。

## 阶段 1：explore（上下文）

按序尝试，命中即停：

1. CodeGraph MCP 可用（工具列表含 `codegraph_explore`）→ 用它查询任务涉及的文件与符号。只取符号级结果，不整读大文件。若返回"项目未索引"类提示 → 建议用户跑 `codegraph init`，本次先走第 3 条。
2. CodeGraph CLI 可用（doctor 报 ok）→ `codegraph explore "<任务关键词>"`。
3. 均不可用 → Grep/Glob 自行探索；交付时注明"上下文未建图"。

本阶段及后续 shell 命令，rtk 可用时优先加 rtk 前缀走压缩输出（常用包装：`rtk grep ...`、`rtk git ...`、`rtk test ...`、`rtk ls ...`）。rtk 报错或不支持该命令时，回退原生命令，不重试不纠结。

## 阶段 2：spec（规格）

- openspec 可用（doctor 报 ok）→ 用 openspec 创建变更提案（proposal/spec/tasks），向用户展示摘要并等确认。
- 不可用 → 在 `docs/specs/` 手写 markdown 规格（≤30 行：动机 / 改动点 / 验收标准），等用户确认。
- **规格未经用户确认，不得进入阶段 3。** 用户明确说跳过规格时才可跳过。

## 阶段 3：实现

- 遵循 ponytail：先爬最小阶梯——能复用现有代码吗？标准库有吗？已装依赖能解吗？能一行吗？最后才是最小实现。
- superpowers 可用 → 走其 test-driven-development 技能：测试先行，RED→GREEN→REFACTOR。
- 不可用 → 仍执行同等纪律：先写失败测试 → 最小实现 → 运行验证。测试框架跟项目现状，不新引入。

## 阶段 4：交付

遵循 caveman（full 档）：汇报 ≤10 行，动词开头，必含四项：改了啥 / 测了啥 / 风险 / 下一步。本会话降级过的组件在此注明（如"上下文未建图""规格为手写 markdown"）。

## 降级总表

| 组件 | 检测方式 | 不可用时 |
|---|---|---|
| codegraph | MCP 工具列表含 `codegraph_explore`，或 doctor 报 ok | Grep/Glob 探索，交付注明"未建图" |
| rtk | doctor 报 ok | 原生命令，不加前缀 |
| openspec | doctor 报 ok | `docs/specs/` 手写规格 |
| superpowers | doctor 报 ok | 内置轻量 TDD 纪律（测试先行） |
| caveman / ponytail | 内嵌，恒可用 | 不适用 |
