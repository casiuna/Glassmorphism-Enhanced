# Enhanced v1.2.1 · 可选伴生组件 0.3.0

**普通用户不需要阅读本页才能安装主题。** [原生主题 ZIP](../README.md#普通主题安装推荐) 已包含标签、手动线路、Ping、Transit、价格和独立流量周期等基础功能，不需要 Plugin、Helper、Full 或远程执行。

本页仅说明默认关闭的实验性自动采集链路。Theme / Full 为 `1.2.1`，Plugin / Helper 为 `0.3.0+git.0332d5f`，实测隔离后端为 Komari 1.6.0；1.6.1 未实测。组件已经正式发行，不等于实时公网采集和可靠商业线路识别已通过生产验收。

## 安装范围与职责

- **服务端 Plugin**：每个 Komari 服务端安装一次，用于原生 UUID 身份认证、策略／租约／限流、私有结果存储和管理员读取。
- **节点 Helper**：仅在明确授权、需要实际源端探测的节点本机安装。面板服务器不能替其他 VPS 测量它们的实际回程，不要求所有被监控节点安装 Helper。
- **原生 Agent**：保持原有监控和 Ping 能力，不由 Enhanced 开启远控、改写配置、替换或重启。禁用远程执行不影响主题和手动线路。原生任务替代 Helper 仅完成审计，没有实现通用 Shell 桥接。

需要统一高级安装／备份／回滚工具时，阅读 [可选 Full 指南](full.md)。Full 内包含：

- `komari-theme-Glassmorphism-build-0332d5f.zip`：可单独上传的原生主题 ZIP。
- `enhanced-route-probe-0.3.0.zip`：原生 Plugin ZIP，批准范围仅为 Node 兼容模块和固定 HTTP routes，不包含 system RPC / exec / SSH。
- `enhanced-route-helper-0.3.0.tar.gz`：节点侧可选 Python Helper；不是主题 ZIP，也不替代 Agent。详细依赖和权限要求见 [Helper 指南](../companion/helper/README.md)。

## 明确授权，不是默认安装步骤

在「Enhanced 管理 → 03 · 线路与延迟」主动展开可选伴生区域，才加载版本、存储、登记、心跳和采集诊断。出现「可选 Plugin 未安装」不表示主题损坏；手动名称在上方三个输入框独立保存。

如选择实验链路，先备份旧包和私有状态，按 Full 或 Helper 专门指南在相应位置接入，审核现有权限；全局、指定 UUID 和节点本地配置均需明确授权。节点名称不作为身份；没有匹配策略的节点不派发任务。周期、城市由插件策略管理，不重复维护第二套主题配置。

0.3.0 保留 schema1，新增独立 TCP／UDP schema2；经明确批准的 CDN 使用 schema3。固定地区、双端白名单、协议选择和升级顺序见 [TCP／UDP 说明](tcpquality-adaptation.md) 与 [CDN 证据边界](cdn-replay-validation.md)，不得照抄历史 0.2 的隐式 `traceroute -A` 命令。

Helper 仍要求 Python 3.10+ 和操作者提供的 Linux traceroute，不自动安装依赖、不经 Shell、不接收任意命令／目标／参数、不授予 raw-socket 能力或自动提权。TCP 可能因主机权限不足返回 `permission-denied`，不能静默改成 UDP 或伪称成功。服务模板不会自动安装／启动，systemd / OpenRC 实际运行不在离线测试承诺内。

## 身份、私有数据与资源边界

自动详细结果仅管理员可读；匿名用户只看到公开手动名称，不读取 snapshot 或逐跳证据。管理员保留同源校验，节点上报绑定原生 principal 的 UUID 和租约，错误身份、目标、租约、过期及无效载荷被拒绝。既有请求体限制、限流、缓存和 0600 原子持久化规则不变；损坏存储失败关闭，不覆盖成空状态。

Komari 1.6.0 没有本版本适用的原生短 TTL enrollment。Helper 本地仍需保留该节点的原生长期凭据；它不是 Helper 专用最小权限身份。配置目录 0700、配置／凭据文件 0600、归专用用户所有；凭据不进浏览器、argv、环境、URL、日志或发行包。不能接受此取舍时，只使用主题手动线路。

Team Cymru 默认关闭，启用需要节点本地双重明确同意。没有同意时不执行隐式 ASN 查询，缺少可信 ASN 证据保持未知；IP 前缀不是 ASN，单个 AS4809 响应也不能认证 GIA 商业产品。

## 停用、升级与回滚

手动名称优先于有效自动结果。先关闭自动消费／节点与全局策略，再停止 Helper 或所选服务，之后按 [Full](full.md#升级异常恢复回滚) 和 [Helper](../companion/helper/README.md#stop-uninstall-and-rollback) 指南处理匹配的代码、旧 Plugin 包和私有 checkpoint。原生删除 Plugin 会删除其私有状态，必须先保留受保护备份，不能把删除当作无损停用。

历史 v1.2.0 使用 0.2 系列，历史说明仅适用于当时匹配的包／备份，参见 [v1.2.0 原版文档](https://github.com/casiuna/Glassmorphism-Enhanced/blob/v1.2.0/docs/companion.md)。新 0.3 输出不可直接交给旧插件；不改活跃数据库来伪造版本兼容，不放宽降级保护。

## 证据与文档勘误

实际隔离进程、原生鉴权、租约、fixture 回传、浏览器管理、配置保存、重启持久化及回滚测试见 [验证范围](full-validation.md)。fixture／replay 和历史路径数据不是生产实时 Helper → Plugin → 可靠分类的闭环证明。CN2、9929、CMI 等词汇只能随可信证据保守呈现，不承诺商业线路认证。

本页是主分支维护修订。v1.2.1 的 Tag、ZIP 和 Full 包不变，包内旧文档不会随主分支更新；Release 已链接维护文档。本轮不接触生产 Komari、Agent、VPS、数据库或官方主题市场。

## Attribution

Transit 参考提交 `ee9f31c5ff104e033ded858171ce0b63c672e878`，MIT：Copyright (c) 2026 yyy622hhh；Copyright (c) 2025 Tony Liu。完整许可随组件保留，见 [THIRD_PARTY.md](../THIRD_PARTY.md)。没有复制未获许可的官方后台、旧 admin:exec、tags 写回或 URL-token 传输。
