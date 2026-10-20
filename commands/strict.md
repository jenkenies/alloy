---
description: Alloy 严谨模式：explore→brainstorm→spec→plan→implement→verify→交付 七阶段全流程，3 个用户门禁，产物落盘 docs/alloy/ 支持跨会话续跑
argument-hint: <任务描述>（留空则尝试续跑进行中的 alloy 任务）
---

# /alloy:strict

按 `alloy-orchestrator` skill 以 **strict 模式**处理任务：$ARGUMENTS

1. 先读 `alloy-orchestrator` skill，再执行。阶段 0 环境探查可复用本会话最近一次 /alloy:status 结果（若已跑过且环境未变）。
2. **$ARGUMENTS 为空时**：检查 `docs/alloy/` 下是否有进行中任务（STATUS.md 非 delivery 终态）→ 有则按其续跑指令恢复，不重做已完成阶段；无则提示用户补充任务描述。
3. 严格走七阶段：explore → brainstorm（穷举模糊点）→ spec → plan → implement → verify → 交付，共 **3 个用户门禁**：门禁 1 = brainstorm 末模糊点清单一次性确认；门禁 2 = plan 末 spec+plan 合并确认；门禁 3 = verify 末验收。门禁处执行门禁统一协议：产物落盘 → STATUS.md 更新 → 标准提示（确认 / 全部按推荐 / 指出修改点）→ **结束当前回合等用户**，禁止自问自答或"先继续做"。
4. spec 产出后跑 ceiling 五维检查，`[未收敛]` 待裁决项并入门禁 2 一次裁决（不单独停靠）。门禁 2 确认后 spec 与 plan 冻结。
5. verify 未过项自动修复循环（上限 2 轮），超限带遗留项进门禁 3 并在报告中标注。
6. plan 拆解任务 ≥3 个时按 `alloy-subagents` skill 派发 subagent 驱动实现（brief 从 03-plan.md 派生；性能规则照做：修复轮热续原实例、独立审查可并行、小任务合并审查、超时止损、提问自答）；1-2 个主会话直接实现。每任务完成即更新 STATUS.md。
7. 全程遵循 caveman（输出极简）与 ponytail（代码极简）风格。
