# 本地回程试用候选 · 验证范围

本轮从 `328a37100214c7d530fdc107ea9b936b396076b9` 继续，只在 `feat/enhanced-tags-return-routes` 增加本地提交。最终 commit、每个包 SHA-256、文件清单、manifest 和测试报告读回见 **`test-results/trial/delivery-verification.json`**；该文件由 `tests/companion/verify_delivery.py` 对真实产物/报告校验生成，不手工填写成功结果。

## 测试命令与已通过覆盖

- `node node_modules/@playwright/test/cli.js test -c tests/request-manager.config.ts --reporter=list,json`：120 个单元/组件断言通过。原 105 项保留，新增 snapshot schema/UUID、手动优先、来源、TTL、失败状态及旧缓存不能覆盖更新导入数据的回归。
- `node --test --test-reporter=junit tests/companion/protocol.test.cjs`：16 项。默认关闭、固定策略、UUID 绑定、单节点/全局并发、租约替换/失效、重放幂等、策略关闭、非法目标/方向/ASN/字段、失败状态、token bucket、0600 持久化及损坏状态拒绝。
- `python3 tests/companion/test_helper.py`：13 项。固定 argv、显式 fixture 标识、不按 IP 前缀猜 ASN、HTTPS/loopback/redirect 边界、私有文件 owner/mode/符号链接、实际本地子进程 fixture 超时/输出上限/权限错误、凭据参数拒绝且不回显、安装/重复安装/卸载保留未知文件、最小权限 systemd 模板。
- `node tests/companion/integration.mjs`：19 项，**真实 Komari 1.6.0 后端、本地 Agent、真实上传的主题/插件，以及从 helper archive 解压/安装后的 helper 进程**。真实 trace 只用明确的本地 fixture。
- `node node_modules/@playwright/test/cli.js test --retries=0 --reporter=list,json`：95 项既有与新增关键回归。包含 WebGL 回退、后台登录导航、标签/亮暗/手机/mini、流量视图/五种计算、Transit Relay/中转/丢包历史、资源/GPU fixture、费用/货币、图表及拓扑。没有更新旧像素快照或降低阈值掩盖失败。
- `npm run build`（包含 vue-tsc type-check）、全项目 `node node_modules/eslint/bin/eslint.js . --max-warnings 0`、staged/unstaged `git diff --check` 均通过；当前环境没有 bun，未修改依赖，用现有 npm 调用同一项目脚本。

所有列出的最终测试要求无 failed/skipped/flaky。早期失败日志保留，最终汇总只采用最终通过报告。初始缺浏览器动态库/后台 PATH 的历史问题没有通过伪造数据“修复”。新增 stale-cache 回归在修复前明确得到 `expired` 而非预期 `fresh-auto`，修复后通过。

## 19 项真实后端集成

1. 全新私有目录、loopback 绑定、原生首次安装及精确版本验证。
2. 原生分片上传插件 ZIP、识别与权限批准。
3. sandbox 私有持久化健康；匿名读/错误 token 拒绝。
4. 创建本实验 UUID；默认未启用时不派发。
5. 实际本地 Agent 上报；禁用 SSH/远控/自动更新，没有创建 Ping 任务。
6. 官方 plugin configuration API 按 UUID 配置。
7. 任意 command 字段、未知目标城市等恶意输入拒绝。
8. 独立 helper archive 验证/解压/文件安装。
9. 安装后的 helper 进程执行本地 trace fixture、原生身份鉴权、租约绑定回传。
10. 节点改名不影响缓存；不重复采集、不写 tags。
11. 跨 UUID 冒充、匿名排队、跨站管理员请求拒绝。
12. 原生主题 ZIP 上传、激活与托管设置。
13. 真实浏览器读取真实插件结果，fixture 可见标为「模拟」。
14. 真实后端保存手动覆盖；其它主题字段与节点源 tags 保持。
15. 浏览器时钟推进验证 TTL，手动项不随自动数据失效。
16. 匿名主题只显示手动设置且不发私有 snapshot 请求。
17. 后端进程重启后结果持久化。
18. 单 UUID 高频轮询 429 限流。
19. 停用后停止派发；原生插件删除后路由消失。

实验后端/Agent 的 HOME、TMPDIR、SQLite 路径及 cwd 显式绑定实验目录，不能从环境继承生产 DSN/配置。随机凭据仅在 0700 目录下的 0600 实验文件/进程内使用，不打印到报告，不进入 Git 或任一包。所有创建的后端/Agent/浏览器子进程由实验自身清理。

## 包验收

`python3 scripts/package-route-trial.py` 只打包枚举源文件，生成独立 plugin ZIP、helper tar.gz 和 BUILD.json。最终包必须绑定 clean commit，不能使用 dirty 候选元数据。

`python3 tests/companion/verify_delivery.py` 检查三个包的 SHA-256、ZIP CRC/重复或危险路径、theme manifest/预览图/当前 dist 一致性、插件最小权限、helper 文件类型、默认关闭、全部 MIT notice、commit 身份，以及实际 JSON/JUnit 通过计数。运行 DB、token、日志、浏览器、缓存、依赖和测试 fixture 都不进入可安装包。

## 不包含在“通过”中的能力

- **没有真实 traceroute / 中国三网实际探测**；不声称已验证真实线路、UDP/ICMP 可达性或外部 AS lookup 服务。
- systemd/OpenRC 只提供模板、语法/内容检查及安装器测试，**没有在开发主机启动系统服务**，OpenRC runtime 未实测。
- 自动结果 API 仅管理员可见；没有私自开放访客回传/读取或申请全权 system RPC。访客继续原有手动配置。
- CN2 GT/GIA 保守候选，不把单一 ASN 当产品认证。
- GPU 图表使用明确的测试数据；没有物理 GPU 遥测设备验证。
- 没有生产安装、生产数据库改动、SSH 或真实节点接触，也没有 GitHub push/tag/Release/市场操作。
