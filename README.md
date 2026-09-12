# Glassmorphism Enhanced

为 Komari Monitor 打造的独立维护主题：毛玻璃界面、三网质量监控与可选中转路径估算，让节点状态更容易理解。

[![Version](https://img.shields.io/badge/version-1.0.0-10b981)](CHANGELOG.md)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

[下载 Release](https://github.com/casiuna/Glassmorphism-Enhanced/releases) · [安装](#installation) · [中转估算](#transit-ping) · [变更记录](CHANGELOG.md)

当前开发版本为 **1.0.0**。这是 Glassmorphism Enhanced 独立 SemVer 版本线的起点；是否已发布请以 Releases 为准，而不是以源码版本号判断。

## Preview

![Glassmorphism Enhanced 预览](docs/preview.png)

## Features

- **Glassmorphism UI**：毛玻璃卡片、动态背景、浅色 / 深色和北京时间自动日夜模式，支持色觉辅助配色与减弱动画。
- **三网延迟 / 丢包**：中国联通、电信、移动分别显示 RTT、丢包率和历史色块，多个同运营商任务自动聚合。
- **Transit Carrier Ping**：可选中转三网估算，按节点选择中转和链路任务，明确区分估算与直接探测。
- **多种 NodeCard 尺寸**：`mini`、`compact`、`comfortable`、`large`，默认保持 `compact`；同时提供适合密集巡检的列表视图。
- **地球与链路可视化**：真实地球、Cobe 点阵和平铺地图；自动、常驻、上游标签和关闭连线模式。
- **财务 / 流量 / 健康工具**：费用与剩余价值、累计与周期流量、健康摘要、节点对比和快照导出，受限工具遵循登录权限。
- **响应式布局**：桌面与手机布局、详情页图表分区、收藏与快速切换，实时指标无需整页刷新。
- **新旧 Komari Ping 兼容**：优先使用 Metric 数据，继续保留 Legacy fallback、共享缓存、请求去重与既有刷新生命周期。

### Direct 三网监控

普通节点使用自身的 Ping Task，不需要中转配置。建议创建名为 `中国联通`、`中国电信`、`中国移动` 的任务，或者使用以下兼容关键词：

| 运营商 | 任务名关键词（英文不区分大小写）                              |
| ------ | ------------------------------------------------------------- |
| 联通   | `联通`、`China Unicom`、`Unicom`、`CUCC`                      |
| 电信   | `电信`、`China Telecom`、`Telecom`、`CTCC`、`ChinaNet`、`CN2` |
| 移动   | `移动`、`China Mobile`、`Mobile`、`CMCC`、`CMI`、`CMIN2`      |

同一运营商有多个任务时，主题沿用现有聚合方式；没有匹配任务显示 `--`，不会影响其他运营商。历史色块的空槽表示没有采样，不表示零延迟或零丢包。

### 地球、拓扑与工具

自动地球连线是稳定、去重、限量的视觉连接，**不代表实际路由、BGP 路径或中转规则**。上游拓扑模式使用 `upstream:NodeName` 或 `上游:NodeName` 标签；ASN/BGP 分析与 Transit Ping 也是独立能力，互不自动推导配置。

主题设置提供首页概览卡、快捷控制、详情指标族、背景图片 / 视频等选项。持久本地背景可放在 Komari 数据目录的 `data/theme/user-assets/` 下，再填写 `local:文件名`，避免主题升级覆盖自定义文件。

高级工具中的按量费用是前端辅助估算，不是账单系统；探针累计流量可能因重启或计数器变化重置。财务、健康与拓扑结果应结合实际后端记录判断。

## Installation

这是 **Komari 可导入的主题 ZIP**，不是普通静态网站部署包，也不需要改动 Komari Server 或 Agent。

### 从仓库安装

在支持仓库安装的 Komari 主题管理页填写：

```text
https://github.com/casiuna/Glassmorphism-Enhanced
```

仓库安装通常读取 GitHub Release。若当前只有待审查源码而没有新 Release，安装到的仍可能是历史版本。

### 手动安装或升级

1. 在 [Releases](https://github.com/casiuna/Glassmorphism-Enhanced/releases) 中选择所需版本。
2. 下载 Release 附件中的主题 ZIP，**不要使用 GitHub 自动生成的 Source code ZIP**。
3. 登录 Komari 后台，进入主题管理，上传 ZIP 并启用。
4. 根据需要调整主题设置，确认节点、三网、背景和布局显示正常。
5. 启用中转功能前，先确认中转节点自身三网任务和到目标的链路任务都有数据。

本地构建产物名为 `komari-theme-Glassmorphism-build-<short-sha>.zip`，包的顶层固定为：

```text
komari-theme.json
preview.png
dist/
```

内部兼容标识 `short = Glassmorphism` 和 ZIP 命名契约不随公开品牌重命名而改变。安装前建议保留当前主题 ZIP 和设置备份，便于回退。

### 独立版本线

从 **v1.0.0** 起，Glassmorphism Enhanced 使用自己的 SemVer：

- Bugfix：`1.0.1`、`1.0.2`。
- 向后兼容的新功能：`1.1.0`、`1.2.0`。
- 不兼容变更：`2.0.0`。

不再使用 `-enhanced.x` 后缀，也不跟随 upstream 的 `3.x`。旧 `v3.3.7-enhanced.1` tag / Release 保留为独立版本线之前的历史，不删除、不重写。因为新版本号数值低于历史版本，某些仅比较版本大小的更新器可能不会自动提示升级，需要手动选择正式 `v1.0.0` 附件。

## Transit Ping

当目标节点不适合直接执行中国三网探测，或业务通过入口节点抵达落地节点时，可以用中转节点的采样估算组合路径：

```text
User
 -> RelayNode
 -> TargetNode
```

这里的结果是两段探测 RTT 的组合，**不是目标节点直接测量中国三网，也不是端到端实测**。反向路由、协议、拥塞和采样时刻的差异都可能影响它与真实体验的一致性。

### 准备 Ping Task

在 Komari 中为 `RelayNode` 保留三网 Ping Task，再添加一个由该中转节点执行、探测目标地址的任务，例如 `Relay-Target-v6`。目标可使用你实际需要的 IPv4 / IPv6 和协议 / 端口；主题不保存生产地址，也不负责创建任务。

目标节点本身无需为了中转估算执行三网任务，但 direct 模式仍依赖目标自己的任务。关闭中转后，如果目标没有直接三网采样，显示 `--` 是正常行为。

### 配置

在主题设置的 **08 · 三网与中转延迟** 分区：

| Key                         | 默认值  | 用途                             |
| --------------------------- | ------- | -------------------------------- |
| `transitCarrierPingEnabled` | `false` | 启用中转三网延迟估算             |
| `transitCarrierPingRules`   | 空文本  | 每行配置一个目标、中转和链路任务 |

启用开关，在规则中填写：

```text
# 目标节点|中转节点|链路任务名
TargetNode|RelayNode|Relay-Target-v6
TargetB|RelayNode|Relay-TargetB-v6
TargetC|RelayTwo|RelayTwo-TargetC
```

- 按节点名称和任务名称精确匹配，名称应唯一，区分大小写。
- 自动去除每段前后空格；忽略空行与 `#` 开头注释。
- 必须正好有三个非空字段；无效行安全忽略，不支持字段内的 `|`。
- 同一目标最后一条有效规则覆盖之前配置；不支持目标与中转相同。
- 可配置多个目标和多个中转；多个目标可共享同一个中转数据源。
- 不递归解释中转节点自身的 transit 规则；每条规则始终使用该中转节点的原始三网与指定链路采样，避免循环依赖。
- 全局关闭或删除目标规则后，目标立即恢复 direct 数据源；无规则节点不受影响。

### 计算与显示

```text
Estimated RTT = Relay carrier RTT + Relay-to-target RTT
```

例如两段分别为 `32 ms` 和 `63 ms` 时，目标显示 **≈95 ms**。汇总 RTT 使用 `Math.round()`；Tooltip 列出中转、任务、三网段、中转段和估算 RTT。原始 direct 显示不增加 `≈`。

丢包通过两段成功概率相乘来估算。若内部概率为 `p1`、`p2`：

```text
p_total = 1 - (1 - p1) * (1 - p2)
```

例如 `1%` 和 `2%` 合成为 `2.98%`，UI 保留一位小数显示 `≈3.0%`，不是直接相加。组合结果依赖两段损失独立的近似假设，不应理解为实际链路联合丢包的测量。

延迟和丢包历史都会派生：两段历史在共同的 20 槽时间轴上匹配，同槽 RTT 相加、成功率相乘；任一段缺失则保留 `null`。时间戳不必完全相同，不跨空槽补零，不声称组合波动值有统计意义，因此中转 Tooltip 不显示“平均波动”。

### 异常与验收

- 中转不存在或名称重复：显示 `--` 并提示中转节点未找到或名称歧义。
- 链路任务不存在或同名任务不唯一：显示 `--` 并提示任务缺失或歧义。
- 中转离线或链路没有数据：不继续展示旧的估算值。
- 仅某一家三网缺数据：该行显示 `--`，其他有数据的运营商仍正常。
- 关闭 Ping 记录或首页订阅暂停：遵循原有 enabled / 生命周期，不单独启动新的后台查询。

建议先核对中转自身三网数值与链路任务，再开启一条目标规则检查 `≈` 与 Tooltip；关闭开关、删除规则后确认恢复 direct。最后在浏览器 Network / RPC 中查看请求：共享同一中转的卡片应复用现有缓存和去重，不应随着目标数量重复拉取同一中转历史。

估算只在前端展示链派生，不覆盖 Pinia 原始统计、不写回 API，也不改变中转节点或目标节点的真实采样。

## Development

环境：Node.js `^20.19.0` 或 `>=22.12.0`，Bun `>=1.2.0`。

```bash
git clone git@github.com:casiuna/Glassmorphism-Enhanced.git
cd Glassmorphism-Enhanced
bun install --frozen-lockfile
bun run dev
```

验证与构建：

```bash
bun run lint
bun run type-check
bun run build
bunx playwright install chromium
bun run test:visual
git diff --check
```

构建输出 `dist/` 和主题 ZIP。测试使用虚构节点及保留的示例地址，不连接生产主控；报告输出到 `playwright-report/` 和 `test-results/`。不要为了让测试变绿而直接覆盖截图基准，先检查差异原因。

发布版本的唯一来源是 `komari-theme.json.version`，不要为 `package.json` 增加顶层 `version`。发布 tag 使用 `v<version>`，本轮对应 `v1.0.0`。发布与维护细节见 [独立版本发布说明](docs/enhanced-release.md)，开发架构和贡献规范见 [开发指南](AIAGENTREADME.md)。

## Credits

本项目源自 [Komari Glassmorphism](https://github.com/sanrokamlan-prog/komari-theme-Glassmorphism)，保留上游完整 Git 历史与许可。来源基线记录在 [CHANGELOG](CHANGELOG.md)，不作为本项目版本号。

感谢原始主题作者 **Tokinx**、upstream 维护者 **sanrokamlan**，以及 [Komari](https://github.com/komari-monitor/komari)、[Komari Naive](https://github.com/tonyliuzj/komari-naive)、Vue、Vite、reka-ui、Tailwind CSS 和所有贡献者。第三方来源及使用边界见 [THIRD_PARTY.md](THIRD_PARTY.md)。

## License

[MIT](LICENSE)。上游与第三方版权声明继续保留。
