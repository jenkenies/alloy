# Alloy

装一个插件 = 六家精华。

| 能力 | 来源 | 作用 |
|---|---|---|
| spec 驱动流程 | [OpenSpec](https://github.com/Fission-AI/OpenSpec) | 变更规格先行 |
| TDD 纪律 | [Superpowers](https://github.com/obra/superpowers) | 测试先行工作流 |
| 代码图谱 | [CodeGraph](https://github.com/colbymchenry/codegraph) | 精准代码上下文，100% 本地 |
| 输出压缩 | [RTK](https://github.com/rtk-ai/rtk) | 命令输出进上下文前先瘦身 |
| 输出极简 | [Caveman](https://github.com/JuliusBrussee/caveman) | 回答省 token |
| 代码极简 | [Ponytail](https://github.com/DietrichGebert/ponytail) | 最小 diff，~54% 减代码量 |
| 需求澄清 | Alloy v0.2 内置 | brainstorm：模糊点清单一次性确认 + 唯一推荐方案（strict 模式） |
| subagent 驱动 | Alloy v0.2 内置 | strict 多任务双阶段审查实现 |
| 严格全流程 | Alloy v0.3 内置 | strict 七阶段：需求澄清→设计方案→实施计划→编码→自测验证，3 门禁 |
| 落盘续跑 | Alloy v0.3 内置 | 产物落盘 docs/alloy/，中断/换会话从 STATUS.md 续跑 |

## 安装

在 Claude Code 中：

```text
/plugin marketplace add <本仓库路径或 git url>
/plugin install alloy@alloy-marketplace
/alloy:setup
```

`/alloy:setup` 自动安装缺失的 CLI（rtk / codegraph / openspec，全部官方源），并提示插件市场组件。

## 使用

- `/alloy:status` — 组件体检 + token 节省统计
- `/alloy:setup` — 一键安装缺失 CLI
- `/alloy:fast <任务>` — 极简模式：explore → spec → 实现 → 交付，主会话直接执行
- `/alloy:strict <任务>` — 严谨模式：explore → brainstorm → spec → plan → implement → verify → 交付 七阶段全流程；模糊点清单一次性确认（门禁 1）、spec+plan 合并确认（门禁 2）、自测验证验收（门禁 3）；任务 ≥3 时 subagent 驱动实现；产物落盘 docs/alloy/ 可跨会话续跑

组件缺失时自动降级，不中断工作流。

**续跑**：任务中断或换会话后，说"继续 alloy 任务"或 `/alloy:strict`（留空任务描述）即从 STATUS.md 记录的阶段恢复，已完成阶段不重做。

## License

MIT。上游组件 attribution 见 [NOTICE.md](NOTICE.md)。
