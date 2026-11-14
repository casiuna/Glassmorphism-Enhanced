# Enhanced 回程采集 · v1.2.0 稳定伴生模块

> **v1.2.1 开发树补充（尚未发布）**：当前 0.3.0 开发组件新增独立 TCP/UDP、显式 Team Cymru 同意与本地持久化限频，并移除隐式 `traceroute -A` 查询。新行为、升级顺序与安全边界见 [TCP/UDP 专项说明](tcpquality-adaptation.md)。下文 0.2 系列说明保留为已发布 v1.2.0 的历史安装/回滚参考，不应套用其 `-A` 参数到新 Helper。

> **统一入口为 [Enhanced Full v1.2.0](full.md)**：一个外层 `.tar.gz` Release asset，内含一个已校验的 Full ZIP；Theme / Plugin / Helper 是同一产品的内部模块。当前稳定主题身份为 `Enhanced` / `1.2.0`，模块为 0.2 系列；下文仅在涉及旧安装、升级或回滚时提及历史版本。

适用：**Komari 1.6.0**、明确授权的 Linux 节点。Komari 1.6.1 本轮未实测。Helper 不会被浏览器或安装器静默远程部署；真实公网 traceroute/ASN 尚未执行，不能把 fixture 或本地成功宣称为线上路径验收。

## Full 内部模块（也可按需手动安装）

- `komari-theme-Glassmorphism-build-<sha>.zip`：Komari 后台主题上传。根目录仍为 `komari-theme.json`、`preview.png`、`dist/`，没有 helper 二进制或运行时凭据。
- `enhanced-route-probe-0.2.0.zip`：后台插件上传。根目录有 manifest、script/protocol/storage/limiter、MIT LICENSE 和 BUILD.json。只批准 node 兼容模块与 allowRoutes，没有 system RPC、exec、监听器、hooks 或 HTML 注入。
- `enhanced-route-helper-0.2.0.tar.gz`：在选定测试节点解压。包含 Python 3.10+ 标准库助手、显式目录安装器、systemd/OpenRC 模板、默认禁用的示例配置及 README/MIT/BUILD；不上传进主题包，不替代 Komari Agent。

包校验值和构建提交见本地 `test-results/release/artifacts.json`、`SHA256SUMS`，最终验收见 `test-results/release/delivery-verification.json`。不要拿旧基线 SHA 的候选包当正式发行物。

## 最小安装流程

1. 先备份当前主题 ZIP、整个 Enhanced 托管配置、已有插件 ZIP/私有 storage。上传稳定主题并选择 Enhanced；Enhanced 1.1.1 沿同一身份升级并保留设置，不修改 tags/Ping 任务或直接编辑数据库。
2. 上传独立插件 ZIP，查看权限再批准并启用插件。插件内「允许已安装助手轮询采集」默认关闭；打开后，填写 UUID 策略：

   ```json
   {
     "00000000-0000-4000-8000-000000000001": {
       "enabled": true,
       "city": "beijing",
       "periodMinutes": 360
     }
   }
   ```

   用后台真实的**测试节点 UUID**替换键。城市只支持 beijing/shanghai/guangzhou，周期 60–10080 分钟。节点名称不参与绑定；没有匹配策略的节点不派发任务。

3. 按 [helper 安装指南](../companion/helper/README.md) 在选定测试节点安装 Python 助手。代码放只读版本目录，使用无特权专用用户；配置目录 0700、配置和该节点 Agent token 文件 0600、归该用户所有。凭据不放 argv、环境变量、URL、浏览器或 service 文件。只允许 HTTPS panel origin；literal loopback HTTP 必须明确允许，不能指向远端 HTTP。
4. 先以前台 `--once` 验证，再明确选择一个服务管理器启用。助手每 30 秒主动轮询，只认固定城市 job/一次性 lease，面板不能下发命令、地址或 traceroute 参数。首次有效轮询可自动产生采集任务，后续按周期缓存；没有安装/启用助手时不会由 Komari Agent 代执行。
5. 在主题「10 · 回程线路」同时打开「显示回程线路」「消费已采集的自动结果」「连接 Enhanced 回程伴生插件」。TTL 默认 24 小时，可设 1–168 小时。以管理员身份登录主题后查看 CT/CU/CM、时间、来源和错误状态。
6. 手动覆盖继续使用 [按 UUID 的配置](return-routes.md)。优先级为 manual > 时间更新的自动证据（companion 或导入）；旧 companion 缓存不能覆盖更新的导入结果，过期证据不冒充当前线路。数据只在当前视图合并，**不写回普通 tags，也不覆盖整份主题设置**。

## 安全读取边界

**自动结果仅管理员可读。** 访客保留原有公开手动配置，不调用自动 snapshot API。这样隐藏节点、私有站点和逐跳证据不会因新建匿名 API 而外泄。管理员认证使用 Komari 正式 session cookie；Agent 认证使用 1.6.0 原生 JSON POST body token，插件只消费 principal.client_uuid，不自创签名、不读取原始身份凭据。没有安全依据就不会开启匿名自动发布。

