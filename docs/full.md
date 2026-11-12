# Glassmorphism Enhanced Full · v1.2.0 稳定单包

这是一个产品、一个下载包，Theme / Plugin / Helper 是内部模块，不是三个独立产品。**Full 内层 ZIP 不是 Komari 原生主题 ZIP，不能整个上传到主题上传器；公开 Release 外层使用 `.tar.gz`，其中包含已验证的 Full ZIP。** 统一版本/依赖/commit/模块 SHA 见 `full-manifest.json`；每个文件见 `SHA256SUMS`。已验证范围为 Komari **1.6.0** / Linux 隔离测试节点；Komari 1.6.1 本轮未实测，真实公网 traceroute / ASN 未验证。

正式主题使用 `Enhanced` / `1.2.0`，与旧 Enhanced 1.1.1 走同一托管主题升级路径并保留已有设置。Plugin / Helper 为稳定 0.2 系列；产品版本源仍是源码 `komari-theme.json.version`，打包时附上 commit；模块版本来自各自 manifest，由 Full matrix 一并校验。

## 实际需要的操作

下载并解压一次 Full 包后：

1. **面板端一次 CLI 操作**：在管理员自己的电脑/测试机运行统一安装器，完成原生 Theme+Plugin 上传、明确的插件权限审批，可同时切换到 Enhanced。
2. **每个探测节点一次本机接入操作**：同一个包/安装器读取操作者明确指定的本机私有 Agent 配置，完成 UUID 身份核对、Helper 代码/私有配置安装与登记。可同时以前台方式运行 Helper；它不会改/重启已有 Agent。
3. **管理页一次确认**：选择节点，填写一次 UUID 对应的城市和周期，启用该节点/全局策略及主题结果显示。手动覆盖也在同一入口。其余节点不随之批量启用。

前台验证可到此完成。若要无人值守，**每节点还需按该系统选择 systemd 或 OpenRC，配置专用用户/路径后启用服务**；这不是浏览器能代做的一步，本版本不会偷偷启用系统服务。安装前准备 Python、私有文件权限与专用用户也属于操作系统前置条件，不虚称所有环境都只需三次点击。

## 先检查，再显式安装

需要 POSIX Python 3.10–3.x（标准库，无 pip/npm），支持的后端版本严格为实测的 1.6.0；其他版本先拒绝。始终使用 HTTPS origin；隔离本机测试才允许 `--allow-loopback-http` 和字面 loopback IP。拒绝跳转，不接受 URL 凭据/查询串/子路径，不读代理环境。

在解压目录执行 `python3 manage.py inspect`，检查版本矩阵。SHA-256 只能核对文件一致性，不能替代可信下载来源或签名。

默认 dry-run，下面省略 `--apply` 的调用只读取安装状态，显示计划，不上传、不改配置：

```sh
python3 manage.py install --panel https://TEST-PANEL --username ADMIN
```

密码由隐藏交互输入，不写 URL、argv、日志或包。也可使用包目录**之外**、当前用户所有的 0600 文件，以 `--session-file /absolute/private/session` 传入 `session_token=...`；不要把值贴入命令、浏览器控制台或环境。实际执行一次：

```sh
python3 manage.py install --panel https://TEST-PANEL --username ADMIN \
  --apply --approve-route-plugin --activate \
  --backup-dir /absolute/private/backups/unique-install
```

`--approve-route-plugin` 明确批准 Node 兼容模块和固定 HTTP routes，不批准 system RPC、exec、SSH、监听器、HTML 注入或文件系统越界。插件服务启用≠自动探测启用，首次全局/节点采集策略默认关闭。`--activate` 是显式选择 Enhanced；不传则保留当前主题。已有 Enhanced 1.1.1 按同一身份原位升级代码，原配置值保留，只补入新增声明的默认值；升级前须提供旧 ZIP（见下文）。普通 tags、Ping 和 Agent 不改。首次安装 Enhanced 使用自身默认配置，不擅自复制其他主题的完整设置或潜在秘密；从其他 short 迁移个性化配置时需在原生后台明确导入一次，其他主题配置保留。

也可在 `packages/` 手工选择两个**原生** ZIP 交给官方上传器。Helper tar.gz 不能上传到主题上传器。不要调用“从 GitHub 更新”把本地 Enhanced 换成未验证正式包。

## 集中管理与节点接入

管理员登录主题后，页头「Enhanced 管理」打开集中入口。它检测插件存在/运行/版本、存储健康、UUID Helper 登记/心跳/版本、最后结果、状态/错误、手动覆盖优先。未登记显示接入指引；心跳只表示进程最近轮询，**不表示真实线路已经验证**。

在每个明确授权的测试节点解压**同一个 Full 包**；以专用无特权用户运行，操作者先将该节点 Agent 私有配置的读取权限授予该用户（或提供该节点专用的 0600 私有配置副本），不能放宽成 world/group 可读。原 Agent 文件/进程不改。接入默认也只 dry-run：

```sh
python3 manage.py node --panel https://TEST-PANEL --uuid NODE-UUID \
  --agent-config /absolute/private/node-agent.json \
  --prefix /absolute/owned/helper-VERSION --state-dir /absolute/private/helper-state
```

