---
name: alloy-subagents
description: >
  Alloy subagent 驱动实现协议（strict 模式，任务 ≥3 时使用）。主会话作为 controller，
  每任务派发全新 implementer subagent（零上下文，brief 由 controller 精确构造），
  每任务双阶段审查（spec 合规 → 代码质量），四态状态上报。配套 prompts/ 下三个模板。
---

# Alloy Subagent 驱动实现

主会话 = controller。每任务派发**全新** implementer subagent：零上下文，brief 由 controller 精确构造，不继承会话历史。原则：fresh subagent per task + 双阶段审查 = 高质量、快迭代。

## 触发条件

- 仅 strict 模式且 spec 拆解后任务 ≥3 个时使用（≤2 个主会话直接实现）。
- fast 模式永不使用本协议。
- Task 工具不可用 → 整体退回主会话顺序实现（brief 字段表仍用于任务组织）。

## 流程

```
每任务：
  1. 派 implementer（prompts/implementer-prompt.md，brief 全字段填全）
  2. implementer 可先提问 → controller 解答后继续
  3. implementer 实现 + TDD（测试先行）+ 自审
  4. 派 spec 合规审查（prompts/spec-reviewer-prompt.md）
     ❌ 缺口 → 以原 brief + 审查发现重新派发修复（全新实例，不继承会话）→ 重审
  5. 派代码质量审查（prompts/quality-reviewer-prompt.md）
     ❌ 问题 → 同上修复 → 重审
     ⚠️ 同一任务审查-修复累计 ≥3 轮仍不过 → 按 BLOCKED 升级链处理
  6. 双审通过 → 标记任务完成，下一任务
  （controller 全程记录：每任务派发次数 / 审查轮次，供 orchestrator 交付统计）
全部完成后：
  7. 派最终整体审查 subagent：brief 带 spec 全文 + 累计改动全量 diff
     （审查跨任务一致性；无专用模板，参照 quality-reviewer-prompt.md 构造）
```

## brief 字段表（implementer-prompt.md 核心，controller 必须填全）

| 字段 | 防的坑 |
|---|---|
| 目标 + 场景与验收标准 | 不知道"做到什么程度" |
| 代码锚点：文件路径 + 符号名 + 锚点代码片段；**禁止裸行号** | 前置任务改动后行号漂移 |
| 前置产出契约：前置任务产出的精确符号（常量全名 / 方法签名 / DTO 字段） | 免回读前置实现 |
| 数据来源：跨链路字段的取值表达式 + 值域 + 空值处理 | 瞎猜字段来源 |
| 验证命令：编译 / 测试命令 | 无法自证完成 |
| 约束：不改无关代码 / 注释语言 / 编码规范要点 | 越界重构 |
| 卡住升级路径：连续失败 2 次 / 找不到 API 签名 / 数据来源不明 → 停止并返回状态，禁止瞎猜 | 硬编错代码 |
| spec 相关条目原文：controller 从 spec 摘录本任务相关条目随 brief 带全 | 落实"禁止让 subagent 自己读 spec 文件"红线 |

## 状态上报协议（implementer 返回四态之一）

| 状态 | controller 处理 |
|---|---|
| DONE | 进 spec 合规审查 |
| DONE_WITH_CONCERNS | 读 concerns：正确性/范围问题先解决再审；观察性备注记录后继续 |
| NEEDS_CONTEXT | 补齐缺失上下文后重新派发 |
| BLOCKED | 依次尝试：补上下文重派 → 换更强模型重派 → 拆小任务 → 升级给用户。**禁止**无视升级或原样重试 |

## 模型分级

- 机械任务（1-2 文件、规格完整）→ 便宜快速模型
- 多文件集成 → 标准模型
- 架构判断 / 审查 → 最强模型

## 红线（Never）

- 禁止并行派发实现 subagent（会冲突；独立只读调查类才可并行）
- 禁止让 subagent 自己读 spec 文件（brief 必须自带本任务所需 spec 内容——相关条目原文，见 brief 字段表）
- 审查存在 open issue 不得进下一任务
- 禁止跳过任一阶段审查（spec 合规 → 质量，顺序不可颠倒）
- 禁止用 implementer 自审替代独立审查
- 子代理执行期间 controller 不停顿等待用户确认（除非收到 BLOCKED 且升级链走完）；唯一停止理由：BLOCKED 无法自解、影响正确性的歧义、全部任务完成
