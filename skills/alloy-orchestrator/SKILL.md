---
name: alloy-orchestrator
description: >
  Alloy 核心编排：strict 七阶段严格全流程（explore→brainstorm 穷举澄清→spec→plan→implement→verify→交付，
  3 个用户门禁，产物落盘 docs/superpowers/ 支持跨会话续跑）与 fast 四阶段极简流程（explore→spec→实现→交付）。
  把 CodeGraph（代码上下文）、OpenSpec（变更规格）、Superpowers（TDD 与 brainstorming 纪律）、
  RTK（输出压缩）、Caveman/Ponytail（极简风格）钉到同一条流水线；每个组件先检测可用性，缺失则按降级表降级，绝不中断。
  用于 /alloy:fast 与 /alloy:strict，或任何"先探查→再澄清→规格→计划→实现→验证→交付"的编码任务。
---

# Alloy 编排器

双模式执行编码任务。命令入口已选定模式：`/alloy:fast` → fast，`/alloy:strict` → strict。每阶段先查组件可用性，按降级总表行动。全程遵循 caveman（输出极简）与 ponytail（代码极简）风格。

## 模式差异总览

| 阶段 | fast | strict |
|---|---|---|
| explore | ✅ | ✅ |
| brainstorm | ❌ | ✅ 穷举模糊点 + 门禁 1 清单确认 |
| spec | 缺口直接列出问用户 | ✅ + ceiling 五维检查 + 落盘 |
| plan | ❌ | ✅ 实施计划落盘（brief 数据源）+ 门禁 2 |
| implement | 主会话直接实现，永不派发 subagent | 任务 ≥3 → subagent 驱动；1-2 个 → 主会话直接实现 |
| verify | ❌（实现内 TDD 自测即收尾） | ✅ 全量验证 + 验收逐条核对 + 门禁 3 验收 |
| 交付 | caveman 汇报 | caveman 汇报 + 派发统计 + STATUS 终态 |

strict 全程产物落盘（见落盘协议），fast 不落盘。

## 阶段 0：环境探查（每会话一次）

运行 `node "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.js"` 记录各组件 ok/missing。本会话已运行过 /alloy:status 且此后未变环境时，直接复用其结果。doctor 自身运行失败或脚本缺失 → 视全部可选组件为 missing，直接按降级总表行动。

## 阶段 1：explore（上下文）

按序尝试，命中即停：

1. CodeGraph MCP 可用（工具列表含 `codegraph_explore`）→ 用它查询任务涉及的文件与符号。只取符号级结果，不整读大文件。若返回"项目未索引"类提示 → 建议用户跑 `codegraph init`，本次先走第 3 条。**调用超时或报错（MCP server 已注册但未运行的常见表现）→ 最多重试 1 次，仍失败立即回退第 2/3 条，交付时注明，不在这一步耗时间。**
2. CodeGraph CLI 可用（doctor 报 ok）→ `codegraph explore "<任务关键词>"`。
3. 均不可用 → Grep/Glob 自行探索；交付时注明"上下文未建图"。

本阶段及后续 shell 命令，rtk 可用时优先加 rtk 前缀走压缩输出（常用包装：`rtk grep ...`、`rtk git ...`、`rtk test ...`、`rtk ls ...`）。rtk 报错或不支持该命令时，回退原生命令，不重试不纠结。

**strict 附加**：探索结论要点（涉及文件/符号/现状行为）记入 01-clarifications.md 的"探索结论"节，供后续阶段引用，防会话衔接丢失。

## 落盘协议（strict）

产物统一落盘到 **`docs/superpowers/`**（对齐 superpowers 目录规范：specs/plans 按类型分目录；文件名 `<YYYY-MM-DD>-<任务slug>-<类型>.md`。slug 一律英文小写：中文任务取关键词的英文翻译，无对应英文可用拼音，3-6 个词连字符连接，保证跨平台文件名安全）。产物简称与实际路径映射（正文其他处引用的产物文件名即指对应产物）：

