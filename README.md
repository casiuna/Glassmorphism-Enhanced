# Glassmorphism Enhanced

基于 [Komari](https://github.com/komari-monitor/komari) 的第三方监控主题。保留毛玻璃设计，重点展示节点状态、流量和中国联通／电信／移动三网延迟。

[![Release](https://img.shields.io/badge/Release-v1.2.0-10b981)](https://github.com/casiuna/Glassmorphism-Enhanced/releases/tag/v1.2.0)
[![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE)

> **v1.2.0 新增两项能力**：
>
> - **顶部自定义标签**：将 Komari 原生节点自定义标签移至卡片顶部，保留原始 tags 格式与拓扑元数据。
> - **三网回程线路**：支持管理员导入/消费已采集的电信、联通、移动逐跳 ASN 结果，以及按 UUID 的手动覆盖；自动结果与伴生 Helper 默认关闭，访客不可见。
>
> 自动结果不会从浏览器启动 traceroute、SSH 或远程 Shell；本 Release 未执行真实公网 traceroute/ASN 验证。完整安装、升级、备份与回滚说明见 [Enhanced Full v1.2.0](docs/full.md)，安全边界见 [伴生模块说明](docs/companion.md)。
>
> v1.2.0 Full 支持已实测的 Komari 1.6.0，未实测 1.6.1；旧版主题兼容记录见 [测试范围与限制](docs/komari-1.6.0-compatibility.md)，迁移见 [迁移与回退](docs/migration-v1.1.0.md)。

![主题预览](docs/preview.png)

## 主要功能

- **三网监控**：分别显示联通、电信、移动的延迟、丢包率和历史记录，支持多个 Ping 任务。
- **中转延迟**：可选 Transit Carrier Ping，使用 Relay 两段探测数据估算目标节点的三网质量。
- **流量展示**：按原三网主题显示流量、上行、下行与配额。
- **节点与界面**：多尺寸卡片、列表、节点详情、响应式布局、浅色／深色主题及可选地球可视化。
- **辅助工具**：节点对比、健康摘要、财务估算和 CSV／JSON 导出。
- **财务与汇率**：支持 SGD（新加坡元）等 13 种币种的费用估算与换算，支持在线汇率、缓存及手动调整。

## 安装

1. 打开 [Releases](https://github.com/casiuna/Glassmorphism-Enhanced/releases/tag/v1.2.0)，下载 **主题 ZIP 附件**（`komari-theme-Glassmorphism-build-*.zip`）。Full `.tar.gz` 是完整安装/回滚包，不能直接上传到主题管理器；不要下载 GitHub 自动生成的 Source code ZIP。
2. 在 Komari 后台的主题管理中上传、启用。
3. 按需调整三网任务、主题外观和中转规则。

不需要修改 Komari Server 或 Agent。

本版主题标识为 `Enhanced` v1.2.0。旧 Enhanced 1.1.1 的托管配置、布局、三网 Ping、Relay、财务、SGD、GPU 与拓扑设置沿同一 short 升级并保留；迁移与回退见 [说明](docs/migration-v1.1.0.md)。

## 三网与中转

三网直连探测使用已有 Komari Ping 任务，支持中文运营商名称及常见英文别名。若需要让目标节点显示经 Relay 的估算延迟，在主题设置 **「08 · 三网与中转延迟」** 启用 Transit Carrier Ping，并按行填写：

```text
# 中转节点|目标节点|链路任务名
RelayNode|TargetNode|Relay-Target
```

Relay 需要三网探测任务和探测目标节点的链路任务。**字段顺序固定为「中转节点｜目标节点｜链路任务」**；使用 v1.0.5 之前的旧规则时，须手动交换前两列。

中转结果是两段数据的估算值，**不是目标节点直接测得的端到端延迟**。功能默认关闭；未匹配的节点继续显示直连探测。完整规则见 [Transit 配置说明](docs/transit-rules.md)。

## 流量说明

流量使用 Komari 提供的 `net_total_up` / `net_total_down`，并按 `traffic_limit_type` 显示；不计算服务商月度账单。

## 开发

需要 Node.js `^20.19.0` 或 `>=22.12.0`，以及 Bun 1.3.14。

```bash
bun install --frozen-lockfile
bun run dev
bun run type-check
bun run build
```

更新记录见 [CHANGELOG](CHANGELOG.md)，发布流程见 [docs/releasing.md](docs/releasing.md)。

本地配置中的节点头部标签与三网回程设置见 [配置说明](docs/return-routes.md)，独立采集助手/插件见 [稳定版伴生模块说明](docs/companion.md)。自动结果仅管理员可见；真实网络 traceroute/ASN 尚未执行，不代表线上路径已验收。

## 来源与许可

基于 [Komari Glassmorphism](https://github.com/sanrokamlan-prog/komari-theme-Glassmorphism)，三网功能参考 [Glassmorphism Three-Network](https://github.com/vlongx/komari-theme-Glassmorphism-three-network)。保留原始作者 Tokinx、上游维护者 sanrokamlan 的署名与历史，其他第三方声明见 [THIRD_PARTY.md](THIRD_PARTY.md)。

本项目采用 [MIT License](LICENSE)。
