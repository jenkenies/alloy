---
description: Alloy 主工作流：explore → spec → 实现 → 交付
argument-hint: <任务描述>
---

# /alloy:flow

按 `alloy-orchestrator` skill 处理任务：$ARGUMENTS

1. 先读 `alloy-orchestrator` skill，再执行。阶段 0 环境探查可复用本会话最近一次 /alloy:status 结果（若已跑过且环境未变）。
2. 严格走四阶段：explore → spec → 实现 → 交付；spec 产出必须等用户确认后才实现。
3. 全程遵循 caveman（输出极简）与 ponytail（代码极简）风格。