| 简称 | 实际路径 |
|---|---|
| 01（澄清记录） | `docs/superpowers/specs/<日期>-<slug>-clarifications.md` |
| 02（设计方案） | `docs/superpowers/specs/<日期>-<slug>-design.md` |
| 03（实施计划） | `docs/superpowers/plans/<日期>-<slug>-plan.md` |
| 04（验证报告） | `docs/superpowers/verify/<日期>-<slug>-report.md` |
| STATUS（状态机） | `docs/superpowers/status/<日期>-<slug>-status.md` |

规则：

- 每阶段产出**立即落盘**，STATUS 同步更新；implement 阶段每任务完成即更新 STATUS。
- 门禁续跑从文件恢复上下文，不依赖会话记忆；已完成阶段的结论**不得重问、不得重做**（零浪费原则跨会话生效）。
- openspec 可用时 spec 仍走 openspec 提案，但摘要必须同步落盘 02——落盘是硬要求，openspec 只是格式来源。
- 落盘失败（目录无写权限等）→ 退回会话内衔接并在交付注明，不中断流程。
- **落盘产物语言**：01-04 与 STATUS 用正常完整语言书写（它们是持久化文档，供后续会话与其他人阅读；caveman 极简风格仅作用于对话交互与交付汇报，不作用于落盘文件——对齐 caveman 自身"持久化文档用正常语言"的边界）。

### STATUS 格式

```markdown
# Alloy 任务状态
- 任务：<一句话>
- 模式：strict
- 当前阶段：<explore|brainstorm|spec|plan|implement|verify|delivery>
- 门禁状态：<无 | 门禁N 待确认（等待内容：…） | 门禁N 已确认>
- 下一步：<用户该回复什么或系统将做什么>
- 已完成产物：<文件列表>
- 续跑指令：<从哪个阶段的哪一步继续>
```

## 门禁统一协议（strict）

strict 共 3 个用户门禁：门禁 1（brainstorm 末，模糊点清单）、门禁 2（plan 末，spec+plan 合并确认）、门禁 3（verify 末，验收）。所有门禁执行同一硬规则：

1. 产物已落盘，STATUS.md 已更新（写明"下一步该回复什么"）。
2. 输出标准化提示：确认内容（清单/摘要）+ 可回复项：**确认 / 全部按推荐 / 指出修改点**。
3. **结束当前回合**：停止生成，不再调用任何工具，不轮询，绝不"我先继续做"。
4. 用户回复后：从 STATUS.md 记录的续跑点继续；已确认结论不重问。
5. 禁止：自问自答、替用户拍板、擅自降级跳过门禁、在门禁处输出后续阶段的产物。

门禁例外：用户明确说跳过某门禁 → STATUS.md 记录"用户跳过门禁 N"，交付时注明。verify 的验收本身不可跳过；报告全绿时用户回复"通过"即完成验收。

## 阶段 2：brainstorm（需求澄清，仅 strict）

位置：explore 之后、spec 之前。superpowers brainstorming 技能可用 → 走其纪律；不可用 → 本节规则（始终可用）。

**穷举收集模糊点**（与 v0.2"仅 4 类必须问"不同，此阶段要求全量收集、不自行"合理决定"）：

1. 目的（为什么做、解决谁的问题）
2. 约束（性能/兼容/时间/技术栈限制）
3. 成功标准（做完的判定依据）
4. 需求歧义（任务描述可多种理解的点）
5. 方案分歧（多方案难分优劣处）
6. 不可逆决策（选型、架构方向、数据结构变更）

能从代码库/已落盘探索结论自答的项，直接给答案并标注"自答"，不进清单。

**产出 01-clarifications.md**：探索结论 + 模糊点清单。清单每项 = 编号 + 问题 + 选项（含**唯一推荐**+理由，禁止"都可以"）+ 依赖标注（"依赖第 N 项"）。

