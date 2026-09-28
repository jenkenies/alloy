---
description: Alloy 严谨模式：explore → brainstorm → spec → 实现 → 交付，含 ceiling 门禁与 subagent 驱动；交付后可运行 /alloy:status 查看组件统计
argument-hint: <任务描述>
---

# /alloy:strict

按 `alloy-orchestrator` skill 以 **strict 模式**处理任务：$ARGUMENTS

1. 先读 `alloy-orchestrator` skill，再执行。阶段 0 环境探查可复用本会话最近一次 /alloy:status 结果（若已跑过且环境未变）。
2. 严格走五阶段：explore → brainstorm → spec → 实现 → 交付。brainstorm 遵循交互决策原则（仅 4 类场景必须问，一次一问，唯一推荐）；用户明确说跳过才可跳过。
3. spec 完成后执行 ceiling 五维检查；存在不可判矛盾 → 产出 `[未收敛]` 草案停靠待裁决。spec 未经用户确认不得实现。
4. spec 拆解任务 ≥3 个时按 `alloy-subagents` skill 派发 subagent 驱动实现；1-2 个主会话直接实现。
5. 全程遵循 caveman（输出极简）与 ponytail（代码极简）风格。
