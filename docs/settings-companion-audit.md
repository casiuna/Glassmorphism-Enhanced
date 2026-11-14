# Enhanced 1.2.1：后台设置与伴生组件依赖审计

本轮仅整理主题后台与手动编辑体验；不实施新的远程执行、采集协议或后台任务机制。

## 结论

| 功能                                     | Enhanced 原生主题 ZIP             | Komari 服务端 Plugin                                             | 节点 Helper / 远程执行                                   |
| ---------------------------------------- | --------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------- |
| 手动三网名称、显示开关、TTL配置          | 足够；使用现有托管 theme_settings | 不需要                                                           | 不需要                                                   |
| 正常节点监控、已有 Ping / Transit / 流量 | 沿用已有 Komari 能力              | 不需要 Enhanced Plugin                                           | 不需要 Enhanced Helper；无需开启远控                     |
| 消费已在公开主题 JSON 中导入的结果       | 兼容保留；公开 JSON 禁止私有信息  | 不一定需要                                                       | 消费本身不执行探测                                       |
| 现有可选私有自动链路                     | 管理员界面消费结果                | 每个 Komari 服务端一次：UUID认证、策略/租约/限流、私有存储与读取 | 仅自愿参与源端探测的节点安装 Helper；不要求所有 VPS 安装 |

Helper 必须在实际测量来源节点发起探测；只在面板服务器运行不能替其他 VPS 的实际回程。它不是普通主题显示功能的前提。所有自动相关开关保持默认关闭，本页面不静默安装、启用 systemd/OpenRC、开启远程执行或提交任务。

## 原生 Agent 能否替代 Helper

审计使用固定标签源码，而不是将当前主分支当作 1.6.0：

- Komari `1.6.0`，commit `1b76b7ad5bc3de6529bb7f0577069b4ac241fec3`。
- 当前隔离测试所用 komari-agent `1.5.11`，commit `c7bafb79b1a73ed9e14e2c248ae4d4163e506036`。这两个产品版本线不能混写。
- Agent [server/task.go](https://github.com/komari-monitor/komari-agent/blob/c7bafb79b1a73ed9e14e2c248ae4d4163e506036/server/task.go)：`NewTask` 遵守 `DisableWebSsh`；普通执行将服务端字符串交给 `runTaskCommand` / `buildTaskCommand`，Unix 分支使用 `sh -s`。这是通用远控，不是固定 argv 的 traceroute 专用能力。
- Agent [server/websocket.go](https://github.com/komari-monitor/komari-agent/blob/c7bafb79b1a73ed9e14e2c248ae4d4163e506036/server/websocket.go)：处理 `agent.exec` 并交给 `NewTask`。其声明 exec capability 不意味着可以忽略本地禁用检查。
- 服务端 [web/rpc/jsonrpc/admin.task.go](https://github.com/komari-monitor/komari/blob/1b76b7ad5bc3de6529bb7f0577069b4ac241fec3/web/rpc/jsonrpc/admin.task.go) 和 [pkg/rpc/permission.go](https://github.com/komari-monitor/komari/blob/1b76b7ad5bc3de6529bb7f0577069b4ac241fec3/pkg/rpc/permission.go)：任务查询保留管理员边界，admin 与 agent 主体互不冒充。

**结论：有执行能力，但不能直接安全替换现有 Helper。** 接入自动链路仍需审核调度主体权限、限定命令/目标/超时与输出、解析与绑定结果、lease/TTL和私有存储适配，以及节点探测工具/权限可用性。现有 Enhanced Plugin 只批准 Node 兼容与 HTTP routes，不授予 system RPC / exec。浏览器持有管理员会话也不应因此悄悄接入通用 Shell。仅启用原生 Agent 的 exec 也不能自行提供 traceroute、受限采集器和可信线路分类。

本轮不实现该桥接，不扩大默认权限、不禁用任何本地拒绝规则。若 Agent 禁用了远程执行，保持拒绝；正常监控、已有 Ping 和手动名称继续正常。是否设计独立的可选原生任务适配，等待用户另行决定。

## 设置与兼容性

- `komari-theme.json` 是唯一分组定义，严格 01→02→03→04→05；Enhanced 管理直接按同一 manifest 分组，不再独立维护分类键集合。
- 三网线路开关、已有自动消费开关、TTL、manual JSON 与 Ping/Transit 位于 03；外观/背景字段仅在04；可选安装器/Plugin/Helper诊断位于03默认折叠的高级区域。
- 03 默认显示节点选择与三个手动名称输入框，不读取 Plugin API；JSON编辑器折叠，但仍是同一个 `returnRouteConfig`，没有第二个数据库或 localStorage 配置。
- 使用既有授权服务和完整配置读回保存；手动保存不绑定自动开关、不触及Plugin，保留未知主题字段、其他节点和自动证据。同节点并发修改拒绝覆盖。
- 原生服务器内置后台只能使用其 managed 字段编辑器，不能由主题插入自定义 Vue 控件；这里保留同一个 JSON 字段，提示使用主页可视化入口。主题自带兼容后台仍可桥接 Enhanced 管理，不声称接管服务器内置后台。
- 配置 key、type、default、options 不变，`version/nodes/manual` 兼容性由既有解析器和测试验证；仅重排分类及改进帮助文案。
- 前台三等分卡片、Ping/Transit/流量算法、Full安装器与版本降级保护均冻结，不在本轮更改。

## 本轮测试条件修正

复验发现旧原生集成 fixture 将 CLI 的连字符参数名写进了 Agent JSON。Agent 1.5.11 的实际 JSON 字段为 `disable_auto_update`、`disable_web_ssh`、`get_ip_addr_from_nic`、`custom_ipv4` 和 `custom_ipv6`（见固定版本的 `cmd/flags/flag.go`）。测试现使用正确字段，并在隔离进程参数中显式禁用更新和远控；旧通过数量不能证明这些条件当时生效。本轮重新运行原生套件核验，不向生产节点提交任务。

无 Plugin 场景会明确删除隔离实例的 Plugin；原生 `deletePlugin` 会移除其私有目录，不能将 `purge: false` 误认为保留 checkpoint。场景结束后通过既有管理员 `restore-node` API 恢复本测试提前保存的 checkpoint，并完整读回核对，再继续原有集成测试。此恢复属于显式测试准备，不是手动线路表单的行为，也不修改 Full 安装器。

## 自动探测发布边界

现有历史湖北 CDN 六份原文与隔离 fixture/replay 不等于实时生产闭环。Helper 实时采集→正常在线提交→可靠 ASN / 商业线路分类仍未通过生产验收，不作为生产可用功能承诺。没有新公网探测、ASN查询或生产改动。

测试与真实后台截图见本轮 `test-results/v121/settings-companion-review/` 的报告；旧通过数量不得冒充本轮执行。
