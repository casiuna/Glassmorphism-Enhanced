# v1.2.1 / 0.3.0 单台 Linux VPS 真实线路试用手册

> **本轮仅完成源码/配置流程只读核对和离线准备，没有连接 VPS、安装 Helper、执行真实 traceroute/WHOIS、开启守护进程或修改权限。** 下列远端写入与公网探测步骤必须逐项取得单独授权后，才由节点管理员执行。页面预览与 fixtures 不是实测证据。

## 1. 组件与交付门槛

- Theme：**1.2.1**，不是 0.3.0。`short=Enhanced`，继续独立产品版本。
- Plugin：**0.3.0**。`enhanced-route-probe`，只批准 Node 兼容和 HTTP routes，不批准 system RPC / exec。
- Helper：**0.3.0**。必须含 `enhanced_probe_v2.py`，不是原生 Komari Agent 的替代品。
- 原生面板：已隔离验证 **Komari 1.6.0**，不把 1.6.1 或其他版本当作已验证。

使用**同一来源构建**的三组件，核对 manifest、Full `full-manifest.json` 的版本矩阵、完整 commit、每个文件的 SHA-256。打包后的 Plugin/Helper 版本形如 `0.3.0+git.<short-sha>`；比较完整后缀，不能只看文件名或 0.3.0。鉴权、poll/job/lease/snapshot 外层仍为 schema1；`latest` 同时读旧 schema1 和新 schema2，双协议必须是 schema2。

**当前工作树未提交，已有 Full 产物是 dirty / DEVELOPMENT_ONLY，本地预检通过不等于可供公网安装。** `manage.py --allow-development-bundle` 只允许显式 literal loopback；不能换成域名、改 manifest、去掉校验或开启 `allowLoopback` 来绕过。公网试用之前，必须另行授权产生可审核、来源固定、干净源码的匹配试用构建；这不自动授权提交、Tag 或正式 Release。本轮停在准备阶段。

保留旧 Theme ZIP、旧 Plugin ZIP、旧 Helper 代码/安装收据、原有完整主题配置/插件策略，以及**升级前**管理员私有 checkpoint 与节点私有配置备份。备份不放在 Web 根目录、包目录或公开附件中；不复制全库/删除历史。

## 2. 只读预检（节点管理员执行，不包含探测）

在选定的**唯一**测试 VPS 和经授权的非 root 账户检查：

```bash
id -u
python3 --version
command -v traceroute
/usr/bin/traceroute --version
date -u '+%Y-%m-%dT%H:%M:%SZ'
```

- Python >= 3.10、POSIX/Linux。实际程序仅查 `/usr/bin/traceroute`、`/bin/traceroute`，必须支持 `-4 -n -q 1 -w 1 -m 20`，TCP 还需 `-T -p 443`。BusyBox/其他变种不一定兼容；不兼容先停止，不自动装包。
- 只读检查当前 traceroute 文件/既有 capability 和容器策略；**不执行 setcap、sudo、chmod 原 Agent 配置、sysctl 或防火墙修改**。TCP 缺权限是可接受的未验证边界，不是静默换成 UDP 的理由。
- 有正常 UTC 时钟和可信 HTTPS 面板 origin（不能含用户名、密码、路径、query 或 fragment）；不关闭 TLS 验证，不使用重定向。
- 经明确授权的该节点原生 Agent 配置副本，能被试用账户合法读取，且 owner-only。不能通过改变现有生产文件权限获得读取；若没有合规可读的配置，停止并单独处理授权。
- 无已运行的同 UUID Helper/cron/定时器；不停止原生 Agent。不占用或改写旧 Helper 目录。
- 只允许本程序固定三网目标和面板出站；不新增入站监听。不以 Ping 延迟推断回程。

本手册中的 shell 变量仅保存 origin/UUID/路径，**不保存 token、Cookie、密码**。下文不是可盲目整段粘贴的一键安装脚本。

## 3. 防止“只测一台”误开其他节点

先在管理员后台读取并私有备份 Plugin 的 `enabled` 与整个 `nodes` 策略，记录当前全局消费开关、TTL 和当前 UUID 原值。