写回仅接受本节点租约绑定结果；错 UUID、过期/错误租约、未知城市/目标、反向结果、重复 TTL、无效 ASN、未知字段及错误状态被拒绝。相同已完成结果可幂等重试，不能改写成另一份结果。管理员路由还有同源自定义头与 Sec-Fetch-Site 检查。代理层需配置此路径 16 KiB 请求体限制，禁止记录请求体/凭据，保留方法/状态/耗时等审计元数据；Komari 原生主体识别在插件自己的 body 限制之前运行。

## 探测证据和资源限制

方向固定为 **测试节点 → 国内电信/联通/移动九个内置 IPv4 目标**。调用 Linux traceroute 的 UDP 默认模式，安全 argv 为 `-n -A -q 1 -w 1 -m 20 <白名单目标>`；不经 shell、不升权、不自动切换 ICMP。每家最多 25 秒、20 跳、64 KiB 输出，串行三家；超时/超限终止整个本次子进程组。`-A` 的逐跳 ASN 作为证据，不用 IP 前缀猜 ASN，更不把 Ping RTT 当 traceroute。

插件最多 4 个有效并行租约；每 UUID 有 60 秒排队冷却、180 秒 lease、10 分钟任务有效期，轮询/结果有独立 token bucket。私有 storage 以 0600 临时文件原子替换；读写错误/损坏失败关闭，不把空状态覆盖损坏备份或假称已持久化。无真实报告时保持未检测、未知或明确失败状态。

分类覆盖 163、CN2、CTGNET、4837、9929、10099/CUG、CMNET、CMI、CMIN2，保留混合线路与不确定性。CN2 GT/GIA 只在证据下显示候选；单一 ASN（甚至多个 AS4809 响应跳）不构成 GIA 商业产品认证。状态包括 unknown、timeout、permission-denied、no-traceroute、probe-failed、output-limit。

## 本地实测与尚未验证

- 使用真实官方 Komari **1.6.0** 后端和本地 Agent，实际上传/启用插件与主题包；真实鉴权、UUID 绑定、受限 helper 进程执行 fixture、回传、浏览器显示、native 托管设置保存/手动优先、TTL 时钟推进、改名、重启恢复、限流、鉴权拒绝、卸载路由均有集成断言。
- fixture 数据和本地子进程 fixture 均明确标识，主题显示「模拟」。**没有执行真实 traceroute、访问真实节点或验证真实三网线路**。真实目标是否响应、AS lookup 服务可用性及网络防火墙策略由后续授权测试决定，不能拿 fixture 成功代替。
- helper 真实代码具备固定 argv 的执行路径，并有本地子进程 fixture 覆盖超时、输出超限和权限错误；不是仅返回硬编码结果的 stub。
- 文件安装/卸载、重复安装拒绝及保留操作员文件已测试；systemd/OpenRC 提供最小权限模板并做语法/内容检查，**未在开发主机启动系统服务，也未实测 OpenRC runtime**。
- 当前自动结果管理员专用；如未来需要公开发布，须另行设计同时尊重 hidden/private-site 的最小权限发布机制，不应通过宽泛 system RPC 或匿名 endpoint 草率解决。

## 停用 / 卸载 / 回退

1. 先关闭主题 companion/自动消费开关，公开手动配置继续可用；再关闭插件全局/节点策略。
2. 在测试节点停用并停止对应 systemd/OpenRC 服务，移除该 service 模板并 reload。调用解压包中的 `install.py --prefix <原版本目录> --uninstall`；只删除未修改的安装器拥有文件，未知文件、私有配置与 token 不擅自删除。
3. 可通过原生插件后台禁用/删除该独立插件。**删除会删除其私有状态**，如需回退保留历史请先备份整个 plugin/storage。
4. 回退时停止助手，保留新版本目录，将 `current` 指向备份的旧版本，恢复旧插件 ZIP/对应 state 和备份主题/配置，再明确重启测试服务。无需改 Agent、Ping、普通 tags、数据库或防火墙。

## 复现实验（开发目录）

用现有 Node、Python、Chromium 和官方后端二进制，不修改全局环境：

```sh
npm run build
python3 scripts/package-route.py
node --test tests/companion/protocol.test.cjs
python3 tests/companion/test_helper.py
node tests/companion/integration.mjs
node node_modules/@playwright/test/cli.js test -c tests/request-manager.config.ts
```

真实集成实验仅在当前仓库 `test-results/route-lab-*` 创建全新 loopback 后端/私有运行目录；临时随机登录/Agent 凭据不会输出到报告。Chromium 若需 sysroot，复用本任务 `../tools` 的浏览器/字体/动态库环境。所有子进程仅由实验自身创建并清理，不操作其他工作树或服务。测试证据及运行 DB 不进入任何发行包或 Git commit。

## Attribution

Transit 参考提交 `ee9f31c5ff104e033ded858171ce0b63c672e878`，MIT：Copyright (c) 2026 yyy622hhh；Copyright (c) 2025 Tony Liu。仅选择性适配队列/租约、权限上下文、限流及持久化模式，助手/安装器重新实现为标准库版本；完整 MIT 随两个独立包提供。见 [THIRD_PARTY.md](../THIRD_PARTY.md)。没有复制未获许可的官方后台、旧 admin:exec、tags 写回或旧 URL-token 传输。