**门禁 1：一次性清单确认。** 优先 AskUserQuestion（每批 ≤4 问，选择题形式），超 4 项分批提交；不适合选择题的项随附纯文本清单。用户可回复"全部按推荐"一次通过。裁决结果落盘 01-clarifications.md 的"裁决记录"节。

用户明确说跳过 → STATUS.md 记录"用户跳过门禁 1"，直接以探索结论进 spec，交付注明"brainstorm 被跳过"。

## 阶段 3：spec（规格，strict）

- openspec 可用（doctor 报 ok）**且项目已初始化**（存在 `openspec/` 目录）→ 用 openspec 创建变更提案（proposal/spec/tasks），**摘要同步落盘 02-spec.md**。
- openspec 可用但项目未初始化 → 询问用户是否运行 `openspec init`（一次，说明利弊）；用户不愿或 init 失败 → 本次走手写 02 并交付注明，禁止反复尝试。
- 不可用 → 手写 02-spec.md（≤40 行：动机 / 方案 / 改动点 / 验收标准）。
- **验收标准必须逐条可验证**（能导出测试场景或命令）。
- **规格未经门禁 2 确认，不得进入实现。**

### ceiling 五维检查（spec 产出后、门禁 2 前跑）

| 维度 | 检查内容 |
|---|---|
| 完整性 | 动机 / 改动点 / 验收标准逐项非空 |
| 自洽性 | 文档内部无冲突（裁决规则：专门章节 > 顺带提及，后文 > 前文） |
| 可测性 | 验收标准能否导出可执行验证（测试场景/命令） |
| 明确性 | 无二义表述；歧义取"不改变现有行为"的理解 |
| 边界一致性 | 改动范围与任务描述边界交叉核对 |

判定：

- 五维全过 → 直接进 plan 阶段（门禁 2 一并确认）。
- 方案未定或存在不可判矛盾 → 02-spec.md 标题标注 `[未收敛]`，待裁决项（问题/选项/推荐项）**并入门禁 2 的确认清单**，不单独停靠等待（v0.2 的独立停靠已取消，防多一轮交互卡壳）。

## 阶段 4：plan（实施计划，strict 新增）

落盘 03-plan.md：

- **任务清单**：每任务 = 编号 + 目标 + 涉及文件与符号 + 实现步骤（有序）+ 验证命令 + 依赖任务 + 规模（S=单文件机械 / M=多文件 / L=架构级）。
- **依赖关系**：标明串行链与可并行项（仅只读任务可并行）。
- **全量验证命令汇总**：implement 完成后 verify 阶段要跑的完整命令清单（编译/测试/lint）。
- **plan 字段与 subagent brief 一一对应**：implement 派发时 brief 直接从本文件对应任务行派生，不重新组装。
- 任务 1-2 个时 plan 照常落盘（字段表仍用于主会话任务组织）。

**门禁 2：spec + plan 合并确认。** 展示 02-spec.md 摘要 + 03-plan.md 任务清单 +（若有）`[未收敛]` 待裁决项，一次性提交用户：确认 / 全部按推荐 / 指出修改点。裁决后 spec 与 plan **冻结**，implement 阶段不再变更方案；发现结构性问题按 BLOCKED 升级链处理。

## 阶段 5：implement（实现）

遵循 ponytail：先爬最小阶梯——能复用现有代码吗？标准库有吗？已装依赖能解吗？能一行吗？最后才是最小实现。

- superpowers 可用 → 走其 test-driven-development 技能：测试先行，RED→GREEN→REFACTOR。
- 不可用 → 仍执行同等纪律：先写失败测试 → 最小实现 → 运行验证。测试框架跟项目现状，不新引入。
- **实现前预检（主会话与 subagent 路径都强制）**：验证命令先确认可运行（实际跑一次，或核对 package.json/scripts 等定义存在）；不可运行 → 先修复验证环境或作为缺口升级用户，禁止带着跑不通的验证命令写码。

### 派发判定（strict）

