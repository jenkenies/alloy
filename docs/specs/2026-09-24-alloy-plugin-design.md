# Alloy 插件设计文档

日期：2026-09-24
状态：已确认（用户批准）
类型：Claude Code 插件（plugin）

## 1. 定位

Alloy 是一个 Claude Code 插件：**装一个 = 六家精华**。它不重新实现任何上游功能，而是把六个优秀项目的核心能力钉到同一条编码流水线的固定工位上，并提供一键安装与优雅降级。

| 层 | 上游项目 | 在 Alloy 中的角色 |
|---|---|---|
| 流程层 | [OpenSpec](https://github.com/Fission-AI/OpenSpec) | spec 驱动的变更规格管理（CLI） |
| 流程层 | [Superpowers](https://github.com/obra/superpowers) | TDD / 调试等纪律性技能（插件） |
| 理解层 | [CodeGraph](https://github.com/colbymchenry/codegraph) | 本地代码知识图谱，精准代码上下文（CLI + MCP） |
| 省钱层 | [RTK](https://github.com/rtk-ai/rtk) | 命令输出压缩代理，输入端省 token（CLI） |
| 省钱层 | [Caveman](https://github.com/JuliusBrussee/caveman) | agent 输出极简风格（skill 文本，内嵌） |
| 省钱层 | [Ponytail](https://github.com/DietrichGebert/ponytail) | 极简代码风格，~54% 减代码量（skill 文本，内嵌） |

核心价值：**整合体验**，不是重新实现。上游更新自动跟上（薄壳），组件缺失自动降级（健壮）。

## 2. 架构决策

- **方案 A：薄壳编排 + 优雅降级**（已选定，替代全量内嵌方案 B 与模块化方案 C）
- **编排机制**：Claude 本身是编排器。SKILL.md 是注入给 Claude 的决策说明书；没有运行时调度代码。
- **依赖策略**：外部 CLI（openspec / codegraph / rtk）由 `/alloy:setup` 检测并自动安装；文本型能力（Caveman/Ponytail 精华）直接内嵌，零依赖。
- **YAGNI 边界**：不做模块开关、不做 GUI、不做 token 统计后台（status 里一条 `rtk gain` 命令足够）。

## 3. 目录结构

```
alloy/
├── .claude-plugin/
│   ├── plugin.json              # 插件清单（name: alloy, version: 0.1.0）
│   └── marketplace.json         # 本仓库即 marketplace，支持 /plugin marketplace add
├── commands/
│   ├── setup.md                 # /alloy:setup  检测+安装外部 CLI
│   ├── status.md                # /alloy:status 组件体检
│   └── flow.md                  # /alloy:flow   主编排工作流
├── skills/
│   ├── alloy-orchestrator/SKILL.md   # 核心：组件调度 + 降级表
│   ├── caveman/SKILL.md              # 上游原文内嵌（极简输出）
│   ├── caveman/LICENSE               # 上游许可（attribution）
│   ├── ponytail/SKILL.md             # 上游原文内嵌（极简代码）
│   └── ponytail/LICENSE
├── scripts/
│   ├── doctor.js                # 跨平台环境检测（Node，node:test 可单测）
│   └── doctor.test.js           # doctor 单元测试
├── hooks/
│   └── hooks.json               # SessionStart 提示组件状态（可选，v0.2）
├── NOTICE.md                    # 上游组件 attribution 汇总
└── docs/                        # specs/ 设计文档 + plans/ 实施计划
```

## 4. 组件接入矩阵

| 上游 | 接入方式 | 检测方法 | 缺失时降级行为 |
|---|---|---|---|
| OpenSpec | CLI（npm `@fission-ai/openspec`） | `openspec --version` | spec 阶段降级为 `docs/specs/` 手写 markdown 规格 |
| Superpowers | Claude Code 插件 | 已安装插件列表 | 编排 skill 独立跑轻量流程（跳过 TDD 纪律引用） |
| CodeGraph | CLI + MCP（setup 时由官方 `codegraph install` 写入用户级 MCP 配置，server 启动命令 `codegraph serve --mcp`） | MCP 工具列表含 `codegraph_explore` | 降级为原生 Grep/Glob 探索，汇报注明"上下文未建图" |
| RTK | CLI 二进制（setup 安装） | `rtk --version` | 降级为原生命令 |
| Caveman | skill 文本内嵌 | 无需检测 | 永远可用 |
| Ponytail | skill 文本内嵌 | 无需检测 | 永远可用 |

降级原则：**检测 → 降级 → 汇报注明**，绝不中断流程、绝不静默吞掉。

## 5. 命令规格

### /alloy:setup
1. 逐项检测 `rtk` / `codegraph` / `openspec` / superpowers 插件
2. 缺失项自动安装（全部使用官方开源源，禁止引用本地路径，实施时逐项验证命令可执行）：
   - openspec：`npm i -g @fission-ai/openspec`
   - codegraph：`npm i -g @colbymchenry/codegraph`
   - rtk（[rtk-ai/rtk](https://github.com/rtk-ai/rtk)，默认分支 develop，官方发布页 https://github.com/rtk-ai/rtk/releases）：
     - macOS：`brew install rtk` 或官方 install.sh（`curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh`）
     - Linux：官方 install.sh
     - Windows：从 releases 下载 `rtk-x86_64-pc-windows-msvc.zip` 解压至 PATH
     - 兜底：`cargo install --git https://github.com/rtk-ai/rtk`
   - superpowers：无法以命令安装，提示用户在插件市场安装
3. 每步失败给出对应的手动安装命令兜底
4. 结束输出安装结果表，并提示运行 `/alloy:status` 验证

### /alloy:status
1. 运行 doctor 脚本，输出六组件状态表：`ok / degraded / missing`
2. 附每项一行降级说明
3. 若 rtk 可用，附 `rtk gain` token 节省统计

### /alloy:flow <任务描述>
主编排，四阶段：

1. **explore**：CodeGraph 可用 → 查询涉及文件/符号，只取符号级结果；否则降级 Grep/Glob
2. **spec**：openspec 可用 → 创建变更规格并等用户确认；否则 `docs/specs/` 手写规格等确认
3. **实现**：遵循 minimal-code（先问"这能用一行/一个函数解决吗"）+ Superpowers TDD（若可用：测试先行）
4. **交付**：遵循 lean-output：汇报 ≤10 行，动词开头，含"改了啥 / 测了啥 / 风险在哪"

## 6. 数据流

```
用户 /alloy:flow <任务>
   → flow.md 加载 alloy-orchestrator skill
   → orchestrator 查组件可用性（矩阵第 3 列）
   → 四阶段依次执行，每阶段产出
   → 输出风格统一走 lean-output skill
```

## 7. 错误处理

- **setup**：每步失败给手动命令兜底，不静默；安装后回读版本号验证
- **运行时**：orchestrator 内嵌降级表（本文件第 4 节），按表降级并在交付时注明
- **doctor**：退出码 `0`=ok / `1`=degraded / `2`=missing，供 status 与脚本化测试使用

## 8. 测试策略

1. doctor 检测逻辑脚本化，可单测（模拟组件存在/缺失/版本过旧）
2. 干净环境冒烟：装插件 → `/alloy:setup` → `/alloy:status` 全绿
3. 降级路径：人为隐藏组件（PATH 屏蔽 rtk、禁用 codegraph MCP），验证 `/alloy:flow` 全程不断
4. 人工验收：用一个小型真实仓库跑通 `/alloy:flow` 全流程

## 9. 许可合规

- Caveman 为 MIT+BSL 双许可：内嵌其 skill 文本走 MIT 部分，SKILL.md 头部保留 attribution（来源仓库与许可声明）
- Ponytail / Superpowers / OpenSpec / CodeGraph：MIT，内嵌或引用均需 attribution
- RTK：安装官方原版二进制，无内嵌，无风险
- Alloy 自身：MIT

## 10. 里程碑

- **v0.1（本次实施）**：plugin.json + marketplace.json + 三命令 + 三 skill + doctor.js + README/NOTICE，本地 marketplace 安装验证
- **v0.2**：SessionStart hook 自动体检提示；`rtk gain` 统计进 status
- **v1.0**：发布自有 marketplace（marketplace.json），支持一行安装分发给他人
