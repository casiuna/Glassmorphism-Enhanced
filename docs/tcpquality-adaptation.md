# TCP/UDP 线路检测适配（v1.2.1 开发中）

## 许可与边界

参考 [ibsgss/TcpQuality](https://github.com/ibsgss/TcpQuality)，固定参考提交 `d0877381351257111c3c65e6fd8278e7f9f6c270`。其原创程序为 **GPL-3.0-only**；Glassmorphism Enhanced 保持 MIT。本次只参考检测/逐跳分类方法，独立实现 Python、CJS 和 TypeScript 适配，不复制 `route_label_from_ip_trace()` 或其他 GPL Shell 函数，不执行或打包参考程序，不把 GPL 文件标记成 MIT。参考文件只在项目外 scratch 中用于阅读。

不引入测速、排行榜、报告上传、动态目标、依赖自动安装、远端 Shell 或 IPv6 探测。没有新增依赖。自动采集、本地 Helper 和 Team Cymru 默认关闭；本开发轮不提交、不推送、不发布、不操作生产服务器。

## 本地选择协议

保留现有 Full / Plugin / Helper 与原生鉴权。先升级同产品的 Plugin/Helper 到本次 0.3.0 开发组件，再由节点管理员在既有 `0600` 私有 Helper 配置中明确选择：

```json
{
  "probeProtocols": ["udp", "tcp"],
  "addressFamily": 4,
  "cymruEnabled": false,
  "cymruConsent": false,
  "prefixHints": false
}
```

以上是**合并进已有配置的选项片段**，不是可覆盖整份配置的完整文件；原 panel、uuid、tokenFile、enabled 与鉴权继续保留。单协议使用 `["udp"]` 或 `["tcp"]`。不存在远端自定义目标或端口；城市仍是既有固定目标白名单，TCP 端口固定 443。没有 `probeProtocols` 的旧配置继续输出 schema1 UDP；新例子选择 schema2 UDP，但仍 `enabled: false`。

`traceroute -A` 已移除，防止原生命令绕过查询超时、预算和知情同意进行隐式 ASN 外查。默认不补全 ASN，缺少时显示未知。只有节点本地同时设置 `cymruEnabled: true` 和 `cymruConsent: true` 才查询固定 `whois.cymru.com:43`；启动时会明确告知管理员：公网响应跳 IP 会发往该服务，且会有 DNS 请求。不会向该服务发送 Agent 凭据、UUID 或整份报告。

WHOIS 最长 2 秒（包含 DNS 子进程），响应最多 4096 字节，每批最多 8 次未缓存查询；正缓存 3600 秒、负缓存 300 秒，最多 512 个 IP。查询失败、预算不足、响应不合法或 IP 不对应时，不生成 ASN。私有、保留、组播及 IPv6 地址不进行外查。

## 协议与存储

面板的鉴权、poll/job/lease 和 snapshot **外层仍为 schema1**；仅 `latest` 结果同时支持 schema1 与 schema2。旧 schema1 数据保留读取能力。schema2 保留：

- 根：UUID、固定城市、整体采集时间、helper/fixture 来源和协议集合。
- `carriers[运营商][udp|tcp]`：协议、IPv4、方向 `node-to-cn`、固定目标 ID、独立采集时间、执行状态及是否到达目标。
- `hops[]`：TTL、响应 IPv4 列表、实际 ASN 列表、`traceroute` / `team-cymru` / `none` 来源和可选低置信度前缀提示。
- `asnLookup`：是否启用外查、本段实际查询/缓存命中/失败或预算不足次数。

后端验证字段、固定目标、协议集合、IPv4、TTL 上限、重复值、ASN 及来源、时间、到达证据和外查总预算；前端复验。`reachedTarget` 只是收到目标 IP 的有效响应，不等于目标 443 服务或商业线路可用。中间 `!H`/`!X` 等不可达标志不能被误计为到达。

TCP/UDP 各自存储，不展平/拼接 hops。只有 TTL/IP/ASN 路径一致且各自状态允许时才显示一致；失败、过期、未知不能被另一个协议提升为确认。两条路径不同，即使线路名称相同，也保留“协议分歧”。多协议的旧式显示占位不含合并 hops，原始证据始终从各协议记录读取。

## 顺序分类与 UI

识别电信 163、CN2、CN2 GT/GIA **候选**、CTGNET；联通 4837、9929、10099 及组合；移动 CMNET、CMI、CMIN2 及混合。

按 TTL 排序，只折叠**相邻相同 ASN**。`10099 → 4837`、反向以及 `10099 → 4837 → 10099` 不会退化为无序 ASN 集合；同 TTL 多 ASN 不伪造先后顺序。隐藏跳、未到达目标、单跳、重复同路由器或证据不足时使用“不确定 / 疑似 / 混合 / 未知”。GIA 始终为未认证候选；普通骨干的 observed 也不是商业认证。IP 前缀只提示 CN2/163/CMI，不能替代/覆盖 ASN。

节点卡片采用单行中性文字与小型红/蓝/绿标识，只显示当前有效精简线路；全部无效则完全隐藏，未知/过期/失败/模拟/协议分歧不充当有效摘要。手动覆盖仍优先。原始时间、来源、路径与 ASN 仅在管理后台或管理员展开详情可见；匿名访客不请求私有自动结果，也不读取旧 inline 自动结果。当前没有公开自动线路摘要接口；公开 theme_settings 不得存原始自动证据，旧数据需另行授权迁移。真实单节点试用边界和完整步骤见 [single-node-route-trial.md](single-node-route-trial.md)。

流量 UUID 独立周期、五种计费方式、标签、三网 Ping、中转延迟和历史数据不因本适配而改变，前台不新增流量重置日期/倒计时。

## 执行限制及部署说明

逐运营商、逐协议串行；单条 trace 最多 20 TTL、每 TTL 一包/等待 1 秒，墙钟最长 25 秒，stdout/stderr 合计上限 64 KiB。整体 deadline 不超过 164 秒或当前租约剩余减 16 秒，编码结果不超过 11000 字节；截断以明确 `output-limit` 失败记录表达。

本地 `0700` 目录 / `0600` 文件、非阻塞进程锁及持久化 60 秒冷却共同限制重启/并发探测；面板仍有频率、租约、全局并发和请求体限制。systemd 模板保留无特权/无 capability，新增专用 StateDirectory；非 systemd 使用 token 私有目录保存锁、缓存与冷却，须允许该服务用户写入。未自动安装服务。

TCP `-T` 在部分主机需要 raw-socket 权限。现有无 capability 模板可能返回 `permission-denied`；本次不自动赋权、改 sysctl 或回退成另一个协议。IPv6、真实公网路径及真实 Cymru 成功率不在离线验收结论内。旧 plugin 不认识 schema2，回滚须停止 Helper 并使用匹配旧 plugin/状态备份。

## 可复验入口

- `python3 tests/companion/test_helper.py`
- `python3 tests/companion/test_probe_v2.py`
- `node --test tests/companion/*.test.cjs`
- `playwright test -c tests/request-manager.config.ts`
- `playwright test tests/visual/route-probe-v2.spec.ts`
- `node tests/companion/integration.mjs`（仅已有隔离 Komari 1.6.0 / Agent / 浏览器运行环境）
- 项目 lint、type-check、build 与完整 Playwright 回归。

fixtures 是标明模拟的输入，不是公网测量结果；WHOIS 成功、失败、缓存和超时使用离线替身验证。实际本轮结果记录在 `test-results/v121/tcpquality/`，最终数量以报告为准，不把测试入口或历史通过数当作当前完成证明。
