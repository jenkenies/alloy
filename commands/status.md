---
description: Alloy 组件体检：六组件状态表 + rtk token 节省统计
allowed-tools: Bash
---

# /alloy:status

1. 运行 `node "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.js"`。退出码：0=全可用，1=有缺失（降级运行）。
2. 把输出整理为状态表：组件 | 状态(ok/degraded) | 说明。caveman / ponytail 恒 ok（内嵌）。
3. 输出末尾附 manifest 同步状态与 hosts 宿主矩阵（absent=宿主未安装 / present=宿主在但 alloy 未注册 / installed=已注册）；workbuddy 的注册确认需用户打开 WorkBuddy 插件页核对。
3. 对每个非 ok 组件附一行降级影响：
   - rtk 缺失 → 命令输出不压缩，token 消耗更高
   - codegraph 缺失 → 无代码图谱，探索退回 Grep/Glob
   - openspec 缺失 → 规格退回 docs/specs/ 手写 markdown
   - superpowers 缺失 → 无 TDD 纪律技能，走内置轻量流程
4. rtk 可用时运行 `rtk gain`，汇报 token 节省统计；无历史数据则注明"暂无统计数据"。
5. 全绿时输出一行：`Alloy 全组件可用。`
6. 有缺失时提示：运行 `/alloy:setup` 补齐。