- 全局原已开启：保留其值，不改其他 UUID；只对目标 UUID 做经授权的短时启用。
- 全局原关闭且其他 UUID 有 `enabled:true`：**停止**。不能为测一台而唤醒那些已有 Helper。优先使用隔离测试面板；不能擅自禁用其他 UUID 来迁就本试用。
- Plugin 服务原停用但有已授权策略时，也先评估启用服务的全局影响，不能直接点“批准并启用”。
- 确认目标 UUID 与节点原生身份一致，不按名称猜测。城市只选北京/上海/广州，周期合法范围 60–10080 分钟；单次试用可用 10080，但**真正阻止持续探测的是 `--once`、不安装服务以及及时关回当前 UUID，不是长周期本身**。
- 在没有其他启用节点的隔离策略中才可临时打开全局开关。不要在测试过程中改变策略城市或关闭正在提交结果的租约；等单次执行退出后清理。

## 4. 授权后部署面板组件（先 dry-run）

**前提：已获得面板组件变更的单独授权，有干净且匹配的 Full 包与旧版本归档/私有备份。** 在管理员本机安全解包 Full；先检查版本/校验值，再使用包内 CLI。当前 dirty 包不适用于本节。

```bash
python3 manage.py inspect
python3 manage.py install --panel "$PANEL_ORIGIN" --username "$ADMIN_NAME" \
  --previous-theme "$OLD_THEME_ZIP" --previous-plugin "$OLD_PLUGIN_ZIP" \
  --backup-dir "$NEW_PRIVATE_BACKUP_DIR"
```

密码由隐藏交互读取；也可使用包外 `0600` 的 `--session-file`，不要把 Cookie 放进命令、URL、环境或日志。检查 dry-run 计划、只限目标组件与配置的影响范围，然后才在**再次确认**后追加 `--apply --approve-route-plugin --activate`。按 CLI 拒绝项处理，不用数据库直改或删除插件规避冲突。Plugin 重装与删除的 storage 语义不同，不能先删除旧插件再想办法找回证据。

读取管理页实际 Theme / Plugin / health 版本，确保同一构建和 `storage=healthy`，配置仍默认关闭。主题本身不会给 VPS 安装程序。

## 5. 授权后接入节点：只登记/安装，不启动

使用已授权的现有非 root 试用账户。`CODE_PREFIX` 必须是其可写范围内的**全新版本目录**；`STATE_DIR` 是包外专用私有目录；不要重指向现有生产 `current` 链接。代码不能被不可信用户写入，私有目录 `0700`、配置/token `0600`，仅针对本次新建的试用文件。原生 Agent 文件/服务/权限保持不动。

先预演：

```bash
python3 manage.py node --panel "$PANEL_ORIGIN" --uuid "$NODE_UUID" \
  --agent-config "$AUTHORIZED_PRIVATE_AGENT_CONFIG" \
  --prefix "$NEW_CODE_PREFIX" --state-dir "$NEW_PRIVATE_STATE_DIR"
```

经节点安装的单独授权后，使用完全相同参数**只加 `--apply`**。**不加 `--enable-local`、`--run` 或 `--fixture-dir`。** 这一步只做 native register 身份校验和枚举文件安装，生成私有收据、token、`helper.json`，不安装 systemd/OpenRC/cron、不启动探测、不改变 Agent。回读实际注册 UUID/版本；任何身份、来源或所有权冲突都停止，不强制覆盖。

初次 Full bootstrap 保留兼容的旧 UDP 配置形态；**必须在下一节本地显式加入 `probeProtocols`，否则不能声称启用了双协议**。反复 bootstrap 会保留既有 enabled/本地选项，不可把再次运行接入命令当作停用或协议配置工具。

## 6. 本地明确选择 UDP/TCP，第一轮不使用外查

在该 VPS 的私有 `helper.json` 中保留真实 `panel`、`uuid`、`tokenFile`；只合并下列选项，不把片段覆盖整份配置：

```json
{
  "enabled": false,
  "allowLoopback": false,
  "probeProtocols": ["udp", "tcp"],
  "addressFamily": 4,
  "cymruEnabled": false,
  "cymruConsent": false,
  "prefixHints": false
}
```

默认不外查，且 traceroute 不使用 `-A`。因此标准 traceroute 输出没有 ASN 时，真实 hop IP 仍保留，但 `asns:[]` / `asnSource:none` / `unknown` 是诚实的预期结果，**不是应该填上 163/CN2 的缺陷**。

