# Glassmorphism Enhanced v1.0.7

**Status: Released.** v1.0.7 发布内容已获 owner 授权并完成本地验收。正式主题 ZIP 由 main 推送触发的既有 Actions 构建，最终提交与附件以 [GitHub Release](https://github.com/casiuna/Glassmorphism-Enhanced/releases/tag/v1.0.7) 为准；本地旧 HEAD 命名的验证包不作为正式发布附件。

## 流量回滚

恢复 [vlongx 原版三网主题](https://github.com/vlongx/komari-theme-Glassmorphism-three-network) 的机器累计口径，使用当前节点 `net_total_up` / `net_total_down`，不再用前端月度历史桶完整性决定累计值是否可见。

配额相关累计值依 Komari `traffic_limit_type`：

| Mode   | 累计值                 |
| ------ | ---------------------- |
| `up`   | 累计上行               |
| `down` | 累计下行               |
| `min`  | 两个方向累计值的较小值 |
| `max`  | 两个方向累计值的较大值 |
| `sum`  | 累计上行 + 累计下行    |

首页卡片与汇总、列表、详情、节点对比、健康预警和 CSV / JSON 快照导出统一采用机器累计口径。双向总量为上行加下行；详情分别显示累计上行和下行。

**配额百分比只是机器累计与配置限额的参考比值，不是本月账单或服务商月度用量，不保证按月清零。** 无有效配额时，健康 / 导出不生成相应配额百分比或配额预警。Agent 重启、网卡变更、计数器重置可能改变累计值；主题只显示当前快照，不拼接重置前后的累计值，不推断服务商的计费周期、时区或清零策略。服务商用量以其后台和账单为准。

## 移除与保留边界

- 移除月度专用 `useMonthlyTrafficUsage.ts`、`traffic.service.ts`、`monthlyTraffic.ts`、`trafficCycle.ts` 及其额外月度 SUM 派生查询；不再因月度缺桶把机器累计值隐藏为“待核对”。这不是放宽桶完整性判定或把部分历史认证为完整月度用量。
- 健康面板以实时 `net_in + net_out` 显示“当前网络速率”，不再用累计值除以当月秒数。其余健康、CPU、磁盘和 Ping 功能保留。
- JSON 流量状态为 `machine-cumulative`，scope 为 `machine-cumulative-not-provider-bill`；CSV 标注“机器累计流量（非月度账单）”。保留其他导出字段、价格逻辑、登录权限和导出保护。
- 联通 / 电信 / 移动三网 Ping、Transit 推导和 v1.0.6 的 viewport 订阅、取消竞态、请求队列与图表缓存修复保留。共享 metrics / history / request 服务和原有历史图表继续使用，不是全面撤销 Metric API。
- 不修改 Komari Server / Agent、数据库、生产配置或服务商后台；不写入、清零或删除累计计数器与后端历史采集数据。旧月度说明保留为 [v1.0.6 历史方案](monthly-traffic-reliability.md)，不代表本版功能。
- Transit 沿用 v1.0.5 的 `relay | target | task`，不新增迁移；仍使用旧 `target | relay | task` 配置时需手动交换前两列，不自动识别或改写。见 [Transit 规则](transit-rules.md)。

## 安装

1. 打开 [v1.0.7 Release](https://github.com/casiuna/Glassmorphism-Enhanced/releases/tag/v1.0.7)，使用 Actions 生成的主题附件。
2. 下载 Release 的 **主题 ZIP 附件** `komari-theme-Glassmorphism-build-<short-sha>.zip`，不是 GitHub 的 **Source code (zip)** 或源码归档。
3. 在 Komari 后台主题管理中上传并启用；检查累计上 / 下行、配额参考、三网与现有 Transit 配置。

主题 ZIP 顶层仍为 `komari-theme.json`、`preview.png` 和 `dist/`，内部 `short: Glassmorphism` 不变。v1.0.6 的 tag、Release 和原附件保留，不移动或重建。

## 验收结果

- 累计流量 helper / 页面 / JSON 与 CSV 导出：**21/21 passed**，涵盖五种 mode、无限配额、计数器重置和无额外月度 SUM 查询。
- 三网 / Transit / header / viewport：**29/29 passed**，其中 Transit 20、header 5、viewport 4；两组共 **50 个定向测试**，0 failed / skipped。
- TypeScript、全项目无修复 ESLint、`git diff --check` 均 exit 0。
- `npm run build` 生产构建 exit 0；Vite 转换 **1864 modules**，`dist` 为 **761 files / 12.206 MiB**。本地 ZIP 的 CRC、manifest 1.0.7 和全部 dist 文件一致性已验证；这些是本地验收数据，不是正式 CI 附件的 SHA、文件名或大小。

上述结果不等于全量像素基线验收。正式发布的构建、tag、Release 与最终附件仍须按 [发行流程](releasing.md) 从 Actions 和远端逐项核验，不以本地包替代。
