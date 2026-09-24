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
- `/alloy:flow <任务>` — explore → spec → 实现 → 交付 四阶段工作流

组件缺失时自动降级，不中断工作流。

## License

MIT。上游组件 attribution 见 [NOTICE.md](NOTICE.md)。