经本次公网探测的单独授权后：临时启用目标 UUID，保持其他策略/全局 TTL/显示原值；节点管理员将该私有配置的 `enabled` 改为 true，前台只运行一次：

```bash
python3 "$NEW_CODE_PREFIX/enhanced_route_helper.py" \
  --config "$NEW_PRIVATE_STATE_DIR/helper.json" --once
```

禁止省略 `--once`；禁止后台 `&`、systemctl enable、OpenRC、cron 或重启自动运行。程序只允许固定参数、固定城市三网 IPv4 目标；UDP/TCP 各自运行和保存，TCP 固定 443。若返回 `idle`、`disabled` 或无 job，先查看策略/周期/租约，不重复高频执行、不清冷却状态。

每条 trace 最长 25 秒/20 TTL、每 TTL 1 包/等待 1 秒、输出合计上限 64 KiB，串行执行；整批最多 164 秒或当前租约剩余减 16 秒，上传编码结果最多 11000 字节。本地锁及持久化 60 秒冷却、面板租约/请求桶仍生效；不要手工删除这些文件绕过限制。

`result-accepted` 只表示回传被接受，**不是所有协议成功、ASN 齐全或商业线路已认证**。单次退出后先保存管理员私有证据，再关闭当前 UUID 和本地 `enabled`，恢复仅为本次改变的开关；不改其他节点。

## 7. 第二轮可选 Team Cymru：必须另行本地授权

必须向管理员告知并取得本地同意：**公网响应跳 IP 会发给固定 `whois.cymru.com:43`，并进行 DNS 解析**；不发送 Agent 凭据、UUID 或整份报告。即使面板管理员启用节点策略，也不能代替 VPS 管理员的本地授权。

只有节点私有配置同时为下列值，且包含明确 `probeProtocols`，才能查询：

```json
{
  "cymruEnabled": true,
  "cymruConsent": true
}
```

核对告知后，才按上一节再授权一次 `--once`；遵守已有冷却/周期，不清缓存强迫查询。启动 stderr 应有外查告知。每批最多 8 次未缓存查询，每次含 DNS 的墙钟上限 2 秒、4096 字节；正缓存 3600 秒、负缓存 300 秒、最多 512 IP。私有/保留/组播/IPv6 不外查。预算可能在后续协议/运营商之前耗尽，应如实显示失败/预算不足统计与缺少 ASN，不“补齐”虚构数据。

失败、网络不通、服务异常、响应 IP 不匹配或格式不合法就退回未知。`prefixHints` 如另行选择启用，也只是明确的低置信度提示，**绝不能写入实际 ASN**。结束后将本次本地外查选项及 enabled 恢复到原值，当前 UUID 策略关回；不启用持续采集。

## 8. 实测验收记录（仅管理员）

在 Enhanced 管理后台查看各运营商各协议，私有留档而不发到公开页面/聊天：

- 精确 UUID、同源组件完整版本、城市/固定 target、`family:4`、协议、方向 `node-to-cn`。
- 本次真实 UTC `collectedAt`、整体 `source:helper`（不是 fixture）、原生 job/租约提交状态；使用真实操作前后时间界定，不能复用示例时间。
- 每个 TTL 的实际响应 IP、空跳 `*`、真实 ASN、`asnSource`（traceroute / team-cymru / none），ASN 查询统计与 consent 状态。
- 分别保存 UDP 与 TCP 的 `status`、`reachedTarget` 和完整 hops；不能把 UDP 成功拿来填 TCP 失败，或把两条路径拼成“已确认线路”。
- `permission-denied` 是主机权限边界；`no-traceroute` 是依赖边界；timeout/probe-failed/output-limit/unknown/expired 不算成功识别。**不为求绿改权限、换协议、隐藏错误或伪造 asns。**
- `*` 是无响应/隐藏，不等于不存在中间网络。目标 IP 响应也不证明 TCP 服务或商业线路可用；`!H`/`!X` 不可达不算到达。
- CN2 GT/GIA/CTGNET 等候选、ASN 出现、IP 前缀、TCP/UDP 一致均不能认证商业套餐。分歧/部分失败要待复核。

