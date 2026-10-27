---
description: Alloy 极简模式：explore → spec → 实现 → 交付，主会话直接执行；交付后可运行 /alloy:status 查看组件统计
argument-hint: <任务描述>
allowed-tools: Bash
---

# /alloy:fast

按 `alloy-orchestrator` skill 以 **fast 模式**处理任务：$ARGUMENTS

1. 先读 `alloy-orchestrator` skill，再执行。阶段 0 环境探查可复用本会话最近一次 /alloy:status 结果（若已跑过且环境未变）。
2. 严格走四阶段：explore → spec → 实现 → 交付；spec 产出必须等用户确认后才实现。
3. 实现阶段主会话直接执行，不派发 subagent；用宿主 todo 跟踪进度时，每完成一项立即标 completed，全部完成后最终一次更新必须全绿（防中间快照被误读为未跑完）。
4. 全程遵循 caveman（输出极简）与 ponytail（代码极简）风格。