确认后在同一条命令加 `--apply --enable-local --run`，立即运行前台固定 Helper。代码目录须不存在或是同版本、校验未变的安装器所有目录；不能把父级或任意现有目录当目标。要单次检查加 `--once`。本地 fixture 专用参数 `--fixture-dir` 仅接受 loopback；结果明确为模拟，不能拿来证明真实回程。

1.6.0 **没有可使用的原生短 TTL enrollment 身份**。本版本不自创“安全的一次性 token”冒充原生能力，也不申请管理员/system RPC 来铸造身份。当前方案仍需把该节点长期原生凭据保存在 Helper 的 0700 目录、0600 文件中；只在节点本机读取/保留，HTTPS JSON body 认证，不进入浏览器/argv/日志/发行包。原生 Agent 凭据并非 Helper 专用权限，若不能接受这一取舍，应停用自动 Helper、只用手工线路；不要把它宣传为已实现最小权限短期 enrollment。

节点 `--apply` 只登记、不租约/探测，除非明确加 `--run`；只有面板 UUID 策略也启用，运行中的 Helper 才能执行九目标白名单。默认无 SSH/remote exec/任意目标/任意参数。周期、城市集中存于插件策略，不重复写入主题；主题只是显示/TTL/手动覆盖。管理员保存时显示影响范围、再次检查配置冲突，失败尝试补偿并明确报告；检测到别人改动则停止而非覆盖。

## 升级、异常恢复、回滚

同一 commit 重复安装是 no-op；模块以 `+git.<commit>` 绑定构建，不把不同 build 元数据虚构成 SemVer 先后顺序。1.1.1 → 1.2.0 按稳定版本升级。升级需提供与**已安装版本**匹配的旧原生包，先验证后才进行任何写入：

```sh
python3 manage.py install --panel https://TEST-PANEL --username ADMIN \
  --previous-theme /absolute/previous/native-theme.zip \
  --previous-plugin /absolute/previous/native-plugin.zip \
  --backup-dir /absolute/private/backups/unique-upgrade \
  --apply --approve-route-plugin --activate
```

不变模块无需外部旧包；CLI 可用当前包备份同一版本。备份目录 0700，journal/旧包/checkpoint 0600；**checkpoint 含短期租约，整份目录视为敏感数据，绝不可上传分享或装进 Full 包**。安装器只保留/恢复本产品模块、插件策略、私有状态与当前主题选择，不读取数据库、不调用全库备份/恢复、不过写其他主题/设置。原生上传保留已有插件 storage；升级不会用旧快照覆盖升级期间的新结果。0.1 插件无 checkpoint API，原位升级依赖原生独立 storage 保留，故磁盘灾难恢复仍需操作者在面板主机保留旧 storage 备份；不能宣称旧版本能远程导出私有文件。

原生 API 无多请求事务/CAS。请在其他管理员不同时修改的窗口操作；写前乐观冲突检查、写后读取验证、失败补偿不是原子事务。已检测的冲突会停止，保留私有备份。网络/磁盘故障可能使自动回滚不完整，CLI 明确返回失败，不能看到 HTTP 200 就当成功。

用创建该备份的**同一个 Full 包**回滚，默认仍 dry-run：

```sh
python3 manage.py rollback --panel https://TEST-PANEL --username ADMIN \
  --backup-dir /absolute/private/backups/unique-upgrade \
  --apply --approve-route-plugin
```

## 卸载

先在各节点停止 Helper/其服务，不触碰 Agent。移除安装器拥有的代码（未知/修改文件拒绝删除，私有配置/token 默认保留）：

```sh
python3 manage.py uninstall-node --prefix /absolute/owned/helper-VERSION \
  --state-dir /absolute/private/helper-state --helpers-stopped --apply
```

然后面板端统一卸载，先停止采集、私有 checkpoint 成功并落盘后才调用原生删除；不支持安全 checkpoint 的旧插件会拒绝并补偿，不能强制丢数据：

```sh
python3 manage.py uninstall --panel https://TEST-PANEL --username ADMIN \
  --backup-dir /absolute/private/backups/unique-uninstall \
  --helpers-stopped --apply --approve-route-plugin
```

卸载删除的就是 Enhanced 主题代码与本插件/私有 storage；当前使用 Enhanced 时回到 `default`，当前为其他主题时保留其选择，不存在另一个并行的 Enhanced 身份可回退。官方主题删除保留托管配置记录，便于重装/回滚；本版本不会直接改数据库去清它。用相同 Full+backup `rollback` 可恢复旧包/策略/私有 checkpoint/原主题选择。Helper 服务文件和凭据由操作者最后明确清理；不把“保留敏感配置以便回滚”说成所有痕迹都已消失。

## 验证和版权

详见 `VALIDATION.md`：只统计真实执行的本地 tests，fixture 绝非真实公网探测。systemd/OpenRC 模板未在开发主机启动；本地测试不执行生产安装或发布/市场写入。GitHub Release 与市场合并状态必须另外读回验证。稳定的标签/三网 Ping/Relay/流量/SGD/GPU/ASN/upstream 行为保留。

项目许可证 `LICENSE`；Transit 完整 MIT `licenses/transit-MIT.txt`，版权 `(c) 2026 yyy622hhh`、`(c) 2025 Tony Liu`，并随插件/Helper 内部包保留。上游来源见 `THIRD_PARTY.md`。不包含未获许可的官方 Komari 后台代码。