- 任务 **≥3 个** → 按 `alloy-subagents` skill 派发 subagent 驱动实现（brief 从 03-plan.md 派生；其性能规则全部照做——热续修复、只读审查并行、小任务合并审查、超时止损、提问自答）。
- 任务 **1-2 个** → 主会话直接实现（brief 准备成本 > 收益）。
- **fast 模式永不派发 subagent。**
- Task 工具不可用 → strict 退回主会话顺序实现；brief 字段表仍用于任务组织，不浪费。

**每任务完成（双审通过或主会话完成自测）→ 立即更新 STATUS.md**（已完成任务列表 + 当前任务 + 续跑点），防断线丢进度。

## 阶段 6：verify（自测验证，strict 新增）

强制执行（用户明确要求跳过除外，跳过须 STATUS.md 记录并交付注明）：

1. **全量验证**：跑 03-plan.md"全量验证命令汇总"的全部命令（编译/测试/lint），记录通过/失败项数。
2. **验收逐条核对**：02-spec.md 验收标准逐条 → 通过 / 未通过 / 未覆盖，每条附证据（命令输出摘要 / 文件符号）。
3. 落盘 04-verify-report.md（验证命令结果 + 验收核对表 + 遗留项）。

判定：

- 全部通过 → **门禁 3**：呈现报告摘要（≤10 行），用户验收：通过 → 交付；不通过 → 列具体问题回 implement 修复。
- 有未通过项 → **不等待用户**，直接回 implement 修复（仅失败项相关任务），修完重跑 verify；**修复循环上限 2 轮**，超限 → 带遗留项进入门禁 3，04-verify-report.md 明确标注遗留。

## 阶段 7：交付

遵循 caveman：汇报 ≤10 行，动词开头，必含四项：改了啥 / 测了啥 / 风险 / 下一步。

- strict 且走了 subagent → 附派发统计：subagent 数 / 审查轮次。
- 本会话降级过的组件在此注明（如"上下文未建图""规格为手写 markdown"）；跳过的门禁逐项注明。
- STATUS.md 置终态（delivery，附产物索引，供后续会话查阅）。
- handoffs 提示：末尾一行建议下一步（如"可运行 /alloy:status 查看组件统计"）。

## fast 模式补充（v0.2 行为不变）

四阶段 explore → spec → 实现 → 交付：

- spec 缺口直接列出问用户（不走 brainstorm、不跑 ceiling、不落盘）。
- 实现阶段主会话直接执行 + TDD 自测，不派发 subagent，无 plan/verify 独立阶段。
- spec 未经用户确认不得实现；确认等待是故意暂停点，提示后结束回合。

## 跨会话续跑（strict）

新会话用户说"继续 alloy 任务"→ 扫描 `docs/superpowers/status/` 下最近修改且非终态（delivery）的 status 文件 → 按其续跑指令从记录阶段继续，已完成阶段产物直接复用不重做。status 目录为空或全部终态 → 提示无进行中任务。status 产物丢失 → 询问用户从哪个阶段重启，禁止凭空猜测。

## 降级总表

| 组件 | 检测方式 | 不可用时 |
|---|---|---|
| codegraph | MCP 工具列表含 `codegraph_explore`，或 doctor 报 ok | Grep/Glob 探索，交付注明"未建图" |
| rtk | doctor 报 ok | 原生命令，不加前缀 |
| openspec | doctor 报 ok | 手写 02-spec.md（落盘仍强制） |
| superpowers | doctor 报 ok | 内置轻量 TDD 纪律（测试先行）；brainstorm 走本文件阶段 2 规则（始终可用） |
| Task 工具（subagent 派发） | 运行时工具可用性 | strict 实现阶段退回主会话顺序实现；brief 字段表仍用于任务组织 |
| AskUserQuestion | 运行时工具可用性 | 门禁确认改纯文本清单（仍一次性提交、含推荐项） |
| caveman / ponytail | 内嵌，恒可用 | 不适用 |