建议结论分开记录为“采集/传输是否工作”“是否有可靠 ASN”“是否足以做保守分类”，不要用单一通过掩盖缺失项。

## 9. 访客与公开设置边界

新版卡片仅显示中性文字/小标识的当前有效摘要；三网没有有效结果就完全隐藏。未知、过期、失败、模拟、协议分歧不显示为当前线路。详情在管理员展开区/管理后台保留，不以隐藏失败记录冒充通过。

**本轮不实现公开自动线路发布。** 匿名访客不请求私有 snapshot、不显示自动线路或原始 IP/ASN/采集时间；仅保留管理员手动发布的普通线路标注。后台 snapshot/health/checkpoint 保持管理员鉴权，没有新增匿名接口。

Komari 的 `theme_settings` 本来是公开数据，**不能把原始 auto/hops/IP/ASN/checkpoint 填进 `returnRouteConfig`、节点标签、公开备注或公开 JSON**。旧 inline auto 仅为管理员兼容读取；客户端不显示它不等于服务器已把它保密。部署前应只读检查公开配置中是否已有此类旧数据；若存在，停止并由管理员另行授权私有备份/迁移，不能宣称本轮客户端更改追回了已公开的数据。当前自动实测结果必须只进入 Plugin 私有存储。

未来如需公开自动线路，须单独设计并审查管理员显式 opt-in、逐 UUID/公开节点过滤、服务端白名单脱敏摘要（无原始 IP/ASN/隐藏节点），不能仅在浏览器隐藏字段。

## 10. 停用与回滚（只动本次范围）

1. 单次命令正常结束后，确认无 Helper 进程/守护服务；如仍运行先由节点管理员停止该次 Helper，不动原生 Agent。保存真实失败也保存成功，均为私有资料。
2. 关闭本次 UUID、本地 enabled，并恢复本次新增的外查/消费选项。全局开关仅在确认没有其他节点依赖、没有并发改动时恢复原值；不要把整份旧 map 强行覆盖当前生产配置。
3. 如果只装了新目录、未替换旧程序，保留旧代码/状态不动；先 dry-run 卸载本次枚举文件：

```bash
python3 manage.py uninstall-node --prefix "$NEW_CODE_PREFIX" \
  --state-dir "$NEW_PRIVATE_STATE_DIR"
```

确认确实已停止并取得卸载授权后才加 `--apply --helpers-stopped`。卸载保留 token/config/cache/不归安装器所有的文件；私有资料是否删除另行决定。不要 `rm -rf`、删除历史计数器或恢复整库。

4. 若面板组件确实升级过，使用**创建该备份的同一 Full 包**，先 dry-run：

```bash
python3 manage.py rollback --panel "$PANEL_ORIGIN" --username "$ADMIN_NAME" \
  --backup-dir "$ORIGINAL_PRIVATE_BACKUP_DIR"
```

复核仅本次管理的组件、原始归档、策略/checkpoint、当前主题选择；确认无冲突后再加 `--apply --approve-route-plugin`。遇到并发配置/未知文件冲突立即停止，不强制还原。

- **版本配套**：Plugin `<0.3.0` 不认识 schema2；回滚必须先停止 Helper，配套恢复旧 Plugin 和**升级前** checkpoint，使用匹配旧 Helper/本地选项。不能把新 schema2 文件直接塞给旧程序、修改 SQLite 或仅改 version 字段。关掉自动结果消费后仍可保留手动线路。
- **最后读回**：核对实际版本/策略/当前主题与节点状态，确认三网 Ping、流量累计/周期、独立重置日、价格和 Agent 原设置没有变化。系统服务/权限从未修改时，不需要也不得“恢复”它们。

## 11. 本轮可确认与不可确认

已只读核对本节涉及的实际源码：`enhanced_route_helper.py`、`enhanced_probe_v2.py`、Plugin coordinator/routes、Full CLI/node/bootstrap 以及管理员消费链路。离线/浏览器证据放在 `test-results/v121/inline-route-trial/`。

未执行真实公网 UDP/TCP、未联系 Team Cymru、未验证目标当前可达性、未对特定 VPS 的 capability/容器网络作保证。没有把预览里的 9929/CN2/CMI 示例当作实测，也没有绕过未提交 Full 的交付门禁。**本手册不是远端执行授权。**
