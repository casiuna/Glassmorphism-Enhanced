# Enhanced Full v1.2.0 · 验证范围与复现

本记录针对当前稳定身份 `Enhanced` / `1.2.0`，不是旧 Trial 的测试结论。实际机器报告、每个发行包 SHA-256、clean commit 和源码绑定校验由 `tests/full/verify_delivery.py` 生成，见本地 `test-results/release/delivery-verification.json`；GitHub 上以通过的发布 Actions、Tag 和实际下载的附件为准。本文件本身不证明远端已经发布或官方市场已经合并。

## 当前稳定源码已执行

- Bun **1.3.14**，`bun install --frozen-lockfile` 成功，锁文件和依赖未修改；本机 Node **26.12.1**、Python **3.14.9**、Linux ARM64。GitHub 发布仍使用固定 Bun 1.3.14 与 Node 24，不把本机环境差异藏起来。
- 全项目非修复 ESLint `--max-warnings 0`、`bun run type-check`、`bun run build`、`git diff --check`。
- 单元/组件 **138/138**，保留所有原有用例，新增集中管理、设置保存 ACK、UUID/旧配置/手动优先/TTL 等断言。
- Plugin 协议与集中管理状态 **22/22**；Helper 安全 **13/13**；独立真实 loopback HTTP 传输边界 **8/8**。覆盖默认关闭、原生 UUID 身份、管理员专用读取、租约/重放/限流、私有文件、跳转/代理/凭据拒绝和固定 argv。
- Full 安装器 **32/32**，使用真实构建的归档和明确的 FakeAPI 单元 fixture；不把 FakeAPI 当作原生后端兼容证据。覆盖 ZIP/tar 安全、SHA/版本/Notice、dry-run、权限、幂等、升级/降级拒绝、备份/失败恢复、卸载/回滚及冲突保留。
- 独立伴生链路 **19/19**，真实官方 Komari **1.6.0**、本地 Agent、实际原生上传的 Theme/Plugin 和归档安装后的 Helper 子进程，所有路由采集仅使用本地 fixture。
- Full 原生链路 **28/28**，真实官方 Komari **1.6.0**、统一 CLI、浏览器管理入口、本地 Agent 和已安装 Helper。旧主题为实际下载的官方 **v1.1.1** 附件，校验值为 `ef9aec3d569fe4f9ab7f75393e8079649c17ab31fa53e68669f67fb5153fba68`；旧 0.1 插件用固定历史 commit `37092754388f04d44a3131a4f51130b8b6a1abae` 的真实源码构建，明确标为测试包而非历史正式二进制。
- 浏览器全量回归 **107/107**，报告 `test-results/stable-browser.json`，包含集中管理 **12/12** 及原有 Ping、Transit、流量、财务/SGD、GPU fixture、拓扑、WebGL 回退、顶部标签、亮暗/手机/mini 和导航。全部零 failed/skipped/flaky；不更新旧快照或降低阈值掩盖失败。

## 稳定身份升级专项

原生 Komari 会为新版本加入六个新的默认配置项。安装器允许**且只允许**这些声明的默认值补入，所有原配置值必须保持原样；管理员并发改动不能冒充默认迁移。失败/回滚会通过原生设置 API 恢复备份的完整旧 map，再读回核对，绝不改数据库。

28 项原生测试包括：从官方 1.1.1 同 short 原位升级；既有财务/Transit/未知字段保留；默认不探测；Helper 注册与在线状态区分；本地私有凭据和 UUID 校验；集中管理补偿写回；桌面/手机亮暗；匿名/跨站拒绝；改名不丢状态；checkpoint 先落盘再删除；卸载后精确恢复设置/租约/结果；旧 0.1 storage 原位保留；实际插件 reload 失败后恢复旧版本；后端重启持久化；Helper 卸载不碰 Agent。每个测试创建并清理自己的子进程，隔离 HOME/TMPDIR/SQLite/loopback，不接触生产。

## 复现

准备 Python 3.10+、固定 Bun、Node、Playwright Chromium 与相应系统库；真实集成还需将已验证的官方 Komari 1.6.0 和 Agent 放在 `../tools/backends/`。该目录仅为本地测试前置条件，不随 Full 发行、不下载或接触生产节点。

```sh
bun install --frozen-lockfile
bun x --no-install eslint . --max-warnings 0
bun run type-check
PLAYWRIGHT_JSON_OUTPUT_FILE=test-results/stable-unit.json bun x --no-install playwright test -c tests/request-manager.config.ts --reporter=list,json
node --test --test-reporter=junit --test-reporter-destination=test-results/stable-protocol.xml tests/companion/protocol.test.cjs tests/full/protocol-management.test.cjs
python3 tests/companion/test_helper.py
mkdir -p test-results/full
python3 tests/full/test_transport.py
bun run build
python3 scripts/package-full.py
python3 tests/full/test_distribution.py
node tests/companion/integration.mjs
PLAYWRIGHT_JSON_OUTPUT_FILE=test-results/stable-browser.json bun run test:visual --retries=0 --reporter=list,json
# visual-test 模式之后必须重建生产包。
bun run build
python3 scripts/package-full.py
# 指向已核对上述官方 SHA 的 v1.1.1 附件；省略时只使用显式离线 fixture，不能宣称实际官方旧包验收。
ENHANCED_PREVIOUS_THEME_ZIP=/absolute/official-v1.1.1.zip node tests/full/integration.mjs
python3 tests/full/verify_delivery.py
```

正式交付要求 clean commit 后构建；开发期只能显式 `package-full.py --development`，dirty 包默认被安装器拒绝，绝非交付候选。最终 Full 集成报告必须与交付 commit、归档 SHA 完全一致；改变归档后重跑该集成，不能复用旧包的报告。

## 未验证 / 不承诺

- Komari **1.6.1 未实测**；Full 安装器只接受已实测的 1.6.0。
- **没有真实公网三网 traceroute/ASN**、生产 VPS、生产 Agent 或数据库操作；fixture 成功不证明真实回程可达性或 GIA 商业产品认证。
- systemd/OpenRC 只检查模板和本地安装行为，未在本机启动系统服务；OpenRC runtime 未实测。
- GPU 使用明确的 fixture，没有物理 GPU 遥测验证。
- 自动详细结果仅管理员可见；默认关闭。1.6.0 没有适用的原生短期 enrollment，Helper 必须在被测节点私有保存该节点原生长期凭据；这不是最小权限专用短期身份。
- 原生 API 无多请求事务/CAS；使用安静维护窗口、乐观冲突检查和有读回的补偿，不能保证任意网络/磁盘故障下自动回滚都成功。失败会明确保留私有备份并报告。
