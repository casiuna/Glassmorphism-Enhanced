# AI Cache / Agent Handoff Log

## 当前执行：v1.2.1 后台归类与伴生依赖简化（M4/M6，保持鉴权，禁止提交发布）

- 仅后台设置与手动编辑体验；基线 1064 个文件和源码备份在 settings-companion-review/before*。前台卡片、Ping/Transit/流量算法、Full 安装器及降级保护不改。
- manifest五分类顺序修正为01/02/03/04/05；returnRoute全部放03，外观字段04。主题集中入口分组从同一manifest派生，不另建分类源。手动JSON保留同一key和默认结构。
- 新增主题独立手动节点选择+3输入框，服务层复用鉴权/并发保护/读回合并；不依赖Plugin，不改变自动开关；原JSON与可选伴生状态默认折叠。旧自动策略测试明确展开高级区，不删除安全断言。
- 原生Agent审计已固定Komari1.6.0/Agent1.5.11源码SHA：Native exec是通用Shell且服从DisableWebSsh；没有直接安全替换现有受限Helper的适配。本轮不接入新远程执行/调度/采集协议，不开远控、不安装服务，结论见docs/settings-companion-audit.md。
- 需复跑全单元/组件、后台浏览器和等分冻结回归、真实Komari整套（新增卸除Plugin后手动保存/刷新/截图、监控独立与禁远控不改），TS/ESLint/build/package/diff。完整截图/证据独立保存，不覆盖此前发布阻塞闭环。

## 当前执行：v1.2.1 最后 Full 发布阻塞闭环（M6，冻结全部 UI，禁止提交发布）

- 最新授权仅修复 Full 故障注入与必要安装器/测试；原 HEAD/分支不变。基线 103 个 dirty 文件、1063 个源码哈希和完整源码备份在 test-results/v121/full-blocker-closure/before*，不覆盖 release-final/r6 等失败证据。
- 版本保护保持原样：SemVer build metadata 等优先级允许 replace-build，低版本仍拒绝。夹具版本从真实 0.3.0 基础动态派生 +git.reload-fault-fixture，同步内层 manifest/BUILD 与 Full 模块矩阵/hash。
- 实际 sandbox 加载先写仅实验私有目录的0600故障标记，再 throw；原生套件必须先确认触发，再断言版本、启用状态、配置、私有 checkpoint 和代码文件恢复。补充实际管理员并发修改拒绝与归档一致性/降级保护单测。
- 验收已完成：两个独立私有实验目录中完整 Full 原生套件各37/37、0失败/跳过/重试；最终包的SHA与原生报告精确绑定。真实加载写0600标记后throw，再验证回滚；7个代码/BUILD/manifest文件及mode、配置/启用状态/checkpoint/Agent字节全部符合断言；原生并发修改拒绝亦通过。
- 本轮复跑fixture4/4、安装器37/37、Helper/归档45/45、Transport8/8及单元组件exit0；TS/ESLint/生产构建/diff-check全部exit0，最终归档45/45。完整Git清单104项（55 tracked modified+49 untracked），全量含未跟踪diff已留档；927个受保护文件、所有UI/安装器/版本保护hash不变。本轮仅本日志、发布说明证据引用、两份Full测试及新增fixture测试5文件。
- 最终候选在 full-blocker-closure/candidate-final/；所有SHA重新计算，严禁直接当正式附件。功能验收PASS、具备提交源码条件YES；正式clean-source门禁真实exit1仅因源码未提交，保持PENDING_COMMIT。本轮没有commit/push/tag/Release/生产操作，自动公网探测仍未生产验收。完成后停止等待授权。

## 当前执行：v1.2.1 Release 前最终验收（M6，视觉已通过，冻结布局，不提交发布）

- 最新用户已确认三等分视觉，不再改布局；本轮做完整单元/组件/浏览器、静态/构建、归档及真实隔离Komari1.6.0验收。原工作树/分支/HEAD保持，起点97条dirty、1062源码指纹与五个视觉关键文件hash、源码tar和旧全局报告保存在 release-final/before*，不覆盖历史。
- 核查发现README仍有过时省略/短名描述、CHANGELOG缺1.2.1、发布指南目标仍1.2.0、manifest两处help仍说无效占位。仅修正文档/提示，不改配置keys/defaults和已验收运行时布局。新增1.2.1未发布说明并加入Full文档映射，不宣称自动探测生产可用。
- 原生集成脚本仍要求fixture/过期/协议冲突占据前台摘要，和已批准的有效值规则冲突；更新这些过时断言为摘要隐藏+管理员诊断可见，并强化匿名仅见手动、零私有请求。新增可指定验收输出与固定生产ZIP输入，避免覆盖旧报告或误用visual-test包。所有原生场景保留，后端安全断言不放宽。
- 已通过GitHub公开只读下载并验证官方v1.2.0原生包，SHA bc2aeb1810b19800e4dcd9f40ae480021efe3ade16d5b9f752c5568a20e9602e，用于1.6.0同short真实升级验证。只复用既有六条CDN历史数据，不新SSH/DNS/探测/ASN，不操作生产。
- 正式clean-source门禁保持不变。当前禁止commit，故即使本地验收全过也只能生成dirty隔离验收包；不能将旧f9cec36文件名与dirty=true伪装成正式Release。最终明确区分功能验收完成与正式发行待授权commit/clean重建。

## 当前执行：严格三等分线路 UI（M4/M6，上一版视觉未通过，禁止提交发布）

- 沿用当前 Session / 原工作树 / feat/enhanced-tags-return-routes / f9cec36；1061源码指纹、96条dirty及原预览完整备份至 final-route-grid/baseline* 和 previous-preview-preserved.html，保留旧截图/报告/失败记录。
- 仅改 ReturnRouteSummary.vue 布局及必要测试：固定三等宽grid列，红/蓝/绿按carrier各占1/3，每列将圆点和名称作为一组居中；缺项保留对应列位置但不造占位。无背景边框装饰，不改数据/识别/API/Ping/Transit/流量/权限。
- 预览仅保留两项场景：9929 / CN2 / CMI，以及10099→9929 / CN2GIA / CMIN2。旧极端/缺项/异常测试不删，旧换行断言调整为固定列内换行，不能要求grid项目跨行。
- 验收已实际完成：定向组件29/29、浏览器63/63（含新等分/缺项布局18项），0失败/0跳过/0flaky/0重试；ESLint/type-check/production build/visual build/diff-check全部exit0。原异常、长输入、权限测试保留并通过，仅旧跨项换行断言改为列内文本换行。
- 截图32/32：两个指定场景 × 1440/320 × 四尺寸 × 亮暗；典型名称均单行、摘要16px，逐字裁切0、越界0、重叠0、不覆盖Ping；三fr列最大栅格取整差0.015625px，组中心偏差最大0.0078125px，圆点与名称3px。
- final-route-grid/final-ui-preview.html仅两个场景、32种尺寸/主题组合切换全部通过、预览外部请求0，320页无溢出。已同步更新此前final-route-ui/final-ui-preview.html（旧内容有完整备份），侧栏打开最新三等分预览。
- 本轮仅一个运行时文件ReturnRouteSummary.vue变动，另为本日志、必要旧布局断言/共享审计、新等分测试；1057个其他既有源码文件指纹不变，HEAD/分支/index不变，无删除、无新增依赖或新功能。本轮无探测、commit/push/tag/Release/生产部署，停止等待用户视觉确认。

## 当前执行：最终点色线路 UI（M4/M6，用户已选A，不提交发布）

- 最新用户明确以A为基础，不再A/B。线路摘要只显示红/蓝/绿小圆点+完整原始名称，固定联通/电信/移动顺序；可见文字无“回程”和运营商名，不再调用compact缩写。
- 禁止ellipsis/line-clamp/裁切；先缩间距，窄容器字体最低10px，再按项和项内换行，允许必要高度。不改Ping、价格、流量、计费或后台证据。
- 基线原HEAD/分支不变，1059源码指纹和94条dirty记录已存final-route-ui/baseline*，不覆盖之前成果和历史探测。只做本地UI/截图/定向测试，不SSH、不DNS、不新探测、不启用ASN。
- 移除NodeCard中B预览选择与辅助挂载，旧B草稿文件及历史证据保留但不再生效；最终预览不做A/B。未知/过期/失败/fixture/协议分歧继续隐藏，补充英文状态占位过滤。
- 截图已完成：102/102场景通过，100个管理员手动有标签场景 + 2个原CDN未知隐藏场景；1440/390/320、四尺寸、亮暗，短/完整/两项/长换行/连续长token。每个非空白字符Range边界检查裁切0，全部摘要后代无ellipsis；短名区域16px，长名按宽度自动两/三行（34/52px），字体实测11px。正向名称均手动布局样例，非CDN识别，真实六条仍未知并隐藏。
- 验收完成：browser 67/67、unit303/303，均0失败/0跳过/0flaky/exit0，retries0；截图102/102与自包含预览切换102/102通过、0外部请求。typecheck/production build/visual build exit0。首轮lint6处测试格式问题独立log保留，修复后lint-r1/r2均exit0，最终文档收尾已复核通过。
- 最终版预览 final-route-ui/final-ui-preview.html 已在侧栏打开，旧AB预览tab已关闭而历史文件保留。新预览只提供场景/宽度/尺寸/亮暗选择，不做AB。桌面主图1440-compact-dark-full-names.png，窄屏主图320-mini-dark-long-wrap.png，全部实际节点卡片和线路裁剪图保留。
- 后台/Helper/Plugin/探测/ASN/流量价格计费逻辑未改，不提交、不发布；当前停止在最终UI效果待用户确认。

## 当前执行：湖北 CDN 接入与 A/B 验收（M5/M3/M4/M6，不发布）

- 沿用原分支/HEAD/工作树；基线1054个源码文件、89个dirty项保存在 test-results/v121/cdn-adaptation/baseline*，不覆盖任何历史证据。
- 严格不再 SSH、解析公网 DNS、探测或查询 ASN；只重放 hubei-cdn-v1 六份实际 :80 原文。双授权仍关闭。
- 计划采用向后兼容 schema3：经审查的湖北三域名目录 + Plugin 管理员策略和 Helper 私有本地白名单双重授权；端口受限且绑定，job只给ID/绑定而非任意命令/地址。DNS仅公共IPv4且固定一组，两协议不重解析。保留旧schema1/2、认证/lease/TTL/限流与超时。
- 历史采集时间不能改成现在。真实旧数据输出标记 replay，通过现有管理员、停采条件下的历史 restore-node 接收；正常Agent submit的五分钟新鲜度与lease不放宽，单独测试拒绝旧数据。最终报告明确这是历史实测回放E2E而非新VPS实时探测。
- UI两个方案均仅visual-test可选、未定稿；实际CDN未知结果应完全隐藏。为比较位置，可另列明确标注“管理员手动布局示例”的中性文字，不使用9929/CN2/CMI等模拟识别。实际截图矩阵与辅助样例分开。
- 实现已完成：schema3 + 编译审核目录(三湖北域名/80或443) + Plugin管理员与Helper本地双白名单；job绑定不可传任意地址/端口/Shell。源端DNS一次固定公共IPv4，重放严格owner-only且无符号链接；旧schema1/2、UUID/lease/TTL/限流保持。未修改生产，未SSH/探测/ASN查询。
- 实际 CDN 历史回放 E2E：native-cdn-r5 / Komari1.6.0 / 11/11 PASS，Helper CLI读取hubei-cdn-v1原文、Plugin停采管理员restore接收、Theme管理员显示6条:80/DNS/hash/原时间；原始UUID/实验ID进captureOrigin，本地测试UUID映射显式记录。保留源时间，正常Agent仍拒绝历史replay；匿名、跨站、手动覆盖、TTL浏览器时钟、真实后端重启缓存全部通过。此结果不借用静态DNS12/12，也不冒充新实时探测。
- UI：真实组件浏览器截图88/88 PASS（实际未知/明确中性手动示例分开），宽1440/390/320，四卡片尺寸与亮暗；A/B真实CDN均无占位，B不增加底行。A/B除线路区域外文本/Ping完全一致，B在手动布局场景比A低24/28/32px（按尺寸）。自包含预览 test-results/v121/cdn-adaptation/ui-ab-preview.html，保留历史胶囊截图但明确旧手动fixture非CDN；两套仅visual-test切换，尚未选择。
- 相关浏览器：targeted-browser 63/63 PASS，0跳过/0重试/exit0，非全量175重跑；B访客额外2/2 PASS、预览控件6/6 PASS且自包含0外部请求。单元/组件293/293、Helper安全45/45、CJS协议87/87；生产build与visual build通过。最终lint/typecheck均exit0（r3），production/visual build均exit0；diff-check与原始6份hash复验通过。预览已在桌面侧栏打开，停止开发等待选择。
- 失败留存：初次lint格式与来源枚举漏项、archive测试错误依赖不存在的kind字段、Helper停用配置离线模式拦截、unit新用例调用签名错误；Native初次响应解包与400/409测试预期错误。均有独立失败log/JSON，修正依据现有TypeError→400契约而非放宽状态断言，原始证据未覆盖。首次unit292PASS/1FAIL，复验293PASS。
- 未解决/非本轮范围：实际ASN仍0，六条未知；未来须单独本地双授权，最多8次/每次2秒既有公网IP补全，不需再探测VPS。实时CDN新分支仅无网络安全测试，本轮按要求不做新的实时网络试验。禁止commit/push/tag/Release/市场；完成预览后停下等待用户A/B选择。

## 最新目标修正：湖北 TcpQuality CDN :80（M6，采集与离线验证完成，不发布）

- 用户最新明确提供 `hb-ct-v4.ip.zstaticcdn.com:80` / `hb-cu-v4.ip.zstaticcdn.com:80` / `hb-cm-v4.ip.zstaticcdn.com:80`。本次只在原授权 nerwen 上解析这三个名称并记录当时 IPv4，再锁定同一 IPv4 各测 UDP/TCP :80 一次，20跳/25秒/共6条，禁止 DNS 漂移污染两协议比较。
- 此前北京批次，以及湖北 DNS 服务器地址的批次均保留，但不作为本次 CDN :80 结果。湖北 DNS 批次有真实原始记录、离线解析和 loopback Komari 12/12 验证，不能把它的回传结果移植为 CDN 验证结论。
- CDN 探测仅使用私有 scratch 单次脚本和内存中当前 collector；不改生产 Helper 的 TCP443 默认、不扩宽生产固定地址协议、不安装任何组件。动态 CDN 结果使用独立试验目标 ID，不冒充原静态目标；若协议不接受，明确记录尚未回传而非绕过白名单。
- Team Cymru 双授权仍未取得，查询数必须为0，不使用 -A，不通过IP前缀伪造ASN。原始路径仅私有目录 `test-results/v121/nerwen-real-trial/hubei-cdn-v1/`，不进入 public/匿名接口；不改 VPS 的 Agent、服务、权限、系统配置，不 commit/push/tag/Release/市场。
- 四路径实检已确认 /usr/bin/traceroute 可用；旧“可能缺 /usr/sbin 支持”只是待查疑问，现已排除，不需要修改系统路径。
- 结果：2026-11-13 03:07:42–03:08:52 UTC，源 VPS 解析并固定电信111.172.211.216、联通220.202.13.144、移动111.48.110.49，UDP/TCP均目的80，共6条/exit0。电信TTL16/18到达，联通TTL20/15到达，移动两协议20跳内未到达。六份SHA与当前parser重新解析全部匹配，0条output-limit，实际ASN为0，当前TS分类器六条未知，Cymru查询0。
- 新 CDN 批次没有进入 Komari：独立试验 `hubei-cdn-trial` 在当前 protocol.cjs 原始时刻离线校验得到预期 `result binding mismatch`（未注册城市/目标），不能把动态IP重标为静态 hubei-*，也不能用之前静态目标12/12冒充本次CDN E2E。真实采集、离线解析、当前协议不兼容分别记录于新批次 REPORT.md / verification.json / classification-and-compatibility.json。
- A/B 预览仍未交付；最新增加的 Ping 辅助组件与 visual-test-only 开关属于尚未验收的草稿，用户修正目标后暂停 UI 工作，不把旧175项报告当成对这些新改动的验证。

## 当前任务：nerwen 单节点真实探测 / A-B 视觉重新评估（M3 / M4 / M6，进行中，禁止提交发布）

- 最新授权明确允许 `ssh nerwen` 现有 root/密码权限，仅一台新购 HK VPS 做北京三网 UDP/TCP443 各一次；每条20跳/25秒，绝不改 Agent/DB/路由/防火墙/sysctl/SSH/服务，不装依赖/能力/守护程序，不接 dirty Full 到公网。Team Cymru 仍未获得本地双授权，明确禁用，不使用 -A。不得把密码或凭据写入缓存/证据/命令参数。
- 原 worktree / branch / HEAD 继续不变；起点87条dirty、1052文件已备份到 scratch `enhanced-v121-nerwen-trial/baseline-source.tar.gz`，新私有证据 `test-results/v121/nerwen-real-trial/`，不覆盖前轮175/287报告。
- 已只读核查SSH主机列表，仅选择用户指定nerwen，严格校验已存主机密钥，无SSH配置变更。首个key登录exit255后以交互TTY密码登录成功，密码未持久化。主机host6998906253，Linux6.1.0-10-amd64，Python3.11.2，traceroute2.1.2，IPv4路由可用。
- 真实探测任务 `proc_7802a530ec35`：当前v2 collector源代码通过SSH stdin仅在远端内存执行，6条固定轨迹，输出真实argv/开始结束时间/退出码/原始文本/hash，Cymru及prefixHints关闭，无面板连接/Helper安装/远端文件写入。raw证据保持私有，不进入public目录或匿名接口；测量UUID仅本地回放身份，不冒充生产UUID。
- 先取得实际原始记录，再用当前解析与分类函数本地验证，优先启动本地isolated Komari进行真实采集回放/鉴权/后台显示/手动覆盖/TTL验证。严格区分远端采集、离线解析、loopback真实回传和生产部署。当前Helper可能不识别/usr/sbin/traceroute，须以环境四路径检查结果核实，只允许本地最小兼容修复，不改VPS路径。
- UI只提供A纯文字单行 / B集成Ping辅助信息两套真实组件预览，不擅自定稿；实际无可靠线路则两套都不得显示假标签。任何正向布局样例须显式标为非实测，不能作为线路证据。维持匿名权限和价格/流量/计费/Ping数据口径；不立即重跑完整175项。

## 当前任务：v1.2.1 单行回程 UI / 单节点真实探测试用准备（M3 / M4 / M6，本地验收完成，禁止提交发布与生产）

- 最新授权：继续当前 worktree / branch，只做本地 UI、测试和试用文档；不 commit/push/tag/Release，不连接生产 VPS，不安装 Helper，不开持续探测，不改 VPS 权限。前轮 READY 只适用于旧 UI，本轮变更必须重新验证。
- 起点 HEAD `f9cec36ca3d3373ba2e9edf2e0844d30dc66933d`，81 条 dirty、1048 文件指纹已备份在 scratch `enhanced-v121-inline-trial/baseline-source.tar.gz` 和新证据 `test-results/v121/inline-route-trial/before.json`；不覆盖既有改动/历史失败。
- 只读核对 Theme1.2.1 / Plugin0.3.0 / Helper0.3.0，外层 schema1 + 结果 schema1/2；dirty Full 只允许明确 loopback 开发模式，真实 VPS 试用须另行授权并使用来源可核验的干净同构建组件，不绕过门禁。
- M4：三网彩色胶囊改单行中性文字+微型红蓝绿标识，无有效结果完全隐藏；未知/过期/失败/fixture/协议分歧不充当有效当前线路。M3：原始逐跳和自动线路仅管理员，不设计匿名自动结果发布；手动 UUID 标注保留。
- M6：先实拍改动前 24 个桌面/移动/320px、四尺寸、亮暗组合，再拍新版；定向 UI+隐私测试后 lint/typecheck/build/相关单元，再一次完整回归，核对原 142 名称全部保留，截图基准/重试策略不变。新数据仅为标明 UI 样本，绝不是公网测量。
- 单节点说明将区分只读准备、另行授权后的临时单次 UDP/TCP（--once）、本地 Cymru 双授权、证据判读和停用/匹配版本回滚；不启用守护进程、不自动提权，不把 ASN 缺失/隐藏/失败说成已识别。
- 已完成：前后 24 场景真实截图和自包含 `ui-preview.html`，逻辑行高 24→16；预览 24 组图片/控件真实浏览器验证通过，零外部请求。试用手册 `docs/single-node-route-trial.md` 已交付源码并入未来 Full 文档映射；14 个配置/dirty gate 本地检查通过，无任何公网/WHOIS/VPS 操作。
- 首轮定向 53 PASS / 2 FAIL：Enhanced 主题身份/RPC mock 与宽泛告警选择器问题；补齐后对关联 9 项复验通过，去重 55 项覆盖。新单行 24 场景原本全通过。初次 lint13 格式错误和预览 checker 把 CSS16 当 PNG16（实际栅格17）已分别修正；原始结果保留 `first-failures/`，从不把初次 exit1 当成功。
- 第一次完整回归为 **158 PASS / 17 FAIL / exit1**，完整 `full-browser.json/log/artifacts` 保留：16 项流量/UI 组合仍要求彩色文字/24px 胶囊，另1管理页告警 strict locator。只更新两份测试的过期视觉契约为微型标识/中性无背景/严格16px，精确定位拒绝保存错误并增加配置错误可见断言。所有流量数值/原始计数器/保存读回/日期断言均保留；`scope_audit.py` 已逐删行验证，`task-only.patch` 相对本轮81条 dirty 起点生成。
- 17 项跨功能复验全过；post-repair lint/diff exit0。app/Helper/Plugin/单元测试源码相对第一次完整运行未变，复用 typecheck/production build/287 unit/61 CJS 结果。`proc_17b93edf9e91` 完整复验已实际 exit0：**175 PASS / 0 FAIL / 0 SKIP / 0 FLAKY**，原 142 名称全部保留并通过，新 33 全过，retries0。最终报告 `full-browser-final.json`，scratch `final_gate.py` 已执行通过，源指纹/7张基准/HEAD/index/范围门禁通过。
- 本轮最终相对原 dirty 起点仅 19 个文件变化（15 修改/4 新增），工作树共87条未提交，未删旧文件；完整 `final-report.md`、`final-verification.json`、`task-only.patch`、`source-scope-audit.json` 在独立证据目录。试用准备完成但真实网络仍未执行；dirty Full 不能上公网，须另行授权并取得来源固定的干净匹配产物。
- 最终聚合 checker 初次只接受 TAP # 前缀，而实际 Node 报告用 ℹ，导致 KeyError；仅修复 scratch 解析器，保留 `first-failures/final-aggregator-error.txt`，未改协议结果或重跑测试。所有早期失败均留档，不以当轮成功覆盖历史 exit1。当前未 commit/push/tag/Release/生产操作。

## 当前任务：v1.2.1 最终回归与发布前验收（M6，本轮仍禁止提交发布）

- 继续原 Session / 原工作树。最新授权仅源码/测试修改、本地隔离验证与本地候选产物；禁止 commit/push/tag/Release、生产 Komari/Agent/数据库或真实 VPS Helper 安装。不删除历史失败证据。
- 开始只读核查：branch `feat/enhanced-tags-return-routes`，HEAD `f9cec36ca3d3373ba2e9edf2e0844d30dc66933d`，78 个未提交文件（逐文件展开）；无正在运行的同类测试。当前 1046 个源码指纹与上轮最终 142/142 完整结果一致。原 119/exit1 的 15 个失败名称/断言/根因已提取，逐一确认已被后续完整结果覆盖；不重做已修复的归档白名单问题。
- 本轮证据新建在 `test-results/v121/release-preflight/`，不覆盖旧报告。`before.json` 保存初始工作区/源码指纹，`historical-failures.md/json` 明确列出 15 项历史失败及根因；原图、trace 不删除。驱动仅在 scratch `enhanced-v121-release-preflight/qa.py`。
- 顺序：只跑原 15 失败 UI/五种流量用例 → 非自动修复 lint/type-check/production build/diff/unit/Helper 协议与负向归档 → 一次完整 Playwright → 生产构建/本地 DEVELOPMENT_ONLY 候选包完整性、哈希、安装回滚预检。22/22 Komari 1.6.0 原生集成按未变的源码/脚本指纹复用，不重复启动。
- 本轮已补 `tests/companion/test_archive_safety.py`，直接约束两层 Helper 归档校验：明确必需枚举、缺少 `enhanced_probe_v2.py` / 任一必需文件、未知文件、重复/非普通/穿越/超大项均拒绝，拒绝前不执行安装器、不写解包目录。另仅给 Full README/VALIDATION 加 v1.2.1 本地候选/历史记录区分说明，保留旧稳定版内容。产品源码/协议/白名单校验器未改动，22 原生集成仍可复用。
- 第一步已完成：精确匹配原 15 个失败名称，仅执行该 15 项，15 PASS / 0 FAIL / 0 SKIP，exit0。定向报告 `release-preflight/targeted.json`；所有原断言保留，未改截图或重试策略。进入第二步静态及相关单元/协议/归档负向验证。
- 包内容只读核查额外发现：旧本地 Full 归档含 TCP/UDP 文档，但没有 `docs/traffic-cycles.md`。本轮仅在 Full 打包文件映射中补入该文档的明确路径，不改 Helper/Plugin 白名单；候选包阶段将重新实际构建并核对该文件。README 的本地候选说明使用包内路径，避免同源 README 同时复制到根目录与 docs/ 时产生相对链接歧义。此打包文档修补不涉及 22 项 Companion 原生集成的运行时代码。
- 本轮最终结果（`release-preflight/final-verification.json` / `final-report.md`）：原 15 个失败定向 15/15；单元/组件 268；CJS 协议 61；Helper 含归档直接负向 40；管理/回滚协议 6；完整浏览器 **142 PASS / 0 FAIL / 0 SKIP / 0 FLAKY，exit0**，仅运行一次，retries0。流量周期专项 UI 27 / unit 73，五模式累计与周期各 5 项均过；前台无倒计时。
- 第四步完成：浏览器之后重新生产构建，实际重打本地 dirty 候选（Theme1.2.1，Plugin/Helper0.3.0+git.f9cec36，Full1.2.1）；33 安装/升级/回滚、40 Helper、43 逐项包检查全过。Full 内嵌原生三个组件与单独归档字节一致，新增 v2 文件及流量/探测文档齐全，版本/权限/默认关闭/MIT 署名/生产 dist/原 v1.2.0 Tag 皆核验。普通安装器仍拒绝 dirty 开发包。
- 包 checker 初次 exit1 是 scratch 假设所有 manifest 行都有 key，实际 5 个 `type=title` 无 key；修正 checker 的结构读取后 43/43 过，不改产品配置或字段断言。首次 traceback 保存在 `release-preflight/precheck-failures/first-verifier-error.txt`，没有删除失败。
- 最终工作区 81 条未提交记录；本轮 5 个变更：本文件、两份 Full 文档、Full 打包映射单行补文档、新归档安全测试。其他运行时与所有旧测试/基准均保持本轮初始指纹，无删除，HEAD/分支/index 未变。真实公网 TCP/UDP、Cymru、IPv6、Komari1.6.1/系统服务常驻仍未测；不得据 fixtures 宣称商业线路认证或生产上线完成。
- 最终已验证 `READY_FOR_RELEASE=YES`，只表示用户要求的本地预检完成，等待授权进入提交/干净源码重建/正式发布阶段；本轮不满足也不弱化正式发行 verifier 的 clean-source 门槛，不把旧 HEAD 的 dirty 包冒充 Release。未执行 commit/push/tag/Release/生产修改。
- 第二步完成：非修复 ESLint、type-check、production build、diff-check、单元组件及协议/Helper/Full 测试均 exit0；Helper 合计 40 PASS（含新增归档负向），Full 33 PASS。本轮只改文档与一条打包文档映射，不改运行时与既有测试。第三步已经只启动一次 full-browser；其开始前逐文件核对所有运行时/既有测试指纹不变，新增归档测试与实跑指纹相同。证据 `pre-full-source-binding.json` / `before-full-hashes.json`，无 skip/fixme/only、无截图更新或重试增加。

## 当前任务：TcpQuality 方法参考 / 独立 TCP-UDP 证据增强（M5 / M6，隔离验收完成，禁止提交发布）

- 最新授权只在现有工作树改代码、fixture 和隔离验收；禁止 commit/push/tag/Release、生产部署、Agent/生产库改动。本轮以已验证 211 单元 / 134 浏览器全绿为基线，不再把旧 119/exit1 当作验收结果。
- HEAD/branch 未变，工作树无其他写入 Agent。全部 1032 个现有源码文件已备份到 scratch `enhanced-tcpquality/baseline-source.tar.gz`，另存 hashes/binary diff，禁止覆盖既有 v1.2.1 工作。
- 参考仓库固定 commit `d0877381351257111c3c65e6fd8278e7f9f6c270`，README 第 65 行明确 GPL-3.0-only；参考源只留在项目外 scratch/reference，不执行、不复制、不打包 GPL 程序。新适配代码独立采用本项目 MIT；保留原 Transit MIT 署名。不宣称法律层面的 clean-room 认证。
- 设计：保留 schema1 / legacy UDP；显式本地 probeProtocols 选择启用 schema2 的 tcp/udp/both，固定 IPv4 三城九目标、固定 TCP 443、无远端任意命令/地址。单协议路径分开存储，分歧不合并认证。Cymru 默认关闭且需本地 consent，短时限/预算/私有缓存/失败回退；前缀仅低置信度提示，绝不注入真实 ASN。IPv6 暂不启用。
- 验收计划：跨 Helper/Plugin/前端协议 fixtures 与攻击输入、顺序/回返/隐藏跳分类、Cymru 拒绝/缓存/超时，真实 loopback Komari 1.6.0 承载 fixture 结果，随后全项目 lint/type-check/build 和流量/标签/回程 UI 回归。真实公网探测不执行。
- 实现已接入：`enhanced_probe_v2.py`、原 Helper/Plugin 协议、安装包枚举、独立 per-protocol 前端记录与 `ProtocolRouteEvidence.vue`；本地选择 udp/tcp/both，v1 缓存兼容。组件版本为未发布的 0.3.0。移除 `traceroute -A` 隐式外查；Cymru 必须双本地 opt-in；systemd 仅新增 0700 StateDirectory，仍无 capability，不自动授予 TCP raw 权限。
- 当前实跑：Playwright 单元/组件 268 PASS；CJS 协议 61 PASS；旧 Helper 14 / 新 Helper 19 PASS；Full 安装/升级/回滚 33 PASS；lint/type-check/production build 均 exit0。开发 Full 包明确 dirty / DEVELOPMENT_ONLY / published:false，没有 Release。
- 定向验收与集成已完成：69 项定向浏览器首轮为 68 PASS / 1 fixture FAIL（管理 fixture 漏 native theme-list，非产品错误）；补齐明确 mock 后，新 8 项逐项复验 8 PASS / 0 FAIL。原生集成先在严格 archive 枚举漏新增模块处停止，补其为必需项后，真实隔离 Komari 1.6.0 为 22 PASS / 0 FAIL，包含 schema1→schema2、原生 UUID/lease、后台/前台、TTL、隐私及重启持久化。原失败痕迹保留。
- 唯一一次最终全量浏览器已完成：142 PASS / 0 FAIL / 0 SKIP / 0 FLAKY，真实命令 exit0；机器验证原有 134 个用例名称全部保留，新 8 项均通过。48 个受保护源码/测试/元数据（含流量、标签、Ping/中转、7 张截图基准、Playwright 策略与依赖锁）与任务开始快照完全一致，无 test.skip/fixme/only，无删除旧文件。相对任务开始快照共 42 个文件：27 修改、15 新增；未覆盖先前 v1.2.1 成果。
- 最终机器门禁和完整报告：`test-results/v121/tcpquality/final-verification.json` / `final-report.md`；独立 diff 为同目录 `specialist.patch`，原 134 项证据未改写。QA/最终门禁脚本仅在 scratch `enhanced-tcpquality/`。当前状态 ready-for-review-not-submitted-or-released，HEAD/branch/暂存区未变，绝无 commit/push/tag/Release 或生产部署。真实公网 TCP/UDP、真实 Cymru、IPv6、Komari 1.6.1 和系统服务启动均未实测；TCP 主机权限可能不足，不自动升权，不把离线 fixture 说成线路认证。

## 当前任务：v1.2.1 浏览器回归失败专项修复（M4 / M6，禁止提交与发布）

- 最新用户限定本轮仅编辑、隔离/mock 测试；禁止 commit/push/tag/Release、生产 Komari/Agent/数据库操作及重置/清理工作树。下方旧发布授权不是本轮授权。
- 起点仍为 `feat/enhanced-tags-return-routes` / `f9cec36ca3d3373ba2e9edf2e0844d30dc66933d`，保留全部 v1.2.1 未提交修改；未发现其他修改该工作树的 Agent。本轮开始的文件指纹与 binary diff 已留在 ignored `test-results/v121/browser-regression/`。
- 完整上一轮 JSON、全部 15 个失败断言和 trace 已读取，截图解码并归档：119 PASS / 15 FAIL / 0 SKIP。按 trace 分类：6 个任意手动线路被去空格；1 个 UTC 时间显示改成 ISO；3 个短状态文案的旧契约；5 个无周期节点列表累计参考比例与其他视图不一致。失败前均无主题保存调用，不能将其误报为持久化失败；累计值本身正确，无历史查询/时区/数学定义错误证据。
- 修复采用已知线路名白名单缩写、保留自定义文本；原状态码及展开详情加强验证。统一 trafficByMode + trafficAccounting + useNodeTraffic，区分 machine-cumulative / billing-cycle / unavailable；累计仅参考比例，绝不生成周期剩余。详情与对比共享周期订阅，原始累计/导出/图表不改。
- 已完成最小集合覆盖 15/15（首批 14/15，新增 time[datetime] 断言改为匹配配置解析器规范 UTC 字符串后，仅复验该 1 项通过）；相关单元/组件 211/211、浏览器专项 42/42，均零失败/跳过/flaky。五种模式跨卡片/列表/详情/后台/对比严格核对周期用量/余额/比例，累计 100/200 TiB 保留；管理 UI 保存后刷新恢复亦通过。
- 全项目非修复 lint、type-check、生产 build、git diff --check 全通过；本轮精确范围 17 个文件（包括此日志），无原文件删除。134 个原浏览器用例名称、7 张基准图和 Playwright 策略均未改变，无 skip/fixme/only。证据 `diff-audit.json` / `tested-code-hashes.json`。
- 本轮唯一一次全量 Playwright 已结束：134 PASS / 0 FAIL / 0 SKIP / 0 FLAKY，命令 exit 0（包含 visual-test 构建约 731.94 秒）。原来的 15 项在完整结果中全部通过，原用例名称、基准和阈值保留。
- scratch `enhanced-v121/verify_regression.py` 已实际执行并通过：精确读回报告、核对 17 个文件范围、编译/测试源码指纹未改变、HEAD/index 未改变，Node 实际执行共享计算生成五模式 fixture 对照。证据为 ignored `test-results/v121/browser-regression/final-verification.json` 与 `final-report.md`，15 个旧失败的截图/trace/原断言完整保留在 before/。
- 本轮浏览器修复具备后续提交条件，但没有执行 commit/push/tag/Release，HEAD 仍为 `f9cec36ca3d3373ba2e9edf2e0844d30dc66933d`。这不是新一轮原生 Komari / Full 发行验收；正式发布前仍需单独完成对应关卡。1.6.1、真实公网 traceroute/ASN 未验证，生产及市场未操作。

## 当前任务：v1.2.1 UI / 五分类管理 / UUID 独立流量周期（M4 / M5 / M6）

- 用户授权在 v1.2.0 已发布基线 `f9cec36ca3d3373ba2e9edf2e0844d30dc66933d` 上开发、隔离测试、正常提交/FF 推送及正式发布 v1.2.1，禁止覆盖 v1.2.0、生产数据/Agent/监控任务和市场写入。当前既有 worktree/branch clean，没有其他写入 Agent，Release/附件 ID 与 SHA 已读回保存于本次 scratch 基线；v1.2.1 tag 尚不存在。
- 明确展示边界：前台原有流量进度条/已用/剩余/百分比只更换计算口径，不增加卡片高度，不显示重置日、下次重置、时间范围、倒计时或其图标。重置日、当前区间、下一边界、周期用量仅在后台「节点与卡片 → 流量周期」逐节点表格展示/保存。
- 事实修正：v1.2.0 只有累计计数器展示，未发现仍启用的自然月重置逻辑；本次不恢复旧月初默认，不删除历史缓存。UUID 配置默认未设置，持久化现有托管主题配置；不存 tags 或仅 localStorage。
- 已核对官方 1.6.0 源码：`public:queryMetrics` 支持明确时区 start/end、按 UUID 的 traffic.up/down sum 和 net.total.* 基线；服务端 TrafficCounterDelta 保留重启/回绕安全处理。使用服务端可求和增量，缺基线/保留不足/无数据时失败关闭为数据不足，不把缺失值当 0。服务层共享查询与缓存，不改原始计数器/历史。
- 计划：统一顶部标签排版；底部回程 CU 红 / CT 蓝 / CM 绿三栏胶囊与可展开详情；原生 manifest 分类从 10 合并为 5，增强管理同样五分类并保留所有旧字段/default/未知设置；逐 UUID 周期编辑器与 Shanghai 日历边界、流量专项、UI/持久化/隔离 1.6.0 集成，验收后新 Commit 和新 Release。保留原 Ping/Transit/财务/SGD/GPU/拓扑。
- 进度：完成前置核对与 API / 管理兼容审查；尚未宣称 v1.2.1 功能或测试完成。本次证据目录 scratch `enhanced-v121/` 与 ignored `test-results/v121/`。

## 当前授权与验收：v1.2.0 稳定发布（2026-11-12，M5 / M6）

- 用户本次明确授权开发、测试、新 Commit、仅向 `casiuna/Glassmorphism-Enhanced` 快进 main、正式 v1.2.0 Release 及官方市场更新提交；下方旧 Session / 禁止发布 / Trial 身份要求均为历史，不再代表当前授权。
- 保留原 worktree/branch，起点 HEAD `37092754388f04d44a3131a4f51130b8b6a1abae`，远端 main `c58cff54cfb4128e727c58cfb972e1e1b3254ff8`，未发现其他进程在本工作树写入。48 个改动/新增源文件已备份到当前 scratch `enhanced-v120-final/initial-worktree.tar.gz`，另存完整 binary diff；无 reset/clean/stash。
- 审查已发现并修正：管理服务仍引用移除的 TRIAL_SHORT；稳定身份升级后的旧版 ZIP 路径/Full 集成假设；旧 0.1 插件回滚包 channel 校验不兼容。保留真实旧版迁移 fixture，不抹除历史版本。
- GitHub HTTPS 没有凭据，但已配置 SSH 验证为 casiuna，向本仓库 main 的 dry-run 可 fast-forward；尚未实际 push/tag/Release/市场操作。固定 Bun 1.3.14 已仅安装到 scratch，准备冻结依赖和稳定版全量验收。
- 阶段 1 / 2 完成：稳定身份、管理保存/鉴权、协议与模块版本、UUID、旧配置、安装/升级/回滚和发布工作流已审查。修复 Komari 为 v1.2.0 加入六项默认值导致误判升级/回滚冲突的问题；保留旧值，仅接受声明的默认新增项，真实管理员改动仍拒绝覆盖，失败时原生 API 恢复完整旧 map 并读回。另补 theme dist/BUILD.json 的完整 commit/dirty 标识与 Full 交叉校验。
- 实际验收：固定 Bun 1.3.14 冻结安装无变更；Node 26.12.1 / Python 3.14.9 / Linux ARM64（发布 CI 固定 Node 24）。单元/组件 138/138、浏览器 107/107（集中管理 12/12）、Plugin 22/22、Helper 13/13、HTTP 8/8、Full 专项 32/32、独立伴生真实集成 19/19、Full 原生集成 28/28；全部零失败/跳过/flaky。lint/type-check/build/diff-check 已通过；文档最后修改后再做最终 lint。未更新快照或阈值。
- 旧主题使用实际下载并验证 SHA 的官方 v1.1.1 包；旧 0.1 Plugin 为固定历史源码构建、明确标识的测试包，不冒充历史官方二进制。原生测试新建私有 loopback 后端/Agent/Helper，所有子进程已退出。Full 28 项包含真实失败后的恢复、卸载/回滚、后台重启和亮暗/手机管理界面。
- 阶段 3 / 4：准备审查并提交完整源码/测试/文档，之后从 clean HEAD 重建生产原生 ZIP 和 Full tar.gz，重跑交付归档的 Full 原生集成并执行 tests/full/verify_delivery.py。已通过且源码未改的独立单元/浏览器等不无意义重跑。测试/运行缓存/DB/Token/ZIP 全部留在 ignored test-results 或 scratch，不进 Git。
- 阶段 5 已获用户再次明确指示：现在直接发布到自有 GitHub Release；通过安全 FF 推送自有 main，由 Actions 创建 v1.2.0。必须读回 main / Actions / Tag，并下载验证 SHA、根 Manifest 与同一源码 commit。阶段 6 按最新用户要求暂停：等用户实际测试确认后再提交官方市场，本轮不再请求市场登录、触发官方更新、创建 PR 或写市场仓库。
- 当前验收证据索引：`test-results/stable-{unit,browser}.json`、`stable-protocol.xml`、`helper-unit.json`、`companion-integration.json`、`full/{distribution-unit,transport-unit,native-integration}.json`；最终本地/远端下载核查另存 `test-results/release/`。自动探测默认关闭；真实公网 traceroute、生产节点、系统服务不触碰；只验收隔离 Komari 1.6.0，不宣称 1.6.1。

## 当前续作：统一 Full 本地试用产品（M5 / M6）

- 用户最新授权：固定 Session `20261019_060547_b240f6`，现有 worktree/branch，起点 `37092754388f04d44a3131a4f51130b8b6a1abae` clean。只做本地源码、fixture、隔离 1.6.0、额外本地提交；无 push/tag/Release/市场/生产/SSH/真实 traceroute，无人为 Session Job 截止时间。
- 已只读核对原生 1.6.0 分块上传、主题列表/选择/整份设置保存、插件配置/审批/安装/删除协议。主题自身不能代装插件；节点身份没有受支持的短期 enrollment，不能凭浏览器装远端程序。官方插件重装保留独立 storage，原生删除则清除它。
- 实施：一个 Full ZIP，内部仍是原生包；主题使用独立 EnhancedTrial 身份与 prerelease，正式 Enhanced v1.1.1 不覆盖。根主题 manifest 仍为产品版本源，Full manifest 汇总模块版本、commit、依赖、校验值与完整 notices。
- 统一 Python 标准库 CLI：默认 dry-run，显式操作/权限审批，私有备份、前置版本检查、幂等升级、失败补偿/回滚及安全卸载。缺乏旧包/无法保护原配置时先拒绝，不调用全库恢复或绕过核心。所有 HTTP 凭据只用私有文件/隐藏交互与 body/header，禁 URL/argv/日志/发行包。
- 管理入口遵守 Component → Composable → Service → RequestManager，管理员专用；合并 UUID 策略、Helper 注册/心跳/版本、时间/错误/手动优先与结果开关，显式确认后只改选定配置。Helper 接入只在被测节点经明确授权读取本机私有 Agent 配置，不修改 Agent，自动探测仍默认关闭。
- 验收计划：保留既有全部行为回归；新增 bundle/CLI/安全边界/失败恢复、管理 UI 响应式、真实隔离原生 API 与 Helper fixture E2E。新报告单独写入 test-results/full/，不将旧轮次或 fixture 冒充真实公网验证。最终 clean commit 后重构建并核验 Full ZIP。

## 续作：可安装本地候选与受限采集链路

- 当前唯一 Session `20261019_060547_b240f6`，既有 `tags-return-routes` / `feat/enhanced-tags-return-routes`，只读确认起点 `328a37100214c7d530fdc107ea9b936b396076b9` clean，父提交 `c58cff54cfb4128e727c58cfb972e1e1b3254ff8`。此前提交身份阻塞已用用户授权的命令级 casiuna/noreply 身份解决，下面关于“待身份”的条目仅为历史。
- 授权扩展为本工作树内实际 helper/插件实现、隔离 1.6.0 后端和模拟 traceroute 的 E2E、本地新 commit 与可安装候选；不 amend、不 push/tag/Release/市场/生产，不运行真实 traceroute、SSH 或真实节点。
- 已读 Transit coordinator/storage/limiter/collector 与 1.6.0 principal/server/主题配置 API。正式 Agent 身份支持 JSON POST body token，插件收到 principal.client_uuid；管理员通过正式 session cookie。只申请 node + allowRoutes，不借用 system RPC、exec、tags 或自创裸回传鉴权。
- 计划：实现小型版本化逐跳证据协议与一次性租约、默认关闭的 UUID 策略/周期、持久化及限流；Python 标准库固定 argv 节点助手（fixture 模式只允许 loopback）、只读管理员主题消费通道；独立插件 ZIP / helper archive / 主题 ZIP 与安装卸载回滚文档；真实 1.6.0 装载、鉴权、隔离 UUID、回传、重启和 UI 测试。
- 安全取舍：自动结果 API 默认仅管理员读取，不把隐藏节点/私有站点信息通过新增匿名接口发布。访客继续现有公开主题手动设置；自动结果用于登录管理员试用，不以宽泛 allowSystemRPC 换取无人值守公开写入。试用说明必须显式写出此边界。
- 基线 105 unit / 47 targeted 的 JSON 与哈希已读取，避免无意义重复；本轮改动后再按影响范围回归。长任务不向 Session 控制传 timeout，不设人为 Job 截止时间；探测和 HTTP 自身仍必须有安全超时限制。

### 受限采集已实现 / 提交前验收

- 新增 `companion/enhanced-route-probe`（0.1.0，node + allowRoutes，不申请 system RPC/exec）及标准库 Python helper。固定九目标/安全 argv、20 跳、每家 25 秒/64 KiB、串行三家；仅 HTTPS（显式 loopback 测试除外），私有 0600 token/config，拒绝 URL/argv 凭据及任意目标，所有回传以正式 Agent principal UUID + 一次性 lease 绑定。
- 默认关闭的 UUID 策略/周期（默认 360 分钟，最少 60）、单节点冷却、最多 4 个有效 lease、180 秒租约/10 分钟 job、独立请求桶、0600 原子持久化、故障关闭已实现。管理员-only snapshot，主题共用 RequestManager/一份 30 秒订阅；访客不请求私有结果。手动优先，fixture 明确显示模拟，失败/超时/权限/缺 traceroute 等显式显示。
- 真实官方本地 Komari 1.6.0 + Agent 1.5.11 集成已 19/19，通过原生分片上传安装插件/主题、解包安装 helper、fixture 回传、真实浏览器消费、真实托管设置保存/手动优先、TTL、改名、持久化重启、429、UUID/鉴权/跨站拒绝及原生卸载。JSON `test-results/companion-integration.json`，没有真实 traceroute；后端/Agent 只绑定本次新建的 private runtime、HOME/TMPDIR/SQLite/loopback。
- Playwright 单元/组件 120/120、协议 Node tests 16/16、helper unittest 13/13，均 0 失败/跳过；全量 Playwright 95/95（未更新旧快照），覆盖原有 Ping/Relay/流量/财务/SGD/资源/拓扑与响应式。ESLint（非 --fix）、type-check、build、diff-check 通过。早期 linter 格式错误已在新文件范围修正。
- 审查补充了旧 companion 缓存不能覆盖更新导入数据的 regression：先真实 red（得到 expired），再按 collectedAt 选择更新证据后 green；不以隐藏过期数据或禁用三网解决。
- 独立打包脚本 `scripts/package-route-trial.py` 只枚举源文件；helper archive 含安装/卸载器、默认禁用示例、systemd/OpenRC 最小权限模板和完整 MIT。安装器拒绝覆盖旧版本目录，卸载保留未知文件/私有配置；本地文件安装卸载与模板检查通过，没有安装/启用系统服务。
- 使用既有命令级 `git -c user.name=casiuna -c user.email=86237623+casiuna@users.noreply.github.com commit` 创建后续本地提交；绝不 amend 328a371，不写持久 Git identity，不 push/tag/Release/市场。最终 clean commit 后必须重建三个包并用 `tests/companion/verify_delivery.py` 校验 commit/SHA/manifest/报告，最终报告在 `test-results/trial/delivery-verification.json`；中间 dirty BUILD.json 不是交付物。
- 文档：`docs/companion-trial.md`、`docs/companion-validation.md`、helper README。仍未验证真实三网/traceroute、OpenRC/systemd 实际服务运行、物理 GPU；自动结果仅管理员，不偷开匿名发布。所有这几项都须在交付中明示，不作为完成过的测试。

## 当前开发：节点头部标签与独立回程线路（本地，不发布）

- 固定 Session `20261019_060547_b240f6`；工作树 `tags-return-routes`，分支 `feat/enhanced-tags-return-routes`，来自实时 main / v1.1.1 `c58cff54cfb4128e727c58cfb972e1e1b3254ff8`。原有工作树不动。
- M4：用户标签移至头部右侧，保留可见性配置，过滤内部元数据但不改源 tags。M5：按 UUID 的版本化回程配置、手动优先、自动结果消费和 TTL；M6：MIT 来源、mock / 响应式回归。
- Transit 参考固定 `ee9f31c5ff104e033ded858171ce0b63c672e878`。不移植 admin:exec、终端或 tags 写回链路；不复制官方后台。自动采集未验证前只交付消费端，禁用默认自动结果消费，不声称可运行采集。
- 本轮不 push/tag/Release/市场，不接触生产/数据库/Agent，不运行真实 traceroute。保留当前机器累计流量及三网/Transit/费用/SGD/拓扑；不把历史月度实现恢复为当前能力。

### 本轮完成与验证

- 中断后只在既有隔离工作树续作，未新建 Session/worktree；实时 `HERMES_SESSION_ID` 核对为 `20261019_060547_b240f6`。未向 Session Job 传递有限 timeout；所有有界测试自然退出。
- 普通标签已移到头部第二行右侧，底部不重复；列表/详情共享过滤和可见性，拓扑继续读取未修改的原始 tags。新增回程数据模型、严格校验/序列化/v0 迁移、UUID 手动覆盖、TTL、公开来源/时间显示和官方主题设置字段。未改流量/财务/资源/Ping/Relay/拓扑算法、主题 short/version 或预览图。
- 单元/组件 `node node_modules/@playwright/test/cli.js test -c tests/request-manager.config.ts --reporter=list,json`：105 passed（其中新增 38），0 failed/skipped/flaky。JSON：`test-results/tags-routes-unit.json`。
- 关键回归 `node node_modules/@playwright/test/cli.js test tests/visual/node-tags-return-routes.spec.ts tests/visual/transit.spec.ts tests/visual/traffic.spec.ts --retries=0 --reporter=list,json`：47 passed（新增 UI/配置 14、Transit 20、流量 13），0 failed/skipped/flaky。JSON：`test-results/tags-routes-save-final.json`；六种桌面/手机/mini 亮暗场景 PNG 在 `test-results/artifacts/`，测试断言无重叠/横向溢出及星标、国旗、三网可见。没有覆盖旧像素快照。
- `node node_modules/eslint/bin/eslint.js . --max-warnings 0`、`npm run type-check`、`git diff --check`、`npm run build` 均 exit 0。当前运行环境找不到 bun，因此用现有 npm 执行同一 package.json 脚本，没有安装/更新依赖或全局环境；lint 不用仓库带 --fix 的脚本。浏览器复用 `../tools` 的 Chromium、sysroot 和 fonts.conf；后台 shell 需显式把现有 node 路径加入 PATH。
- 首轮浏览器曾因未带运行时动态库启动失败；修正本地运行环境后，两个测试又因列表默认未选 tags 字段/详情并非 heading 而失败。按真实配置/DOM 修正测试后已全部通过，没有隐藏应用异常或禁用三网。
- 设置保存用固定本地 mock 验证 1.6.0 `POST /api/admin/theme/settings?theme=Enhanced` 的完整 map 保存/刷新消费契约及 Transit 规则保留；不是官方后台表单+真实数据库 E2E。1.6.0 插件 principal/allowRoutes 和主题配置覆盖语义仅做官方 Tag 源码核对。
- Transit MIT 全文位于 `public/licenses/transit-MIT.txt`，构建 ZIP 内 `dist/licenses/transit-MIT.txt` 已逐字节对比上游 LICENSE 一致。所有测试证据/构建产物/依赖均不纳入提交。
- 自动采集默认关闭且未接入；没有安装插件/助手、运行 traceroute、写回 tags 或调用远程 exec。剩余工作为受限伴生插件/节点轮询助手、安全/身份/限流验证与隔离 1.6.0 真实采集 E2E，不能声称已完成自动识别全链路。
- 本地提交实际受阻：`git commit -m "feat: add validated return-route model and conservative ASN classification"` exit 128，Git 未配置 author name/email。没有猜测用户身份、设置全局 Git 配置或伪造提交；HEAD 仍为 v1.1.1 基线。首批仅暂存 THIRD_PARTY、MIT notice、两个回程 utils 和对应 unit spec（5 文件），其余 17 文件留在工作区；不 reset/stash/clean。待用户确认 author 后按模型/显示两个功能块提交。
- 提交失败后仍完成最新生产 build/type-check、全项目非修复 ESLint 和 staged/unstaged diff-check，均 exit 0。当前 ZIP 文件名内 c58cff5 只是基线 HEAD，包含未提交开发内容，仅为本地候选，不是该 commit 的正式发行包。证据总览见 `test-results/local-candidate-verification.json`。

## 当前任务：v1.1.0 / Komari 1.6.0（独立 Session，待审核）

- Session `20261019_060547_b240f6`；独立仓库及 Worktree `/home/hermes/workspaces/komari-110-20261019_060547_b240f6/theme`，分支 `feat/komari-1.6.0`，main 基线 `20109bfab5de1278c94d6344114dfd50f3ecf496`。下方旧 Session、发布授权与路径仅属历史，不扩大本轮权限。
- 里程碑：M6 兼容性测试/文档，必要的 M3 能力门控及 M4 渲染故障回退分开审查；保持布局、机器累计流量、三网及 Transit。
- 修改应用前的兼容性分析已记录在 `docs/komari-1.6.0-compatibility.md`，固定官方两个版本、三个上游 Tag 和市场 SHA。
- 基线 type-check / 非修复 ESLint / build 通过，单元 28/28；浏览器首轮因宿主缺动态库未进入断言，正在任务目录内补依赖，不更新快照掩盖失败。
- 所有服务仅为本任务新建的 loopback 测试实例。不操作线上、其他 Session、旧主题或共享 Git 元数据；不直接编辑数据库。
- 本轮以待审核交付为边界；正式发布、main 推送和市场 Issue/PR 在验收及审核后进行，未执行不得标记成功。
- 后续有限验收已完成：浏览器 81/81、单元 67/67、真实 Komari 1.6.0/1.5.1 集成 16/16；最终 diff-check、全项目非修复 ESLint、type-check、生产 build 均 exit 0。最新 ZIP 解压文件与已测集成包逐字节一致；历史浏览器报告无源码指纹，实体 GPU 未验证。
- 当前授权仅为文档定稿、精确审核并在开发分支创建一次本地提交，不 push/tag/Release/market。下步须独立复核远端 main 可快进且另获授权，再由干净 CI checkout 构建带正式提交 SHA 的发行包，读回 tag/Release/下载资产验证；本地候选及 CHANGELOG 的 Released 标题不代表远端已发布。

> 这个文件给 AI 编程代理和二开维护者使用，用来保存任务计划、执行日志、验证结果、风险点和交接信息。它的目标是防止断网、会话丢失、上下文被压缩后无法继续工作。

## 当前快照：v1.0.7 已获发布授权，文档定稿交接

- 固定 Session `20261016_173909_e02c7c`；仅 `/home/hermes/Glassmorphism-Enhanced-v107-rollback`，分支 `fix/v1.0.7-traffic-rollback`，HEAD 仍为基线 `3b00bb93e5c834fb8dd87b8013a52121c2483bfd`。原有源码/测试脏改动及四个月度专用源模块的删除继续保留，不操作其他工作树。
- UI 已恢复 `net_total_up/down` 机器累计与 Komari up/down/min/max/sum 口径；配额为非本月参考比值，健康速率为实时上下行合计。三网 Ping / Transit、性能修复与历史采集保留，不写库、不清零。
- 已真实通过 **50 个定向测试**：累计流量 21/21，Transit 20/20、header 5/5、viewport 4/4（后三者共29/29），0 failed / skipped。TypeScript、全项目无修复 ESLint、diff-check 和生产构建 exit 0；Vite 1864 modules，dist 761 files / 12.206 MiB。不是全量像素基线验收。
- 报告：`test-results/traffic-cumulative-report-stage5b-first.json`、`test-results/stage6-transit-header.json`、`test-results/stage6-node-ping-viewport.json`。本地旧 HEAD 命名 ZIP 7.826 MiB，manifest 1.0.7、CRC 和全部 dist 字节已核验，但不能作为正式发布包。
- 用户已明确授权“精简 README，然后发布”。本任务只定稿指定7个文档，README 使用发布版徽章、发行文档标记 Released；不重跑50测试，不更改源码/测试/manifest/依赖/workflow，不执行 commit/push/tag/Release 或生产部署。
- **下一任务执行已授权的提交和 main push**，触发现有 main version-bump Actions；正式构建与附件以 CI 为准，须读回 main、tag、Release 和下载资产进行核验。本步骤没有远端写入成功记录，不可把文档 Released 标记当作 push/Actions 已完成。原27个 dirty 路径完整保留。
- v1.0.6 tag / 附件仍固定于原发布提交 `b9f7f4f730a9e8445d261363fe8c070c98bd3001`；其他工作树和历史日志不动。以下旧“权威当前状态”及旧任务授权均为历史，不能覆盖上述交接或扩大本轮范围。

## 权威当前状态：v1.0.6 已发布

- GitHub 已于 2026-10-18 发布 v1.0.6；源提交及 annotated tag peeled 固定为 `b9f7f4f730a9e8445d261363fe8c070c98bd3001`，附件为 `komari-theme-Glassmorphism-build-b9f7f4f.zip`。main 后续文档提交不改变这个发布锚点；旧 v1.0.5 保留。GitHub 发布不等于生产网站已安装。
- 本文下方旧“当前任务 / 未发布 / local candidate / 仅本地提交”均是历史快照，不能覆盖上述已发布事实，也不能扩大当前授权。
- 当前固定 Session `20261016_173909_e02c7c`，在隔离工作树的新分支 `docs/v1.0.6-postrelease-sync` 仅同步指定文档及 release workflow 的 version_changed 门控，审核后普通推送 main；不修改源码、manifest、依赖、测试或 ZIP，不创建/移动 tag、Release 或部署，不访问原校准工作树。
- 本轮验证与远端读回结果存于 `/home/hermes/.hermes/cache/scratch/v106-postrelease-sync/`；GitHub Release 和附件在操作前已通过官方只读接口确认。本轮不重跑 155 项测试、不构建。

## 使用规则

- 开始多文件、架构、安全、发布、迁移类任务前，先新增或更新“当前任务”。
- 开发中按时间追加“执行日志”。
- 结束前必须更新“验证记录”和“交接说明”。
- 不要写入密钥、token、cookie、服务器密码、私有用户数据。
- 如果记录过期，直接标注“已完成/已废弃”，不要让后续 AI 误判。

## 历史任务与验收快照（以下并非当前发布状态）

### v1.0.6 — validated local delivery snapshot

- 固定 Session `20261016_173909_e02c7c`；仅 `/home/hermes/Glassmorphism-Enhanced-v106` 的 `fix/v1.0.6-performance`。原校准工作树的 13 个文件完全不动。
- 继承并核对 13 tracked 修改、9 untracked 文件；历史验收为 Chromium 155/155、单元/组件 28/28、type-check、203 文件无修复 ESLint、production build 和 diff-check 全通过。本轮不重复 155 项全量浏览器测试。
- owner 已批准 manifest 1.0.6、原生 Bun 锁文件及冻结安装验证、必要快速验收；仅所有 gate 通过后允许一次精确暂存的本地 commit，再从新 HEAD 重新打包。禁止 push/merge/rebase/tag/Release/deploy、生产和数据库操作。
- 使用项目指定 Bun 1.3.14；二进制在 scratch 中，下载 SHA-256 已与官方发布校验表比对。release workflow 的 Bun 版本也固定为 1.3.14，不再使用 latest；不改变依赖范围或给 package.json 添加 version。
- Git 默认 identity 未配置；若提交，沿用本仓库既有代理身份 `Hermes Agent <hermes@localhost>`，仅该条 commit 命令生效，不修改全局或共享 Git 配置。
- 原生 bun.lock 由 Bun 1.3.14 生成，保留已验收的全部直接依赖版本，再由 Bun 对齐原 package.json 范围；package.json 字节不变。未顺带升级首次解析出的 10 个更新直接依赖版本。
- 冻结安装真实完成：全新无 node_modules 的 scratch 目录，以及本隔离工作树，`bun install --frozen-lockfile` 均 exit 0；安装前后 lock SHA-256 不变，两处直接依赖与锁一致。仅验证本地 Linux ARM64，不冒充 GitHub Actions 执行结果。
- 本轮快速验证：npm type-check exit 0；全项目无 --fix ESLint 204 文件、0 error/warning、exit 0；单元/组件 28 pass / 0 fail / 0 skip、exit 0；npm production build exit 0；冻结依赖后 Chromium monthly-views 14 pass / 0 fail / 0 skip、exit 0。未重跑完整 155 项。
- 最终只读审核：原有 22 个源码/测试文件哈希全部未变；精确允许 29 个源码/测试/版本/文档/工作流/锁文件路径，无异常路径、明显 secret-pattern 或超过 1 MiB 的意外文件；tracked diff-check 与 11 个新增文件的只读补丁检查全部 exit 0。dist/ZIP/node_modules/scratch 不纳入提交。
- 状态：本地提交前 gate 全部通过；只允许随后的一次本地 commit 及从新 HEAD 重建。旧 ZIP 已在 scratch 原样备份，禁止远端发布及生产操作。实际 commit SHA、最终 ZIP 校验和及最终工作树状态保存到 `/home/hermes/.hermes/cache/scratch/v106-release-verification/task-d-final-delivery.json`，不在本次提交内自引用或预写结果。以下较早记录不扩大本轮授权。

### Monthly traffic reliability — immediate current-cycle calculation (unreleased)

- 基线：本 fork 已发布 v1.0.5，main/tag peeled `3bb76d9fd6f86d9fe56845b12922ee75866f2ed3`；干净工作树后创建 `fix/monthly-traffic-reliability`，不复用 release branch。
- 最新 owner 授权覆盖旧 v1.0.3 rollout 语义：移除 grandfathering；立即读取当前 UTC 月周期。缺失/不完整数据用 unknown/partial，不回填 net_total_*，不假零。
- 审计 Komari 1.5.0 `f18ad72c173b8821711cba0f2fb238c2486ec9af` / 1.5.1 `f0cc0fba38ce161935372633cae5248c934e2b23` 只读源码。保留批量 metric、5min refresh、10min cache、并发合并、single-node history 和隔离 cache；无 shared history fanout。
- 保留服务端 traffic_limit_type 配置；服务商计费需用户官方对账，不猜规则、不写库。财务按量估算保留用户选择，明确机器累计/非账单口径。
- 当前最新 owner 授权一步完成最终构建、commit、普通 push 和远端验收，仅维护本 fork `fix/monthly-traffic-reliability`。复用已完成的分段 126/126 测试与静态验收，不重跑无必要全量回归；不 checkout/stash/reset/clean、不创建 PR、不 merge/push main、不 tag/Release，不操作生产/DB/VPS/Agent或服务商后台；upstream 严禁写入且不访问 #57。
- manifest 保持 1.0.5，未来 1.0.6 仅建议、待用户确认。实现与分段回归完成，正在最终审计与 feature-only 交付；不是正式发布。

### 2026-10-11 — final build / commit / fork-only push

- 本轮承接原 23 个改动路径，不重做功能；HEAD/origin/main/main 与已发布 v1.0.5 基线一致，origin 仅用户 fork，未发现并发修改任务。
- 上次仅因缺少 Git identity 而 commit exit 128，未产生提交或推送；owner 已确认复用同仓库历史 author/committer `Hermes Agent <hermes@localhost>`。续交付使用一次性 `git -c user.name=... -c user.email=... commit`，不改全局 identity/凭据，不重跑已通过的审计和测试。
- 分段 traffic 68/68 + 其它 visual 58/58 正常 exit 0；最近 lint/type-check/diff-check 全 PASS，源码在静态验收前后哈希一致。提交前与该静态快照再比对，只允许 AICACHE 交接文本变化。
- 提交前验收已完成：production build 正常 exit 0、diff-check PASS；888 个 tracked/unignored 文本的 secret-pattern scan 无命中，新增 IPv4 无异常，源码与最近静态验收快照一致（仅 AICACHE 交接文本变化）。只提交审计的 23 个路径；新 commit 后再 build，验 ZIP 顶层、manifest 1.0.5、CRC、entry count、preview/dist bytes、size/SHA256；仅正常 push 修复分支并读回 refs。真实结果保存在 `/home/hermes/.hermes/cache/scratch/monthly-traffic-final-delivery.json`，避免 commit SHA / ZIP digest 的自引用。
- 月窗口与配置口径仍是主题推断及采集数据，未做生产校准或服务商官网对账；本轮不是正式发布，main/tag/Release/PR/生产/upstream 写入均禁止。

### 2026-10-11 — static-only checkpoint

- 分支、HEAD/origin/main、origin fetch/push URL 与恢复基线一致；21 tracked + 2 untracked 改动完整，暂存区为空，未发现同工作区 Git/Bun/Node 任务或 index.lock。
- `bun run lint` / `bun run type-check` / `git diff --check` 均正常 exit 0；快速 secret-pattern scan 无命中，校验前后文件哈希未变化。上轮 68/68 + 58/58 成功日志仍保留，未重跑测试或构建。
- 本轮仅补交接记录，不改源码/测试，不 commit/push。静态结果：`/home/hermes/.hermes/cache/scratch/monthly-traffic-static-result.json`。下一阶段须按新的当轮授权继续；commit-matched 包必须在新 commit 后重建。

### 2026-10-11 — final feature-only delivery (interrupted plan; not completed)

- 启动现场与上一阶段一致：21 tracked + 2 untracked 路径、暂存区为空，分支/HEAD/origin/main 基线正确。只读核验 origin fetch/push URL 均为用户 fork，远端修复分支尚不存在，main 和既有 v1.0.5 tag peeled 均为发布基线；保存远端 refs 用于交付后差异核验。
- 上阶段独立真实终态保留：traffic 68/68、其余 visual 58/58，均 exit 0，无 skip/失败；126 个测试 ID 集合完整且不重叠，不将旧 SIGTERM 算作成功。
- 最终审查取消旧 migration helper/注入、SUM/覆盖/null/mode、刷新/cache、history 与机器累计隔离及财务非月度估算边界；文档明确月窗口仅按节点元信息推断，服务商官网/账单人工对账尚未做。
- 当时计划重新执行 package scripts lint/type-check/build 和完整 visual，但在检查脚本写完后中断，未实际执行该交付验证、commit 或 push。计划结果路径 `/home/hermes/.hermes/cache/scratch/monthly-traffic-final-delivery.json` 不能当作已完成证据；最新静态阶段已覆盖这一续跑计划。
- 新 HEAD 的 production candidate ZIP 才是交付包；预提交旧 HEAD 命名构建仅作验证，不能当新修复产物。仅正常 push 当前修复分支并设置对应 tracking，绝不 force 或创建 PR。生产校准、main 合并及正式发布都不在本轮范围。

### 2026-10-10 — bounded reliability review (local only)

- 恢复现场核对一致：`fix/monthly-traffic-reliability`，HEAD/origin/main 仍为 `3bb76d9fd6f86d9fe56845b12922ee75866f2ed3`；21 tracked + 2 untracked 修改全部承接，暂存区为空；未切分支、未重置/清理。
- 只读 Komari 1.5.1 `public.metric.go` 证实 `adaptiveFillPublicMetricSeries` 会根据 sparse cadence 放大 `interval_seconds`，可能将规律性中间缺桶伪装成连续覆盖。月度查询改为 `fill_empty=false`，不接受 adaptive-filled 响应为 ready；不改变其他图表的 fill 策略。
- 无法定位的 invalid timestamp 不能被静默丢弃后认证完整。新增专项覆盖：真正中间缺桶、重复点掩盖缺桶、adaptive interval inflation、invalid time、有效零值与 open final bucket；现有 up/down/min/max/sum、UTC、周期和 no-fanout 回归保留。
- ready 仍只表示返回的真实聚合桶覆盖，不证明桶内每次 report、retention 前历史、跨边界 delta 或供应商账单完整；raw-only/history 始终 partial/unknown，不做累计值补月流量。
- compare 隐藏 null 进度，Health 排除 null quota，export 保留 nullable bytes/status/basis；本轮新增跨组件浏览器测试证实 partial/unknown 的比较进度、实际 JSON 下载与显式 Health 摘要不会冒充零或满额预警，不增加月度查询。生产与逐服务商对账未执行。
- 本轮验证：type-check、ESLint（无 --fix）、visual-test build、production build、diff-check PASS；targeted traffic 68/68 PASS。首次 targeted 为 66 PASS/2 FAIL，原因是新测试误把 fixture 的两个续费周期组当作一个，已只修正测试假设后重跑通过。
- 完整 visual 用独立短任务分段：traffic 68 PASS + 非 traffic 58 PASS，均正常 exit 0；与 Playwright --list 注册的 126 个测试 ID 作集合核验，无遗漏/重叠/skip，全部覆盖。未更新 snapshots；历史 SIGTERM 不计入成功。单次完整重跑因预算检查未启动（NOT_RUN_BUDGET），随后通过互斥分段补齐。
- 全部源码/测试只保留本地 dirty 状态；HEAD/origin/main、manifest 1.0.5 不变，未 commit/push/PR/tag/Release/upstream/生产写入。执行日志：`/home/hermes/.hermes/cache/scratch/monthly-traffic-reliability-review-results.json`；集合验收：`/home/hermes/.hermes/cache/scratch/monthly-review-segment-coverage.json`。
- 下一轮优先：保留当前分支与 23 个改动路径，针对真实节点做另行授权的只读数据对账，重点是桶内漏报、retention 缺口、边界 delta 和元信息周期与官方政策的差异；不要将 ready/126 项 PASS 解释为账单完整性。提交/推送需用户另行授权。

## 历史任务（当前授权已取代以下冻结/迁移要求）

### v1.0.5 — fork-only release branch normalization

- 唯一写入仓库：`casiuna/Glassmorphism-Enhanced`；upstream 仅可只读参考，禁止向 upstream 创建 PR/issue/comment/review 或 push。本轮不访问或改动 upstream PR #57，也不创建任何 PR（包括 fork 内 PR）。
- 正式交付分支：`release/v1.0.5`。先创建该远端 ref 指向已验证 candidate `8b00ca2f816d37d33ce9d32209ea72ee268cc173`，读回确认后才以 expected-SHA lease 删除远端临时保留分支 `release/v1.0.5-local`；v1.0.5 代码/历史完整保留，当前本地已切换至标准分支。
- fork main 保持 `232e20b2703ec37f43dedb2f143441c292697588`；初始远端标准分支与 `v1.0.5` tag 均不存在。manifest 保持 `1.0.5`；正式 tag/Release 命名只能是 `v1.0.5`，不得使用临时名称。
- 最小验证已通过：branch/ref 读回、manifest `1.0.5` 原样、workflow 与 fork main byte-identical、`git diff --check` PASS。GitHub 只读查询确认本 fork 的 `Release On Version Bump` 为 `active`；本地临时分支及其 remote-tracking ref 也已安全删除。
- 本轮只提交当前发布/交接文档；src、tests、manifest、preview 和 release workflow 均不改。docs-only 不重跑 lint/type-check/build/visual，先前 candidate 验证结果保留为历史证据。
- 只读确认 `Release On Version Bump` 响应本仓库 `main` push，读取 manifest 生成 `v${version}`，build 成功后在最终 main SHA 创建 annotated tag，再创建/更新本 fork Release；tag 指向其他 SHA 时 hard-fail。用户未来自行合并 `release/v1.0.5` 至本 fork main；本轮不 merge、不 push main、不 tag、不 Release。
- 文档提交将以正常 fast-forward push 写入 `release/v1.0.5`，最终分支 SHA 由交付读回记录；原 candidate 仍是其祖先。历史中的 feature branch/PR 记录仅保留事实，不再作为当前操作指引。

## 已完成：v1.0.5 candidate 整理（历史记录）

### v1.0.5 — Transit relay-first release finalization

- 基线 origin/main `232e20b2703ec37f43dedb2f143441c292697588`；工作树干净后创建 `fix/transit-relay-first`。
- M6 + parser contract correction：格式统一为 `RelayNode|TargetNode|Relay-Target`，保留 target-keyed last-valid-wins；同步 fixture、README、manifest help 和 `docs/transit-rules.md`。
- 不动 monthly traffic、finance、safe-area、admin-login、Server/Agent 或历史 release 记录。
- owner 已明确正式版本为 1.0.5：manifest 从 1.0.4 bump 至 1.0.5，同步 README / CHANGELOG / current release docs。旧 `TargetNode|RelayNode|Task` 改为新 `RelayNode|TargetNode|Task`，已有配置必须手动交换前两列；无自动迁移、旧顺序猜测或 backend rewrite。
- 本轮仅 M6 版本与发布说明收尾；parser、src、测试、fixture、snapshots 均保持提交 `4c721e0b200eb095c54c3fc03f9a409f217dc3d9` 原样，manifest 除 version 外无差异。旧 CHANGELOG 发布内容未改，仅将已核实发布的 1.0.4 状态改为 Released。
- 本轮 1.0.5 重跑验证：lint / type-check / production build / diff-check PASS；Transit targeted `20/20 PASS`、完整 Playwright/visual `81/81 PASS`，未更新 snapshots。929 个项目文件 secret-pattern scan 0 命中。candidate ZIP 顶层 contract、manifest 1.0.5、772 entries、CRC、preview/dist byte-identical 均通过；提交后重建 canonical final-HEAD ZIP，最终 SHA256 记录在交付附录而不制造 self-referential commit。
- 已新增 `docs/release-notes-v1.0.5.md`，明确旧/新规则及手动交换前两列、无自动迁移。owner 将自行 merge；本轮只 commit/push 同一 feature branch，不 merge/tag/Release。GitHub API 只读确认分支尚无 PR，credential 仍不可用，允许以创建入口交付，不阻塞代码收尾。
- 验证：lint / type-check / production build / diff-check PASS；Transit targeted `20/20`，完整 Playwright/visual `81/81`，未更新 snapshots。parser 覆盖单条、trim、空行、注释、malformed、CRLF、case-sensitive、duplicate target；UI 覆盖 direct/unmatched/transit、多 relay、共享请求与失效场景。
- 交付：只 push `fix/transit-relay-first`，不 merge/tag/Release；当前环境 GitHub SSH 可用，API credential 未配置时使用 PR 创建链接交接。

## 上轮任务

### v1.0.4 — safe-area / native admin login / release metadata

- 基线：已发布 v1.0.3，main `474334735e72e2deeb276e2c81c017d865ef0725`；分支 `fix/v1.0.4-safe-area-admin-login`。
- 范围：M4 顶部 safe-area 与原生登录导航；M6 版本/文档/回归。保留 traffic migration、finance、Transit、preview。
- 原生依据：Komari Server tag 1.5.0、komari-web tag 1.5.0 的 routes.ts / Login.tsx；无独立 login/return-url，原生 LoginDialog 成功进入后台。内嵌官方版本 ebfbd3e 同样提供首页登录与 /admin 成功目的地。
- 本地验证：lint、type-check、production build、diff-check PASS；完整 Playwright/visual `80/80 PASS`（新增 header 5 项，无 snapshot 更新）。927 个 tracked/unignored 文件 secret-pattern scan 0 命中；新增数据仅 fixture/public upstream references。ZIP 772 entries、CRC PASS、manifest 1.0.4、preview byte-identical；最终 commit-matched SHA 在交付记录中。
- 原生登录 fallback：进入内嵌官方 public homepage 后再点击可见 Login；没有自建表单或隐藏按钮。iOS 为 Chromium viewport + standalone 属性 + 注入 inset 几何模拟，未做真机 iOS Safari。
- 环境：新 ARM64 checkout，工具链/浏览器依赖仅装用户目录；GitHub SSH 可用，当前缺少 GitHub API token/gh 登录，PR 创建待授权环境恢复。技术依据见 `docs/v1.0.4-review.md`。不 merge/tag/Release，不修改 Server/Agent 或生产。

## 历史任务（非当前发布状态）

### v1.0.2 incident / v1.0.3 traffic-load hotfix

- 状态：implementation and validation in progress；当前分支 `hotfix/v1.0.3-traffic-load`，基于 merged `main` `f9b566f9b67a610dea0e5386c6847c1aef0c1b86`，不 push main、不 merge、不创建 tag/Release。
- 目标：manifest `1.0.3`；validated compatibility target: Komari Server `1.5.0`，不修改 Server/Agent。
- 生产 incident：owner 已 rollback 到 v1.0.1；v1.0.2 出现月流量消失/归零、Ping/三网与其他数据延迟或停止加载、上传 100% 卡住。证据指向 frontend shared request-pool/backend pressure：shared clock 每分钟刷新而 traffic cache 仅 30 秒，metric 缺失时 shared home 对多节点 fan-out full-cycle history；没有数据库写入、counter reset 或数据损坏证据。
- Hotfix 设计：`useMonthlyTrafficUsage` 保留单一 shared clock，仅用 cycle key 变化触发边界 reload；正常刷新限制为 5 分钟，monthly cache TTL 提高到 10 分钟，并合并并发 refresh。加载/失败期间保留 v1.0.1 cumulative display，不闪为 0。
- Shared/home 只走一次 batched `public:queryMetrics`；method unavailable 或 node metric series 缺失/空/null 时直接 metric->legacy，不启动 N-node `common:getRecords` fan-out。显式单节点 detail 仍可使用 bounded history compatibility path，并由 requestManager/cache 去重；shared 与 detail-history cache mode 分离，Home legacy 不会遮蔽 Detail history。
- UTC 00:00 renewal-day cycle、annual billing monthly quota、29/30/31 short-month clamp、SGD/S$/C$/USD 与 1.5.0 optional GPU 类型兼容保持不变；Agent v1 protocol removal 与主题 RPC fallback 分层。固定 production rollout anchor 为 `2026-09-16T00:00:00.000Z`；visual-test mode 使用固定 `2026-07-01T00:00:00.000Z` 仅服务历史 July fixture，不进入 production build。Finance audit 确认现有 monthly/yearly/remaining-value/rate 计算是无状态当前 metadata/rate 展示，本迁移门只作用于 monthly traffic。
- Regression：fake clock 多分钟不重复 monthly query；cycle boundary 只 reload 一次；shared home 无 history fan-out；monthly unavailable 不阻塞 ping/三网 RPC；loading 保留 legacy；detail history predicate 等待完整 `uuid+start+end+hours`，修复 v1.0.2 CI flake。
- 当前验证（forward-only anchor code commit `5179945e86f875b0c94c0d6c7d071a15502156ac`）：targeted traffic tests `21/21`；完整 `bun run test:visual` `73/73`；`bun run lint`、`bun run type-check`、production-mode `bun run build`、`git diff --check` 已通过。secret scan 扫描 924 个项目文件，0 个新增命中；唯一全仓命中是未被本轮修改且与 baseline 一致的 `public/admin-app` 生成资产静态字符串。
- PR #4 的最新 hotfix handoff 已通过 Code Quality / Visual Regression；最终 branch SHA、commit-matched ZIP 与远端 CI 结果在 PR body 中同步。当前仍保持 review-only，不 merge、不 push main、不创建 tag/Release。

### 上一轮 1.0.0 发布记录

#### Transit Carrier Ping / independent 1.0.0

- 状态：Ready for review；M5 通用中转三网估算、M4 展示、M6 README/版本/测试/ZIP，以及仓库 rename 与身份分层。功能提交已推送 feature branch，PR 已创建并读回： https://github.com/casiuna/Glassmorphism-Enhanced/pull/1 （base main，open，非 draft，未合并）。
- 当前 branch：`feat/transit-carrier-ping`；最终 commit、匹配 ZIP 与 SHA-256 已记录在 PR #1；全程未在 main 开发。
- 用户已完成 rename；认证 API 读回确认 `casiuna/Glassmorphism-Enhanced`，parent 保持 `sanrokamlan-prog/komari-theme-Glassmorphism`。
- origin 已改新仓库 SSH；upstream 使用已核实 parent HTTPS，已 fetch 两者，不合并新 upstream。
- CLI SSH 成功认证为 casiuna，fingerprint 与任务书一致，keypair 未修改。GitHub API credential configured；Fine-grained PAT，权限按用户配置为 Metadata Read / Contents Read-Write / Pull requests Read-Write / Actions Read。仓库角色不是 token scope 证明，实际端点另行验证。
- 版本策略以用户最新决定为准：manifest `1.0.0`，manifest author 为 `casiuna`；以后使用独立 SemVer，不再使用 enhanced 后缀；旧 tag/Release 保留。Upstream base: Glassmorphism v3.3.7。
- 纯 parser/RTT/loss/history 放 utils，app store 归一化，source composable 选择唯一 direct/relay UUID，NodeCard 不解析设置。共享 task catalog 仅用于区分不存在任务与无数据，不新增请求；relay 查找继续严格使用 `nodes.visibleNodes`。
- 收尾校正：Release 文档明确 workflow 仅响应 `main` push，合并本 PR 后的 `1.0.0` 变化预期触发 `v1.0.0`；Transit 新增标签、Tooltip、状态和错误文本补齐中英文；README 说明未登录不可解析 Hidden Relay；README/CHANGELOG/THIRD_PARTY 保留 Tokinx 与 sanrokamlan attribution。
- 本地验证：`bun run lint`、`bun run type-check`、`bun run build`、`bun run test:visual`、`git diff --check` 全部通过；完整 Playwright 51/51（原 33 + 新增 18），原视觉快照未更新。桌面与移动测试确认两个目标共用 relay 时仅 1 次 relay queryMetrics + 1 次 relay stats，全局 tasks 请求 1 次；动态关闭/删除规则/relay 离线与恢复、多 relay 独立性、英文文本和 Hidden relay 安全过滤通过。
- README 按 UTF-8 字节精简至原文 30.4%；当前版本与发布文档统一为 1.0.0。新旧地址只在上轮历史日志保留，不机械改写历史。
- 安全检查：Git 跟踪与待添加文件中未发现生产节点名、PAT 模式、私钥头；实际 API credential 字节扫描通过，没有回显凭据。API Contents/PR/Actions/Release 读取端点均 HTTP 200。
- 构建仅保留既有 globe chunk >600 kB 警告；最终 commit-matched ZIP 已校验 manifest、顶层结构与 SHA-256，并记录在 PR #1 交付附录。GitHub API 当前读回 HEAD check-runs 为空、status 总数为 0，不能冒称远端 CI 通过；工作流保持未 dispatch。PR 创建与读回已证明 API Pull requests 写/读可用，未执行任何 API Contents 写入。
- 发布边界：feature branch/PR review only；不 push main、不 merge、不 tag、不 Release；未修改 Server/Agent。
- 真实生产验收尚未进行，不能将虚构 fixture 测试作为生产通过证据。

### 上轮发布记录

- 状态：release-ready，v3.3.7-enhanced.1 的本地发布整理、合规审计与完整验证已完成；远端 push、tag、Release 与资产核验由本次发布流程继续执行。
- 目标：基于已合并 upstream v3.3.7 的 `cb4b1fa`，完成安全/许可证审计、增强版文档与 metadata、完整验证、标准 GitHub Fork/main/tag/Release/ZIP 发布。
- 发布身份：GitHub repository `casiuna/komari-theme-Glassmorphism-Enhanced`；显示名 `Glassmorphism Enhanced`；内部 `short` 保持 `Glassmorphism`。
- 安全边界：不 force push、不 push upstream、不操作 Komari/Krystal/生产环境；移除 Git 跟踪的 `.env` 但保留本地文件。
- 许可证：Glassmorphism、three-network、Emerald 当前均为 MIT；根 LICENSE 原样保留，THIRD_PARTY 准确记录实质适配与算法参考边界。
- 安全审计：未发现私钥、硬编码 token/API key、真实用户路径或被跟踪的 build cache/node_modules；upstream 跟踪的 `.env` 仅保留本地并从发布索引移除，`.gitignore` 已覆盖。
- 验证：Bun 1.3.14 install 通过；`bun run type-check`、`bun run lint`、`bun run build` 通过；合并 v3.3.7 后完整 Playwright/视觉回归 33/33 通过。仅保留既有 globe chunk >600 kB 警告。
- Fork：标准公开 Fork 已创建并安全重命名为 `casiuna/komari-theme-Glassmorphism-Enhanced`，GitHub `isFork=true` 且 parent 为 `sanrokamlan-prog/komari-theme-Glassmorphism`；origin/upstream 已按约定设置为 HTTPS。

- 状态：done，本地 follow-up 已实现并完成回归；等待按最终提交 SHA 生成 ZIP，未 push。
- 目标：2026-08-19 follow-up：未启用自定义背景时采用 three-network 的明暗翡翠网格背景；地球连线模式新增 `persistent` 常驻实线。
- 边界：保留最新版自定义图片/视频加载与失败回退；`persistent` 复用自动连线拓扑和数量上限，只改变三种渲染器的线条呈现，不改变 upstream 语义。
- 验证计划：亮暗背景 DOM/CSS、tiled 常驻实线、realistic/cobe 模式接入、完整 typecheck/lint/build/Playwright、最终 ZIP 结构与 SHA-256。
- 实现：默认背景只摘取 three-network 的翡翠 spotlight、斜向网格 SVG 和 light/dark 样式，保留官方自定义背景加载/错误回退；`earthArcMode` 新增 `persistent`，复用 auto arcs，realistic 使用完整 dash 且停止 dash 动画，tiled 使用常驻实线，cobe 沿用其原生常驻 arc。
- 验证：`bun run lint`、`bun run build`（含 type-check）和 `git diff --check` 通过；新增聚焦用例 5/5、完整 Playwright 32/32 通过；更新的两张暗色移动端视觉基线经人工查看，背景与卡片对比度正常。

- 状态：done，本地 feature branch 已实现并验证，按最终提交 SHA 生成可导入 ZIP；未 push、未连接或修改 Komari Server/Agent。
- 目标：以 v3.3.6 / `b353afb` 为唯一基底，语义移植 three-network 三网 Ping 面板，并增加 `auto | upstream | off` 地球连线模式。
- 里程碑：M5 新功能 + M4 UI；不修改 Komari Server、Agent 或用户 Ping Task。
- 范围：复用官方 Metric Store/legacy fallback 与请求生命周期；独立 carrier matcher/聚合；最新版 NodeCard 三网 UI；共享 upstream parser；realistic/cobe/tiled 统一限量 arcs；确定性回归和可导入 ZIP。
- 来源快照：three-network `2f172e7`（manifest 2.4.0）；Emerald `1372043` / v1.0.10。Emerald 当前 arcs 为地区 cluster 到访客国家坐标的 hub-and-spoke，不是 upstream 或节点全连接。
- 分支：`feat/three-network-earth-arcs`。
- 不做：不覆盖旧 NodeCard/useNodePingStats，不引入后端依赖，不 push 远程，不改变高级标签/ASN-BGP 拓扑语义。

### 2026-08-19 Three-network carrier ping + earth arcs

- 三网实现保持官方 Ping/Metric Store 为唯一数据源：公开任务列表增加共享缓存，`useNodePingStats` 在现有请求结果上派生按任务统计，独立 carrier composable 完成任务名匹配、同运营商多任务聚合、历史色块和 tooltip；没有新增每节点 Ping 历史请求。
- 运营商关键词覆盖联通/China Unicom/Unicom/CUCC，电信/China Telecom/Telecom/CTCC/ChinaNet/CN2，移动/China Mobile/Mobile/CMCC/CMI/CMIN2；没有匹配任务时三行安全显示 `--`。
- upstream 标签解析已从高级拓扑面板提取为共享 util，保留 `upstream|parent|上游|父节点` 与 `:|=|：` 语义；高级标签拓扑和 ASN/BGP 工具继续使用同一逻辑。
- 地球新增 `auto | upstream | off` 设置。自动模式采用确定性、限量 hub-and-spoke：仅取有效且去重的地理点，最多 25 个 cluster / 24 条 arc；upstream 模式仅在两端有合法坐标时生成 child -> upstream，最多 48 条；realistic、cobe 和 tiled 三种渲染器共用同一份 arc 数据。
- Geo 解析继续以主题已有经纬度为准，并在首选地址解析失败时尝试同节点另一 IP 候选；不会仅因私网 IPv4 排除带公网 IPv6 或已有地区坐标的节点。
- 验证通过：`bun install --frozen-lockfile`、`bun run type-check`、`bun run lint`、`bun run build`、`git diff --check`；完整 Playwright 27/27 通过，覆盖无任务、普通任务、三网、多电信任务、无 upstream 自动连线、upstream 三段链路、关闭模式、缺失 geo、移动端 containment、realistic/cobe/tiled 与高级 ASN/BGP/标签拓扑回归。
- Windows 工具链：PowerShell 7.6.5（`C:\Program Files\PowerShell\7\pwsh.exe`），Bun 1.3.14；隔离环境没有全局 Node，验证命令显式把 Codex bundled Node 加入 PATH。

- 状态：in-progress，本地修复与验证完成，正在发布 v3.3.5
- 目标：修复详情页延迟任务卡片、图例和主页 Ping 指标线与 Komari 后台任务排序不一致的问题。
- 里程碑：M4 UI/UX 兼容性修复，不修改后端任务权重或接口契约。
- 已确认缺陷：后端 `GetAllPingTasks()` 明确按 `weight ASC, id ASC` 返回；主页重新计算该规则，详情页新版指标路径却按 `getPingMetricStats` 的无保证数组顺序重建任务，可能与后台错位。
- 实现：共享排序工具改为使用 `public:getPublicPingTasks` 返回数组索引；LoadChart 的 Ping 指标线和 PingChart 新指标路径重建的任务卡片、图例、颜色均使用该顺序；指标接口独有的未知任务按数值 ID 稳定追加。
- 回归：夹具构造后台 `30,10,20`、指标统计 `20,30,10`、ID 自然顺序 `10,20,30` 三套冲突次序；直接排序断言通过，Playwright 能收集到详情页卡片顺序用例。
- 验证：`bun run type-check`、涉及文件 ESLint、`bun run lint`、`bun run build`、`git diff --check` 均通过；生成 `komari-theme-Glassmorphism-build-e212925.zip`，顶层仍为 `komari-theme.json`、`preview.png`、`dist/`。
- 浏览器限制：托管 Chromium 可执行文件未安装；系统 Chrome 能启动唯一用例但在 Windows 驱动生命周期中停住直至 120 秒外层超时，没有返回断言结果。内置浏览器可加载本地预览，但不能复用 RPC mock，且本机没有 Komari 后端，因此未把该页面作为数据回归证据。
- 发布目标：`komari-theme.json` 与 README 同步至 v3.3.5；提交只包含 Ping 排序实现、回归夹具、版本和发布文档，排除工作区原有预览图删除与本地目录。

- 状态：done，v3.3.4 已发布
- 目标：节点卡片剩余 5 天内标红、6–10 天标黄；审计并修复详情页 4 小时 / 1 天历史视图 CPU 空白或异常显示。
- 里程碑：M4 UI/UX + 兼容性修复，不修改计费计算、实时指标或后端接口契约。
- 范围：共享到期阈值、NodeCard 到期提示、LoadChart 指标历史回退、确定性 Playwright 回归检查。
- 已确认缺陷：指标历史当前只检查“任意序列有点”，CPU 序列缺失或全空时仍会压过 `common:getRecords` 兼容数据，导致 CPU 图表无有效数值。
- 实现：共享阈值改为 5 天红色、10 天黄色；NodeCard 对到期状态着色并把无效日期显示为 `-`；短时历史缺少有效 CPU 点时回退 `common:getRecords`，同时保留新指标接口返回的 Ping 等独立序列；兼容记录的运行时数值先过滤非有限值再进入图表。
- 回归：新增固定时钟下的 5/10 天边界颜色检查，以及新指标接口缺少 `cpu.usage` 时 4 小时 / 1 天 CPU 兼容回退检查。
- 验证：`bun run lint`、`bun run build`、后续 `bun run build-only` 和 `git diff --check` 通过；构建产物 `komari-theme-Glassmorphism-build-b56ef97.zip` 保持 `komari-theme.json`、`preview.png`、`dist/` 顶层契约。
- 浏览器：系统 Chrome 两条聚焦用例均执行完且无失败产物，Windows Chrome 在测试结束后的关闭阶段未自行退出，由 120 秒外层超时终止；应用内浏览器确认 Vite 入口可装载，本机未运行 `127.0.0.1:25774` Komari 后端，因此普通开发页的 API/RPC 代理按预期返回 500，实际数据视图由确定性 mock 用例覆盖。
- 发布目标：`komari-theme.json` 与 README 已同步至 v3.3.4；发布提交仅包含本次修复、测试、版本和文档，不包含工作区原有预览图删除及本地目录。
- 发布完成：提交 `e2129252b358fcbc42d1fe445b736df2b8003f8c` 已推送 `main`；Release On Version Bump run `31414499653` 与 Visual Regression run `31414499655` 均成功，tag / Release `v3.3.4` 指向该提交。
- 线上资产：`komari-theme-Glassmorphism-build-e212925.zip`，7,593,495 bytes；GitHub digest 与下载后 SHA-256 均为 `6DE5F47E8EB4178572C3B78117481403EB68A8858C7A1DBDDC0D2F004CC37693`，包内版本 3.3.4、771 个 entries，顶层契约完整。此最终交接状态只保留在本地，避免纯文档推送再次触发工作流。

- 状态：done，v3.3.3 已发布且 Issue #37 已关闭
- 目标：统一 Komari `price = -1` 免费节点语义，移除“免费 / 周期”文案，并让单节点剩余价值显示“无 / N/A”。
- 里程碑：M4 UI/UX + 小范围业务展示修复；金额计算继续返回数值，不把 `NaN` 作为业务状态。
- 范围：公共价格 formatter、NodeCard、NodeList、NodeCompare、InstanceDetail、FinanceDetails 及首页财务排除免费节点逻辑；聚焦回归、v3.3.3 Release 和 Issue 收尾。
- 兼容边界：`price = 0` 现有行为不随本次变更扩大；总剩余价值和总成本中免费节点继续贡献数字 0。

- 状态：done，v3.3.2 已发布且 Issue #36 已关闭
- 目标：为节点卡片 CPU、内存、硬盘、流量指标原生增加一致的线性图标，替代依赖 custom body DOM 注入的脆弱方案。
- 里程碑：M4 UI/UX 小版本，不修改数据、请求、计费或卡片高度契约。
- 范围：普通卡片图标+文字；mini 卡片图标替代 C/M 并保留无障碍名称；必要视觉基线、README、版本、Release 与 Issue 收尾。
- 审查结论：Ping、网速、累计流量和剩余价值区已有图标；没有发现需要与本次同批处理的其他结构或性能问题。
- 不做：不增加图标组件依赖，不给所有文字机械堆图标，不调整卡片尺寸、进度条状态色或数据布局。

- 状态：done，v3.3.1 已发布且 Issue #33 / #35 已关闭
- 目标：修复 GitHub Issue #33（详情页保留首页全部节点 Ping 查询）与 #35（提前续费后的剩余价值被封顶为一个计费周期）。
- 里程碑：M2 性能修复 + 小范围业务计算纠错，不改变发布契约或长期机兼容语义。
- 范围：首页 Ping 摘要订阅生命周期、摘要采样上限、在途 metric 请求释放、两处剩余价值计算及聚焦回归验证。
- 发布：用户已明确要求发布新版，并在 Release 验证成功后关闭 Issue #33 / #35。
- 不做：不修改全局实时状态轮询语义，不调整超过 100 年的长期机展示。

- 状态：done，等待用户部署运行态测试
- 目标：生成 Linux amd64 本地集成测试包，合并验证 Komari PR #604、已合并访客审计 PR #602、komari-web PR #82 与 Glassmorphism v3.1.8 内置默认主题。
- 里程碑：M6 集成构建、测试交付与验证，不扩大现有上游 PR 范围。
- 范围：CGO Linux amd64 核心二进制、可导入主题 zip、独立管理端构建、测试说明与 SHA-256；部署后在用户保持登录的浏览器中继续联调。
- 安全约束：`visitor_audit_enabled` 保持上游默认关闭，由管理员在审计面板明确开启；测试包不预置数据库、账号、密钥或访客数据。
- 来源：Komari PR #604 `f08f47d`（含访客审计 PR #602）；komari-web PR #82 `0fee1f1`；Glassmorphism Release `v3.1.8` / `a52572a`。
- 不做：不把 Glassmorphism 默认主题替换混入计费 PR #604；不发布测试构建为正式 Release；不构建 Windows 包。

## 执行日志

### 2026-08-11 Ping task order parity

- 官方源码与测试确认 `GetAllPingTasks()` 按 `weight ASC, id ASC` 查询，公开任务接口与旧 Ping 记录接口都保留此顺序；新版 `getPingMetricStats` 结果没有等价排序保证。
- 修复不再在前端复制后端权重规则，而是以公开任务接口的数组位置作为顺序来源，使主页与详情页在后端未来调整排序实现时仍保持一致。
- 聚焦 Bun 断言结果为 `30,10,20`，Playwright `--list` 确认新增用例被收集；本机浏览器执行限制已记录在当前任务，CI 可使用仓库的托管 Chromium 完成最终浏览器回归。

### 2026-07-30 v3.3.3 Issue #37 free-node semantics

- 上游 `komari-web` 约定确认：`price = 0` 不展示价格标签，`price = -1` 才显示免费；Issue 两个现象真实存在。
- 影响范围复核：`tagHelper.getRemainingValue` 仅被 NodeCard 调用；FinanceDetails 与 InstanceDetail 使用 `financeHelper.calculateRemainingValueCNY`，不能靠修改一个数值 helper 自动修复。
- 实施方案：引入统一免费节点判断；金额计算保持数字 0，NodeCard / FinanceDetails / InstanceDetail 在展示层输出“无 / N/A”；同步修正列表、对比面板和排除免费节点逻辑。
- 聚焦浏览器验证：首页卡片、排除免费开关、财务表和详情页流程 2.2 秒实际通过；Windows 系统 Chrome 完成用例后未自行退出，命令由外层超时终止。
- 本地验证：`bun run lint`、`bun run build`（含 `vue-tsc --build`）和 `git diff --check` 通过；未重复运行无关浏览器或完整视觉矩阵。
- 本地资产：`komari-theme-Glassmorphism-build-2cd56ce.zip`，7,584,641 bytes，SHA-256 `F669E4172869CC7A9B5C40CDFC98D360ACB46C57015EA763CDDB976BF489131E`；包内版本 3.3.3，共 771 个 entries，顶层为 `komari-theme.json`、`preview.png`、`dist/`。
- 发布完成：提交 `63a1d0166e7bf9ab4bb29b003f3549fcdeb5a27f` 已推送 main；Release On Version Bump run `30530144758` 和 Visual Regression run `30530144811` 均成功；tag / Release `v3.3.3` 指向该提交。
- 线上资产：`komari-theme-Glassmorphism-build-63a1d01.zip`，7,592,709 bytes，GitHub digest 与下载后 SHA-256 均为 `01a1d0111b0405f0ffaa280070d77e0dfe46bdd728edf0dbe7396a93be3ff249`；包内版本 3.3.3、771 个 entries 和顶层契约均正确。
- Issue 收尾：`#37` 已留言说明实现与验证结果，并以 completed 关闭。此最终交接状态只保留在本地 AICACHE，避免纯文档推送额外触发完整 Visual Regression。

### 2026-07-29 v3.3.2 Issue #36 metric icons

- 聚焦审查确认 Issue 合理且定位准确：`NodeCard.vue` 已使用 Iconify，但四项主指标标题仍是纯文字，mini 模式甚至仅显示 `C/M`；下方网速、累计流量、剩余价值已有图标，无需扩大范围。
- 图标语义复用详情页现有 Iconify 标识：`tabler:cpu`、`icon-park-outline:memory`、`tabler:server-2`、`tabler:arrows-transfer-up-down`；不新增依赖，也避免首页与详情页使用两套图标语言。
- 实施边界：普通卡片保持文字并添加装饰图标；mini 模式图标固定宽高并保留可访问名称；颜色只作视觉辅助，指标文字、图标形状和百分比仍共同传达含义。
- 聚焦浏览器验证：桌面亮色、移动暗色和 mini 卡片共 3 个用例实际通过；系统 Chrome 在 Windows 上完成用例后仍未自行退出，命令由外层超时终止，未重复运行完整视觉矩阵。
- 本地验证：`bun run lint`、`bun run build`（含 `vue-tsc --build`）和 `git diff --check` 通过；只运行了本次直接相关的 3 个浏览器用例，没有重复详情页或完整视觉矩阵。
- 本地资产：`komari-theme-Glassmorphism-build-9f13b72.zip`，7,584,520 bytes，SHA-256 `ACCFF5672075532F27062AD68BAA74C03D74A87261293E698FEB3C0F647894BD`；包内版本 3.3.2，共 771 个 entries，顶层为 `komari-theme.json`、`preview.png`、`dist/`。
- 发布完成：提交 `2cd56ceaad5eb0e292e2c70f7dc3be9cf4155158` 已推送 main；Release On Version Bump run `30452135059` 和 Visual Regression run `30452134859` 均成功；tag / Release `v3.3.2` 指向该提交。
- 线上资产：`komari-theme-Glassmorphism-build-2cd56ce.zip`，7,592,580 bytes，GitHub digest 与下载后 SHA-256 均为 `f2ef3697197abbf0b10ee09bd7be184051d66ac71770273ab687c65ebf0514cd`；包内版本 3.3.2、771 个 entries 和顶层契约均正确。
- Issue 收尾：`#36` 已留言说明实现和验证结果，并以 completed 关闭。此最终交接状态只保留在本地 AICACHE，避免纯文档推送额外触发完整 Visual Regression。

### 2026-07-29 v3.3.1 Issue #33 / #35 hotfix

- `#33` 根因确认：首页由 `KeepAlive` 保留后，节点卡片和列表的 `useNodePingStats` scope 不会销毁，因此每个 UUID 的 Metric Store 查询及 60 秒刷新订阅继续存在；卡片摘要还复用了完整图表的 6000 点上限。
- `#33` 修复：首页激活状态显式传到卡片/列表 Ping composable，离开首页立即释放订阅并中止 metric / legacy 在途请求；无订阅时不再进入 fallback；摘要查询上限独立降为 150。
- `#35` 修复：`financeHelper.calculateRemainingValueCNY` 和卡片 `tagHelper.getRemainingValue` 同步移除单周期封顶；超过 100 年的长期机兼容语义保持不变。
- 回归：新增 Playwright RPC 断言，覆盖首页摘要 `max_points=150` 及进入详情后 Ping metric 只包含当前 UUID。系统 Chrome 中用例 4.0 秒通过；Windows Chrome 完成测试后未自行退出，托管 Chromium 结果留待 GitHub Actions 最终确认。
- 数值：固定随机种子 `0x35c0ffee` 校验 10,000 组价格 / 周期 / 剩余天数，其中 9,727 组跨多个周期；两套计算入口全部通过，最大浮点误差 `7.450580596923828e-9`。
- 本地验证：3.3.1 版本下 `bun run lint`、`bun run type-check`、`bun run build` 和 `git diff --check` 已通过；聚焦 Playwright RPC 用例通过。按用户要求停止额外的完整视觉矩阵。
- 本地资产：`komari-theme-Glassmorphism-build-7d2c7e1.zip`，7,584,274 bytes，SHA-256 `F438AF4BDF12849983D206600A4C30025D64EF33ED47EBC330DA3E2458D039EB`；包内版本 3.3.1，顶层为 `komari-theme.json`、`preview.png`、`dist/`，包含 769 个 dist entries。
- 发布完成：提交 `9f13b72442944f9a99c808054fe8a0a18dd710c2` 已推送 main；Release On Version Bump run `30445113985` 和 Visual Regression run `30445114027` 均成功；tag / Release `v3.3.1` 指向该提交。
- 线上资产：`komari-theme-Glassmorphism-build-9f13b72.zip`，7,586,093 bytes，GitHub digest 与下载后 SHA-256 均为 `feadd4b3194aaacda719771584425c93dc8ffe3d70281fb0979e8a3d12c03e9f`；包内版本、顶层结构、预览图和 769 个 dist entries 均正确。
- Issue 收尾：`#33` 与 `#35` 均已分别留言说明修复和验证结果，并以 completed 关闭。此最终交接状态只保留在本地 AICACHE，避免纯文档推送额外触发完整 Visual Regression。

### 2026-07-16 exact Linux integration bundle

- 刷新上游状态：Komari #604 仍为 open，head `f08f47d6a7f5e4cdec28a1e89c2183f1c1b6e1fb`，前端及 Linux/Windows 构建矩阵全部成功；komari-web #82 仍为 open，head `0fee1f123009eca4b5f380549845bed756fa2d0c`。
- 发现旧本地 Komari 快照除默认主题外仍有 23 个换行归一化后的真实源码差异，集中在 Metric Store、迁移和启动流程，因此废弃旧二进制，不作为 PR 精确测试包交付。
- 从 GitHub 下载 `f08f47d` 原始源码，创建干净编译树；逐项比较 `cmd/database/pkg/protocol/utils/web` 共 243 个核心文件，排除有意替换的 `web/public/defaultTheme` 后差异为 0。
- 默认主题替换为已发布的 Glassmorphism `v3.1.8` 资产；包内配置名为“主题设置”，完整管理端来源记录为 komari-web `0fee1f1`，路由桥接覆盖 `/admin`、`/terminal`、`/manage/*` 并加载 `glass-admin.css`。
- 使用 Go `1.26.4`、Zig `0.14.1`、`x86_64-linux-musl`、`CGO_ENABLED=1` 和 `-buildvcs=false` 构建 Linux amd64 ELF；显式版本为 `integration-f08f47d-theme-v3.1.8`，版本哈希为完整 Komari PR head。
- `go test ./database/clients ./web/api/client ./web/rpc/jsonrpc` 在 Windows amd64 CGO + Zig 环境下通过；`go vet ./...` 通过；Linux 目标构建通过。
- 功能存在性清单确认：计费费率/锚点/下月到期/一次性开机费/流量重置保护/非阻塞上报，访客审计默认关闭/RPC/IP-UA 限流/UTF-8 截断/日志索引与 SQL 过滤，主题审计摘要及 JSON/CSV 导出，以及 Glassmorphism 默认前后台均进入交付包。
- 最终目录：`output/integration-test/final/komari-glassmorphism-integration-20260716/`；总包：`output/integration-test/final/komari-glassmorphism-integration-20260716.zip`，32,089,492 bytes，SHA-256 `02f896751dfb87ff1a4a144ca69c3f9bfd83376de54492ba2013918f51c6c873`。
- 二进制 SHA-256 `a966d695e4d3b84496567465ed8bf7a585459656bf756a1e50616ff21b3578ae`；主题 zip SHA-256 `f4dd86ad26a9a55ebfcecc1c76ac07cdcd5fcfd1883cf608ec4e7f491388ea26`；独立后台 zip SHA-256 `e17fa820a4a2d184541f068bc996dea70ffa3bb6502be102dad902b1bd599f6d`。
- 未包含：每日/每周主题更新提醒、自动安装主题、不可篡改账本；实时费用仍是 fork 实验性估算功能。运行态数据库迁移、真实 Agent 上报和登录浏览器联调等待用户在 Linux 测试机部署。

### 2026-07-15 Linux integration test bundle

- 已确认 Komari PR #604 没有修改上游默认主题，但其提交历史已包含 PR #602 的访客审计 RPC、默认关闭开关、限流和日志过滤修复。
- 已确认 Glassmorphism `dist/` 包含由 komari-web `b8fcc4580fe2cd5b715b76c97f4ff4b9ba066581` 构建的完整 `/admin-app/`，入口桥接覆盖 `/admin`、`/terminal`、`/manage/*`。
- 用户指定只需 Linux 测试包；目标收窄为 `linux/amd64`。
- PR #604 复核修复：账单累计写入失败现在只记录日志，不再阻断已保存的 Agent 上报和运行时在线状态；新增回归测试，提交 `b242ee8` 已推送 PR 分支。流量费率明确为每 TiB（`1024^4 bytes`）。
- komari-web #82 本地补强：管理端账单弹窗新增流量、运行时间、首次开机费和总估算，30 秒刷新；费率前后端统一限制为 `0..1e12`；明确锚点可修改但首次上报后不可清空。`npm run lint` 为 0 error / 27 个既有 warning，`npm run build` 通过。
- v3.1.6 空白页已稳定复现：`HomeView` 新增 `PingMonitorDialog` 时把弹窗放在主根节点外，视图变成 Fragment；Vue 报 `Component inside <Transition> renders non-element root node`，`out-in` 离场后主区域为空。修复为把弹窗移入 `.home-view` 单一根容器；浏览器首页 -> 详情 -> 返回首页恢复正常且无新 warning/error。
- 永久约束已写入 `AIAGENTREADME.md` 和 `src/AGENTS.md`：路由视图必须单元素根，新增全局弹窗后必须验证动画开启/关闭两种路由往返。

### 2026-07-15 v3.1.6 release preparation

- 默认主题后台：完整 komari-web 已从 `b8fcc4580fe2cd5b715b76c97f4ff4b9ba066581` 重新构建并同步到 `public/admin-app/`；旧主控不返回 `traffic_rate` 时隐藏且不提交新增计费字段。komari-web PR #82 为 open、clean、mergeable。
- 实时费用上游：Komari PR #604 为 open、clean、mergeable；`build-frontend` 和 Linux/Windows 386、amd64、arm64、riscv64 共 8 个构建任务全部成功。字段覆盖流量单价、小时单价、一次性首次开机费、首次 Agent 上报锚点和持久累计流量。
- 主题功能：节点卡/列表延迟与丢包可打开完整 Ping 图；剩余价值可打开逐节点费用、币种和汇率明细；访客审计增加开关、UTF-8 字节截断及完整 JSON/CSV 导出；默认背景替换为原创青蓝/淡紫/薄荷网格图。
- 背景资产：`public/images/default-background-v2.webp` 与 `output/imagegen/default-background-v2.webp` 均为 2048x1152、32,436 bytes、SHA-256 `42377961822666817def3d3b51b2c236a0f5f631dd1475535d9438a6b7ac551b`；仅使用本地 Lanczos 放大修正画布，未再次调用图像 API。
- 代码复核：修复费用明细把“未设置到期时间”误显示为“今天”的问题；空费率和空开机费按 0，开机费只有存在首次成功上报锚点才计入；汇率保持“1 CNY 对应目标币种”的既有换算方向；旧核心能力检测通过。
- 验证：`bun run lint`、`bun run type-check`、`bun run build` 和产品源码 diff check 全部通过。浏览器验证桌面无横向溢出；价值弹窗 1280x720 下为 1024x525，390x844 下为 358x687 且表格滚动不溢出；`/admin` 恢复原 URL、完整菜单和 `glass-admin.css` 正常加载。
- 本地包：`komari-theme-Glassmorphism-build-e3abeff.zip`，7,606,509 bytes，SHA-256 `7539c1ef6ba8d65391215d04075256e59957e1b3af758832c72841412c17632b`；770 个条目，顶层为 `komari-theme.json`、`preview.png`、`dist/`，包内版本 3.1.6，`dist/admin-app/` 419 个条目且无 PWA/Service Worker 文件。
- 发布完成：提交 `c368669ec10468a026991e21556ee3e34d5c99a0` 已推送 main；Release On Version Bump run `#29420879366`（#54）成功；annotated tag `v3.1.6`、Release target 与 main 均指向该提交。
- 线上资产：`komari-theme-Glassmorphism-build-c368669.zip`，7,615,774 bytes，GitHub digest / 下载后 SHA-256 均为 `c9495a97e754512103fb0bb38a528ea27a31c3e02888cf18b796fd7a6985f3ae`；下载复核版本 3.1.6、770 个条目、419 个后台条目、顶层契约和无 PWA/Service Worker 文件均正确。
- 发布边界：`.claude/` 和 `output/` 未进入发布提交；版本唯一来源保持 `komari-theme.json` 的 3.1.6。

### 2026-07-15 default-theme integration review follow-up

- 正在复核已有 admin-app 路由桥接、PWA 作用域、同步可重复性，以及 v3.1.5 色觉友好 / 访客审计与 Komari PR #602 合并代码的真实契约。
- 已确认 `/admin`、`/terminal`、`/manage/*` 通过独立静态子应用恢复原 URL 的方案可行；公开主题主包不会加载 React 管理端 chunk。
- 已发现并修复：浏览器禁用 sessionStorage 时入口不跳转；桥接架构下官方 `/admin-app/` Service Worker 无法覆盖恢复后的真实路由却可能保留旧后台资源；同步脚本缺少上游 HTML 结构断言。
- 真实后端联调发现 Vite 代理只改 Host、未改 HTTP Origin，Komari 默认来源校验会拒绝本地 RPC；开发代理现统一把 `/api`、`/themes` Origin 设为 `VITE_API_TARGET`，WebSocket 继续使用 `rewriteWsOrigin`。
- 访客审计补强：详情限额改按 UTF-8 字节计算，超限优先保留会话、站点指纹和 WebRTC 摘要；审计面板增加 `visitor_audit_enabled` 管理员开关，复用 `admin:editSettings` 的部分更新契约。

### 2026-07-15 complete default-theme admin integration

- 已核对 Komari `web/public/public.go`：`/admin` 和 `/terminal` 强制使用 embedded defaultTheme，静态文件会在当前主题缺失时回退 embedded defaultTheme。
- 已从官方 `komari-monitor/komari-web` 提交 `ebfbd3e079f8777a746276fe67429b519024f7c7` 完整构建 415 个 PWA 预缓存文件，并同步到 `public/admin-app/`。
- 已加入根入口路由桥接和 admin-app URL 恢复，BrowserRouter 在 `/admin/...`、`/terminal`、`/manage/*` 下保留原路径语义。
- 已加入 Glassmorphism 亮暗色 CSS 覆盖，不改官方 React 功能代码；后台菜单已在浏览器确认包含站点、主题、登录、通知、XtermJS、监控数据库、远程执行、Ping、会话、账户和日志等完整模块。
- 已新增 `bun run sync:admin -- <komari-web-path>`，可从新的官方 checkout 重建并记录来源提交。
- 已为主题 Vite 开发服务器补 `/api`、`/themes` 代理，默认指向 `http://127.0.0.1:25774`，可用 `VITE_API_TARGET` 覆盖。
- 最终校验：`bun run lint` 和 `bun run build` 均通过；生成 `komari-theme-Glassmorphism-build-e3abeff.zip`（7,573,457 bytes、770 个条目），关键管理模块与来源记录均已核对。浏览器已确认 `/admin` 完整菜单和 Glassmorphism 亮暗色覆盖；本地未启动 Komari 后端，因此未进行登录后的 API 写操作验证。

## 上一任务

- 状态：done
- 目标：新增可选的色觉友好配色，提前适配 Komari PR #602 的访客审计上报与日志查看能力，并发布 `v3.1.5`。
- 里程碑：主类 M5 新功能；色觉友好界面属于 M4，访客审计的数据最小化、权限和隐私边界按 M3 执行。
- 范围：主题托管设置、语义色与图表/Ping 色板；`visitor_audit_enabled` 能力检测；公开访客事件上报、站点隔离安全指纹与操作埋点；AuditLogPanel 的 visitor 过滤、解析和结构化展示；版本/README、构建、推送和 GitHub Release 全流程。
- 计划：色觉友好 token/色板 -> 访客审计 RPC/service/composable -> 安全指纹与页面操作埋点 -> 审计面板 visitor 视图 -> lint/build/浏览器验证 -> v3.1.5 版本/说明 -> zip/Actions/Release/线上资产验证。
- 不做：不记录密码、token、Cookie、query value、完整搜索词、WebSSH/剪贴板内容；不上传原始 WebRTC ICE 地址，不调用第三方 STUN，不采集设备 ID、Canvas 或音频指纹；不在核心 `1.2.6` 缺少能力时发送未知 RPC；不改 `package.json.version`，不提交 `.claude/`。

## 执行日志

### 2026-07-15 color-vision-friendly palette / visitor audit preparation

- 参考结论：色觉友好模式不能只换红绿色；需要拉开明度/饱和度，使用朱红、蓝绿、蓝、橙、紫红等安全色，并让重要状态同时具备文字、图标、形状或线型差异。
- 上游状态：Komari PR #602 已于 2026-07-15 合并，head `0c80f0f`、merge commit `5fa59ab`；PR CI run `29389802493` 成功。当前最新正式 Release 仍为 `1.2.6`（2026-07-12），所以主题只能提前适配并通过公开设置字段做能力检测。
- 上游契约：`public:recordVisitorEvent` 只接收 `event/path/route/target/detail`；IP、User-Agent、登录 UUID 和时间由服务端可信记录；`visitor_audit_enabled` 默认 false；每 IP 30 次/分钟、burst 10；`admin:getLogs` 新增 SQL 级 `msg_type` 精确过滤。
- 指纹决策：在核心开关明确启用后，记录随机 session ID、浏览器/系统能力、时区语言、屏幕/硬件摘要、自动化标记和含当前 origin 的 SHA-256 站点隔离指纹；WebRTC 仅使用本地 ICE gathering，保存候选类型/协议/地址类别和站点隔离哈希，不保存原始候选或地址，不调用第三方 STUN。
- 发布目标：功能完成并确认无明显逻辑漏洞后更新唯一版本源和 README 到 `v3.1.5`，执行 lint/build/zip 检查，推送 main 并核验 GitHub Actions、Release 和线上包。
- 已实现：主题设置新增标准 / 色觉友好模式；语义状态色、Ping 分级纹理和多任务图表虚实线同步切换，亮暗色关键前景组合对比度均高于 4.5:1。
- 已实现：按 PR #602 契约接入 `visitor_audit_enabled`、`public:recordVisitorEvent` 和 `admin:getLogs.msg_type`；旧核心缺少能力字段时不发送新 RPC。
- 已实现：页面、节点、分组、搜索长度、快捷筛选、视图、后台入口、工具、快照与审计导出等事件；首次页面事件附带站点隔离会话、稳定浏览器指纹及语言、时区、屏幕、硬件、自动化、WebGL、WebRTC 哈希摘要。
- 已实现：AuditLogPanel 新增访客视图和结构化 IP / UA / 身份 / 会话 / 指纹展示；JSON / CSV 导出拉取当前服务端筛选的完整分页数据，包含去重/旧核心分页保护，CSV 沿用公式注入防护和 UTF-8 BOM。
- 安全复核：不提交查询值、完整搜索词、密码、Cookie/Token、命令、剪贴板、原始 ICE candidate 或原始局域网地址；WebRTC 不使用第三方 STUN，只保存站点隔离哈希与候选类型摘要。
- 本地验证：`bun run lint` 通过；`bun run build`（含 `vue-tsc --build`）通过；访客消息解析 / Chrome Windows UA 样例通过；色觉语义前景对比度为 5.19-8.21:1；桌面浏览器渲染无新增重叠。移动窄视口自动化被浏览器安全策略阻止，已改做响应式模板与生产 CSS 静态复核。
- 最终本地验证：rebase 到远端 `2183a48` 后，`bun run lint`、`bun run build`、`git diff --check` 再次通过；发布提交 `af32f25`；本地包 `komari-theme-Glassmorphism-build-af32f25.zip` 大小 5,114,116 bytes，SHA-256 `098c3882b5b4b576912e23157f8ca59ddc771f900c152882c651336db2adb28c`，顶层为 `komari-theme.json`、`preview.png`、`dist/`，包内版本 `3.1.5`，345 个 dist entries。
- 远端验证：发布提交 `af32f25f90f9e9c5b52e7b8885a2c0787b827f0c` 已推送 `main`；GitHub Actions `Release On Version Bump` run `#29397249147`（#52）成功；tag `v3.1.5` 与正式 Release 均指向该完整提交。
- 线上资产：`komari-theme-Glassmorphism-build-af32f25.zip`，大小 5,129,174 bytes，GitHub digest / 下载后 SHA-256 均为 `45e71e7d82bb6caf8d36625bbee8e069b71270eba5f9f475086560b7c6b41d9d`；下载复核顶层结构、包内 `3.1.5`、预览图和 345 个 dist entries 均符合发布契约。

### 2026-07-14 v3.1.4 Issue #18 per-bucket Ping loss fix

- Issue 判断：应修复。Komari 1.2.6 的 `public:queryMetrics` 已返回 `ping.loss` 分时序列，当前主题只查询 `ping.latency`，再把 `avgLoss` 覆盖到每个历史格，导致所有格子同值同色。
- 修复边界：周期汇总继续采用 `public:getPingMetricStats` 的按样本加权平均；历史时间格改为消费 `ping.loss`，按时间桶与 point `count` 加权，ratio 转百分比；`null` 保持空桶；旧 records 负值丢包逻辑保持不变。
- 已实现：Metric Store 查询同时请求 `ping.latency_ms` / `ping.loss`；按任务与时间桶聚合 loss point，使用 `count` 加权；丢包序列覆盖不完整时回退 legacy records；本地 Ping 缓存版本升到 8，避免旧错误结果继续命中。
- 发布准备：唯一版本源更新为 `3.1.4`，README 当前版本、专项说明与更新日志已同步；`.claude/` 继续排除。`gh` 登录 token 已失效，本次公开 Issue / Actions / Release 核验改用 GitHub REST，git 推送凭据正常。
- 本地验证：`bun run lint`、`bun run build` 和 `git diff --check` 均通过；构建仅有既有 `@vueuse/core` PURE 注释与 `globe` 大 chunk 警告。
- 本地资产：`komari-theme-Glassmorphism-build-4f37416.zip`，大小 5,105,926 bytes，SHA-256 `3b9510345ad79319d70311ed8a3c03a79cf4159cbf5b0ef48c3f04623798df74`；顶层为 `komari-theme.json`、`preview.png`、`dist/`，包内版本为 `3.1.4`。
- 远端验证：发布提交 `91c9b06` 已推送 `main`；GitHub Actions `Release On Version Bump` run `#29312369165`（#49）成功；tag `v3.1.4` 指向完整提交 `91c9b06fc5c4b5ee2636dc18779861186806abd7`；Release 为正式发布（非 draft / prerelease）；Issue #18 已由 `Fixes #18` 自动关闭为 completed。
- 线上资产：`komari-theme-Glassmorphism-build-91c9b06.zip`，大小 5,114,852 bytes，SHA-256 `f8b4c9b6f61cc66d755d7a612357d16d1d2774f9494b9b0c3ce87e572ee5da9b`；下载复核顶层结构为 `komari-theme.json`、`preview.png`、`dist/`（344 个 dist entries），包内版本为 `3.1.4`。

### 2026-07-14 v3.1.3 reduced-motion route transition fix

- 线上复现：`tz.yisaw.com` 开启减弱过渡动画时，点击节点后 URL 已进入详情但 `<main>` 为空；`km.ydao.de` 使用同一构建且未触发配置时，详情和返回首页均正常。
- 根因：路由 `Transition` 在 `css=false` 时仍使用 `mode="out-in"`；同步离场的 `afterLeave` 与 `KeepAlive` 更新重入后，Vue 访问空 DOM 锚点并抛出 `nextSibling` / `parentNode`。
- 修复：减弱动画时路由 Transition 改用默认并行模式；正常动画继续使用 `out-in`，首页缓存策略保持不变。
- 发布准备：唯一版本源更新为 `3.1.3`，README 当前版本、专项说明和更新日志已同步；`.claude/` 继续排除。
- 本地验证：`bun run lint`、`bun run build` 和 `git diff --check` 均通过；构建仅有既有 `@vueuse/core` PURE 注释与 `globe` 大 chunk 警告。
- 本地资产：`komari-theme-Glassmorphism-build-4716f15.zip`，大小 5,105,653 bytes，SHA-256 `e202ce28508a3dc0c9b1a4a1e8c5c7706dd1f281ef72d8f4d73d429b891bac11`；顶层为 `komari-theme.json`、`preview.png`、`dist/`，包内版本为 `3.1.3`。
- 远端验证：提交 `4f37416` 已推送到 `main`；GitHub Actions `Release On Version Bump` run `#29311122789` 成功；tag `v3.1.3` 已生成；Release 为正式发布（非 draft / prerelease）。
- 线上资产：`komari-theme-Glassmorphism-build-4f37416.zip`，大小 5,120,783 bytes，SHA-256 `f4d5f1be0c769ffc5372ab6a9b780042768f82529827b7222a843ef642605bee`；下载后复核顶层结构为 `komari-theme.json`、`preview.png`、`dist/`，包内版本为 `3.1.3`。

### 2026-07-14 post-release README restructure

- 按用户提供的发帖结构重写 README：突出 `v3.1.2` 启动自愈，并重新组织详情指标、自定义、Metric / Ping、首页、高级工具、架构、安全、WebKit / Firefox 兼容和安装说明。
- 事实边界：普通 Load / Ping 历史继续公开；敏感高级工具、Geo、导出和磁盘预测保持登录校验；Safari 15.4 是构建基础边界，Tailwind CSS v4 完整视觉基线仍为 Safari 16.4+。
- 本轮仅计划提交 `README.md` 与 `AICACHE.md`；主题版本继续保持 `3.1.2`。
- 验证：`bun run lint` 通过；`git diff --check` 通过；lint 后差异仍只有两个 Markdown 文件，`komari-theme.json` 和运行时代码均未修改。

### 2026-07-14 startup single-point-of-failure fix

- 已确认根因：`InitManager.init()` 串行等待 `healthCheck()`，首次 Ping 失败会阻止 public settings、用户、节点数据和实时连接启动；`connectionError` 仅在首页渲染，详情路由缺少故障反馈。
- 设计：健康检查使用已有 5 秒配置并增加 3 次递增间隔重试；四个启动请求通过 `Promise.allSettled()` 隔离；节点首拉失败仍启动轮询自动恢复；显式重试复用现有 manager，避免重复定时器和 WebSocket 监听。
- 已实现：RPC Ping 支持 AbortSignal；健康检查超时会取消底层请求；初始化改为独立并行；全局 app shell 显示连接错误和重试状态，首页重复提示已移除。
- 首轮验证：`bun run lint`、`bun run build` 通过，生成 `komari-theme-Glassmorphism-build-bb52e94.zip`；仅有既有 `@vueuse/core` PURE 注释提示和 `globe` chunk 体积警告。
- 浏览器验证：首页和直接进入 `/instance/missing-node` 都显示全局连接错误；1270px 和 390x844 无横向溢出或按钮/文案重叠；重试按钮会进入禁用的“重试中”状态，失败后恢复。
- 快速复查：未发现新的发布阻断 bug；Firefox 毛玻璃回退、列表虚拟化、共享 Ping/负载缓存已存在。后续高收益专项候选为卡片模式 30+ 节点全量挂载，以及约 2.98 MB 地球纹理和 1.98 MB `globe` chunk 的传输/解析成本。
- 发布准备：`komari-theme.json.version` 已更新为 `3.1.2`，README 当前版本与更新日志已同步。
- 最终验证：版本更新后 `bun run lint`、`bun run build` 通过，生成 `komari-theme-Glassmorphism-build-bb52e94.zip`；zip 顶层契约为 `komari-theme.json`、`preview.png`、`dist/`，包内版本为 `3.1.2`。构建仍仅有既有 `@vueuse/core` PURE 注释和 `globe` 大 chunk 警告。
- 已发布：提交 `aed8626` 已推送到 `main`；GitHub Actions `Release On Version Bump` run `#29305550352` 成功；tag `v3.1.2` 指向该提交，Release 为正式发布（非 draft / prerelease）。
- 线上资产：`komari-theme-Glassmorphism-build-aed8626.zip`，大小 5,114,600 bytes，SHA-256 `71155874add7df49ee0cbe14b403f5d959767e754ffbe21b0a8259c6bf7014d9`；下载后复核顶层结构与包内 `3.1.2` 版本均符合契约。

### 2026-07-14 v3.1.1 release preparation

- 已将唯一版本源 `komari-theme.json.version` 更新为 `3.1.1`，README 当前版本与更新日志同步。
- 发布前 `bun run lint`、`bun run build` 和 zip 清单检查通过；本地 zip 内版本为 `3.1.1`，顶层包含 `komari-theme.json`、`preview.png`、`dist/`。
- `.claude/` 为本机配置，继续排除；远端 `91f46ac` 仅修改 README 赞助名单，将在发布提交后 rebase 合入。

### 2026-07-14 v3.1.0 background/list/Ping regression quick fix

- 修复默认背景被 `body` 实色层遮挡：页面可见背景统一由 `Background.vue` 负责，`html` 继续提供无 JS/加载失败时的底色。
- 列表模式小 Ping 条移除每行 40 个绝对定位气泡，改用原生提示，避免气泡压住运行时间，同时降低列表 DOM/hover 合成开销。
- 首页快捷控制计数改为直接计数；月成本、流量、上下行、峰值等只显示数量的入口不再每轮实时更新重复排序全部节点。
- 普通节点 Ping 延迟/丢包恢复公开访问，移除 `historyMetrics` 登录权限；高级工具、Geo、导出、审计和磁盘预测权限保持不变，相关开发文档已同步。
- Ping 详情请求增加序列保护，快速切换时间范围/节点时旧请求不再覆盖新结果；时间锚点合并从遍历全部历史锚点改为只回看最近候选，避免大样本下退化为 O(n²)。
- 验证：`bun run lint` 通过；`bun run build` 通过并生成 `komari-theme-Glassmorphism-build-771c363.zip`。仍有既有 `@vueuse/core` PURE 注释提示和 `globe` chunk 体积警告。
- 暂不扩展：按用户要求放弃全量审查；卡片模式全量挂载、首页小 Ping 按节点请求仍可作为后续性能优化项。

### 2026-07-14 v3.1.0 release

- 已将 `komari-theme.json.version` 更新为 `3.1.0`；README 补齐 25 个 definition、12 个图表族、详情预设、Ping 自定义时间与丢包修复，并新增 v3.1.0 更新日志。
- `.claude/settings.local.json` 为本机配置，明确排除在发布提交之外；其余当前产品代码、适配文档和新增图表组件纳入本次 release。
- 发布前 `bun run lint`、`bun run build` 与 zip 清单检查通过；本地包内版本为 `3.1.0`，顶层包含 `komari-theme.json`、`preview.png`、`dist/`。构建仍只有既有 `@vueuse/core` PURE 注释和 `globe` chunk 体积警告。
- 已提交并推送 `main`：commit `14dac71`。GitHub Actions `Release On Version Bump` run `#42`（ID `29268363931`）成功；tag `v3.1.0` 指向该提交，Release 已发布，资产为 `komari-theme-Glassmorphism-build-14dac71.zip`（5,120,319 bytes，SHA-256 `6ecfccecf9e434da554ccea794123247c48646e9b64ba94910e697888843115c`）。

### 2026-07-14 official detail metric dashboard expansion

- 已实测公开节点详情页 `mt.vpnmiao.com`：官方默认将 CPU+Load、RAM+Swap、实时网络+累计流量、Ping 多任务合并成卡，支持 S/M/L、增删指标和拖拽；新增菜单来自 `public:listMetricDefinitions`。
- 已核对 RPC 文档与 Komari 1.2.6 `c828653`：后端固定创建 25 个定义；GPU 设备序列带 `device_index/device_name`，Ping 序列带 `task_id`；`ping.loss` 写入值为 0/1，聚合后按比例显示；`public:queryMetrics` 的空桶是 `null`。
- 设计决策：主题设置提供 12 个稳定指标族和多套预设，覆盖全部官方指标但避免 25 张单指标碎卡；保留原有独立 PingChart，LoadChart 中的 Ping 卡为可选紧凑总览。
- 已完成 25 个 definition 到 12 个图表族的查询、展示和预设映射；统一图标头部，并校验 Iconify 图标资源。GPU、显存、温度、流量、Ping 延迟和 Ping 丢包按 definition/数据存在性自动显示。
- 按用户反馈将详情概览恢复为宽屏 4 列、中屏 3 列、移动端 2 列，预设调整为 8/12/16 张；独立 Ping 图新增精确起止时间，新 metric API 传 `start/end`，无有效时序点时回落 legacy 并按保留窗口回溯后裁剪，legacy 仍以 `value < 0` 识别丢包。
- 丢包兼容补强：PingChart 只有 latency series 对应任务同时具备非 approximate loss stats 才采用新路径，否则整体回落旧 records；首页 Ping 汇总不再过滤 100% 丢包任务，metric loss 按 `total` 加权，loss stats 缺失/估算时回落 legacy。旧接口的负值哨兵判断保持不变。

### 2026-07-13 Komari 1.2.6 configurable card adaptation

- 已核对官方 `komari-web` `radix` 分支提交 `ebfbd3e` 与 Komari 1.2.6 tag 提交 `c828653`。官方公开页仍为首页与节点详情两页；首页有当前时间、在线节点、地区、总流量、实时网速 5 类状态卡，详情页使用 Metric Store 展示 CPU、内存、硬盘、网络、GPU、连接、进程与 Ping 指标。
- 差集结论：本地主题已覆盖并扩展大部分公开监控能力，但详情概览和图表排序缺少直观配置；本轮以 `/instance/` 为重点，并补齐官方时间卡与新版探针 GPU 总览。
- `InstanceDetail.vue` 已接入 18 类可配置概览卡：价格/月成本/到期/剩余价值、CPU/GPU/内存/Swap/磁盘、负载/温度/进程/连接/运行时间、上下行速率/总流量/流量额度。默认财务预设保持原有视觉行为。
- `app.ts` 已新增详情概览和图表预设及配置兼容。图表提供 all/compact/resource/network/gpu/custom 公开预设，并继续兼容旧独立卡位、advanced 值和 `chartDashboardTemplate` JSON/逗号列表。
- `komari-theme.json` 已把设置重组到 8 个编号区段；后续按用户反馈移除 23 个逐项下拉卡位，收缩为 48 个唯一设置 key，并压短易溢出的 help。主页、详情概览、详情图表分别使用一个英文逗号 keys 字段；打包预览字段为发布契约要求的 `preview.png`。
- `index.html`、`main.css` 和 `vite.config.ts` 已增加旧 WebKit 兼容边界：构建目标 Safari 15.4，缺少 `oklch` / `color-mix` 时切换 sRGB token 并关闭毛玻璃，无 ESM 时显示可读升级提示。Tailwind CSS v4 的正式浏览器基线仍是 Safari 16.4+。
- Ping 诊断结论：legacy `value < 0` 是 Komari 1.2.6 的历史丢包哨兵，不能直接删除；后续应修复 100% 丢包任务被过滤、不同样本量按任务等权平均，以及新接口只有延迟序列但缺少 loss stats 时未整体 fallback 的低报风险。本轮未改 Ping 语义。
- 设置紧凑化 follow-up：5 个 key 列表改为 `richtext` 多行输入，`parseKeyList()` 统一接受英文/中文逗号、分号、空格和换行；help 补全每个英文 key 的中文含义，并用映射间空格保证官方后台可换行。详情概览从桌面 4 列改为 3 列，财务/状态/网络/GPU 预设各 6 卡、资源 9 卡、综合 12 卡；同时修复自定义头部白名单遗漏 `monthlyCost`。
- 安全边界：后台 Metric Store 配置/迁移、数据库维护、通知、Agent 管理、命令执行和终端继续使用 Komari 官方后台，不进入公开主题路由。

### 2026-07-13 light-mode flash and home reveal follow-up

- 开始按用户“亮色模式还是太闪，刷新和显示主页没有过渡”的反馈做第二轮视觉修复：本轮不改启动数据流，重点降低 light mode 首屏/token/loading/默认背景亮度，并软化 loading -> app shell -> HomeView 的显示过渡。
- 已更新 `src/styles/main.css`、`src/utils/glassTheme.ts`、`src/stores/app.ts`、`komari-theme.json`：亮色根背景、卡片/弹层 token、默认毛玻璃 preset、自定义默认色和 Firefox fallback 均从纯白/高白度改成灰蓝雾面，降低浏览器第一帧和 fallback 合成时的亮度。
- 已更新 `src/components/Background.vue`：自定义图片预加载期间继续显示柔和默认背景兜底；默认亮色背景与视频 loading/fallback 改为低亮灰蓝渐变，并降低 emerald/lime spotlight 亮度。
- 已更新 `src/components/LoadingCover.vue`、`src/components/Provider.vue`、`src/App.vue`、`src/views/HomeView.vue`：LoadingCover 亮色普通遮罩改为低亮渐变；body 仅在存在当前背景 URL 时透明；loading/app shell/router 过渡改为更柔和的 200–300ms opacity/微位移，router transition 遵守 `disablePageAnimation`；首页容器增加轻量 reveal 且 reduced-motion 下关闭。

### 2026-07-13 home refresh flash fix

- 开始修复用户反馈的首页强闪屏：参考 vlongx 主题的稳定首屏/非白色加载策略，采用低风险首屏主题预设 + token 化加载遮罩 + 密集节点卡片禁用首轮动画方案。
- 决策：先解决高置信视觉闪屏根因，不引入卡片虚拟滚动或 Ping 聚合重构，避免扩大数据层和布局风险。
- 已更新 `index.html`：在首屏前按本机 `themeMode` 或北京日夜 fallback 预设 `.dark` 和 `colorScheme`，异常时默认暗色，避免夜间白屏。
- 已更新 `src/styles/main.css` 与 `src/components/LoadingCover.vue`：初始文档背景使用 token；加载遮罩使用 `--color-background` + `color-mix` 半透明背景，并保留纯 token fallback。
- 修复用户反馈的自定义背景图片失效：根因是 `#app` 被首屏防闪屏补丁设置为不透明 `background-color: var(--color-background)`，而 `Background.vue` 的 fixed 背景层在 `z-index: -1`，因此被 `#app` 自身背景盖住；已移除 `#app` 背景，仅保留 `body` 初始 token 背景。
- 继续修复刷新时仍能看到白雾 Loading 的反馈：`LoadingCover.vue` 现在读取归一化背景配置，自定义背景启用且当前模式有背景 URL 时，加载覆盖层不再铺 `color-mix(... 82%)` 半透明背景，也不再显示 `Loading...` 文案，只保留轻量圆形指示器，避免把背景洗白。随后进一步移除 `App.vue` LoadingCover 外层 Transition 的 `backdrop-blur-sm` enter/leave class，并去掉自定义背景加载指示器自身的小块 `backdrop-filter`；最新调整将自定义背景加载遮罩改为极低透明深色层、普通加载层改为低对比灰蓝/深色层，并让图片背景预加载阶段不显示纯白 token 占位，避免任何 loading 阶段继续出现高亮白雾。
- 已更新 `src/constants/ui.ts`、`src/views/HomeView.vue`、`src/components/NodeCard.vue`：30+ 卡片节点禁用首轮卡片切换 CSS 动画，60+ 卡片节点禁用在线状态扩散环，普通节点数量仍保留原动画。
- 修复首页延迟/丢包与详情页不一致：`useNodePingStats.ts` 的 metric series 路径此前把 `queryMetrics(fill_empty: true)` 返回的 `null` 点转成 `-1` 并计入丢包，导致首页卡片显示明显丢包；详情页图表会把同类 null 当断点，所以看不到丢包。现改为 metric series 只用于有效延迟点，丢包摘要优先读取 `public:getPingMetricStats` 的非估算 `loss`，`loss_approximate` 时不参与首页平均丢包；详情页 `PingChart.vue` 也同步忽略 metric null 点。
- 首页小卡延迟/丢包采样显示按用户反馈恢复为等高整条颜色分级，不再按高度变化。旧接口 fallback 仍保留：只有 `public:getPingMetricStats` / `public:queryMetrics` 不可用或无数据时，才走 legacy `common:getRecords`，并继续按旧接口的 `value < 0` 记录计算丢包。

### 2026-07-13 chunk/request pressure follow-up

- 开始修复历史详情页加载时请求爆炸放大因素：将 v3 共享服务/工具模块纳入 Vite manual chunk，并让 LoadChart legacy fallback 与详情页 24h 统计使用同一个 `LOAD_RECORD_MAX_COUNT` cache/request 维度。
- 已更新 `vite.config.ts`：新增 `v3-services` manual chunk，合并 history/metrics/request/cache service 与 osImageHelper/metricSeries/useNodePingDisplay 等跨异步组件共享模块，减少 Rollup 自动拆出的零散共享 chunk。
- 已更新 `src/components/LoadChart.vue`：legacy fallback 调用 `loadNodeLoadRecords(props.uuid, hours, LOAD_RECORD_MAX_COUNT)`，与 `InstanceDetail.vue` 的 24h 峰值统计保持同一 `maxCount` 维度以复用 cache/request key。
- 发布前同步 `origin/main`（包含 README 更新提交 `94691f1`），并将 `komari-theme.json.version` 从 `3.0.2` bump 到 `3.0.3`，避免已有 `v3.0.2` tag 导致 release workflow 跳过。

### 2026-07-13 v3.0.0 frontend follow-up

- 开始补完用户复查指出的 4 项：物理核心参与每核成本并展示到 NodeCard、LoadChart 增加 start/end 自定义时间范围、metric definitions 加 TTL 结果缓存、修复 `SharedCache.retain()` 覆盖后 release 引用计数孤儿化。
- 约束：保持 v3.0.0 版本号和发布结构不变；自定义范围在 metric API 可用时精确传 `start` / `end`，旧后端 fallback 只做近 N 小时近似。
- 已实现 AuditLogPanel：`admin:getLogs` RPC 类型和方法、`audit.service.ts` request key 去重、`auditLog` 权限 key、首页第 5 个高级工具入口、只读表格和分页；`limit` / `page` 调用时按官方文档转为 string。
- 已实现磁盘预测体验补充：`prediction.service.ts` 新增 `analyzeDiskPrediction()` 返回不可用原因，NodeCard / HealthSummaryPanel 在样本不足或历史不足 2 天时显示“数据积累中”；NodeCard 调 `useNodeLoadStats` 时显式传 `LOAD_RECORD_MAX_COUNT`，避免未传 `maxCount` 走后端默认配额时体验不稳定。

### 2026-07-13 official metric-store feature port

- 开始实施官方 komari-web 高价值功能移植第一批：新增 metric series 工具、metrics service、Ping metric 优先路径与节点 `message` 提示；保持旧版 `common:getRecords` fallback，不改发布结构和版本。
- 已新增 `src/utils/metricSeries.ts` 与 `src/services/metrics.service.ts`，封装 metric tags/series 拆分、Ping task/stat helper、EWMA 平滑工具，以及 `public:listMetricDefinitions` / `public:queryMetrics` / `public:getPingMetricStats` / `public:getPublicPingTasks` 服务层请求。
- 已改 `src/composables/useNodePingStats.ts` 与 `src/components/PingChart.vue`：优先并发尝试 Ping metric stats 和 metric series；新接口失败或空数据时回退 legacy Ping records；Ping 图表信息卡补充 stddev、valid、loss approximate 等官方统计字段。
- 已改 `src/components/NodeCard.vue` 与 `src/components/NodeList.vue`：节点名旁展示 `message` warning 图标，tooltip 纯文本/换行显示 message 与 `status_updated_at`，不使用 `v-html`。
- 已运行 `bun run lint` 与 `bun run build`，均通过；构建生成 `dist/` 和 `komari-theme-Glassmorphism-build-881385d.zip`。
- 继续按用户“全部上马”要求实施剩余官方功能：LoadChart 历史模式优先 metric store、GPU detail/per-device metric 图表、`chartDashboardTemplate` 托管配置读取与布局排序。
- 已改 `src/components/LoadChart.vue`：非实时历史数据优先通过 `public:listMetricDefinitions` 过滤可用指标，再调用 `public:queryMetrics` 查询 `cpu.usage`、`load.average`、memory/swap/disk/net/connections/process/GPU 等指标并转换为当前 ECharts 数据；无定义、无数据或失败时回退 `loadNodeLoadRecords()` legacy 路径。实时模式仍保留 `common:getNodeRecentStatus`。
- 已补 GPU 兼容：`src/utils/rpc.ts` 增加 live/history GPU detail 类型；LoadChart 支持 `gpu.usage`、`gpu.device.usage`、`gpu.memory.used`、`gpu.memory.total`、`gpu.temperature`，按 `device_name` / `device_index` 汇总 tooltip，并在存在 GPU 数据时显示 GPU 卡片。
- 已接入 `chartDashboardTemplate`：`komari-theme.json` 增加托管配置项；`src/stores/app.ts` 安全解析 JSON / 逗号列表并暴露 `chartDashboardTemplate`；LoadChart 按 cards 顺序渲染 cpu/memory/disk/network/gpu/connections/process，非法配置自动回默认。
- 全量移植验证：第一次 `bun run lint && bun run build` 因 LoadChart `chartData` 在 `hasGpuData` 前置引用触发 `ts/no-use-before-define` 失败；移动 computed 后第二次 build 因 `parseChartDashboardTemplate` 局部变量类型推断为窄类型失败；显式标注 `let value: unknown` 后重跑 `bun run lint && bun run build` 通过。
- 按用户要求压缩主题设置：`glassCustomColors` 合并原 10 个自定义颜色字段，help 文案列出可用 key；`app.ts` 支持新 JSON 配置并兼容旧字段。按用户补充要求增加 `gpuChartEnabled` 开关，默认关闭，LoadChart 只有开关开启且有 GPU 数据才显示 GPU 卡片。

### 2026-07-12 Komari 1.2.x compatibility adaptation

- 已调研官方 `komari.wiki` / `komari-document.pages.dev` 的 RPC、API、theme、agent 文档，以及 `komari-monitor/komari`、`komari-web`、`komari-agent`、`komari-document` 官方仓库/release。
- 决策：主题打包结构保持 `komari-theme.json` + `preview.png` + `dist/` 不变；适配重点放在数据层兼容。
- 开始实施第一批兼容补丁：RPC 参数/类型、历史 records 返回形态、新探针字段、public RPC 方法壳。
- 已完成第一批兼容补丁：`src/utils/rpc.ts` 新增 Komari 1.2.x public RPC/metric 类型与方法壳，并让 `common:getRecords` 同时发送 `maxCount` 与 `max_count`；`src/services/history.service.ts` 兼容 records array/map 返回；`src/utils/api.ts`、`src/stores/nodes.ts`、`src/views/InstanceDetail.vue` 补充新探针字段与物理核心展示。
- 验证中首次 `bun run build` 因 `MetricQueryParams` / `PingMetricStatsParams` 缺少 index signature 导致 type-check 失败；已修复后重跑通过。
- 按用户要求只参考官方 `komari-monitor/komari-web`（radix 分支），不再参考未适配的社区主题；已在临时目录只读查看官方实现。官方主题仍大量使用 `common:getNodes` / `common:getNodesLatestStatus`，但新图表/Ping 已转向 `public:listMetricDefinitions`、`public:queryMetrics`、`public:getPingMetricStats`、`public:getPublicPingTasks`。

### 2026-07-12 v3.0 stability refactor

- 已完成只读探索和计划审批；开始按计划实施网络层、缓存层、组件算法、导出与 CSV 安全重构。
- 已核对当前实现：网络层 timeout / abort 清理、RequestManager `try...finally`、Promise cache 失效清理、Provider metadata 模块级共享缓存、拓扑 Map 索引、虚拟列表固定行高和负载采样 0 条 warn 已基本落地。
- 收尾修复 `src/utils/csv.ts`：公式注入检测正则显式覆盖前导空白、BOM、NBSP 与 `= + - @ |`。
- 收尾修复 `src/services/snapshot.service.ts` 与 `src/components/SnapshotExportPanel.vue`：新增异步 JSON 构建流程，按节点分片序列化并让出主线程，避免导出时一次性 `map + JSON.stringify` 大对象。
- 收尾补充 `src/stores/nodes.ts` 注释：节点对象本身必须保持响应式，复杂静态元数据后续应字段级 `markRaw` 或放入共享缓存，避免破坏实时指标刷新。
- 说明：此前 `AICACHE.md` 只写入任务开始状态，未继续写入实现/验证/交接；它不是自动记忆文件，必须由 agent 显式编辑。

## 验证记录

- 2026-07-14 v3.1.4 Issue #18 release：`bun run lint`、`bun run build`、`git diff --check` 通过；发布提交 `91c9b06` 已推送 `main`，Actions run `#29312369165`（#49）成功，tag / Release target 均为完整提交 `91c9b06fc5c4b5ee2636dc18779861186806abd7`，Issue #18 已关闭。线上 zip `komari-theme-Glassmorphism-build-91c9b06.zip` 大小 5,114,852 bytes，SHA-256 `f8b4c9b6f61cc66d755d7a612357d16d1d2774f9494b9b0c3ce87e572ee5da9b`，下载复核顶层结构 `komari-theme.json`、`preview.png`、`dist/`，包内版本 `3.1.4`。构建仍只有既有 `@vueuse/core` PURE 注释与 `globe` 大 chunk 警告。
- 2026-07-14 v3.1.3 release：发布提交 `4f37416` 已推送 `main`；GitHub Actions run `#29311122789` 成功。Release `v3.1.3` 为正式发布（非 draft / prerelease），target 为完整提交 `4f3741692bd81141ed542614d5b31a01ff0dc0fc`，zip 资产 `komari-theme-Glassmorphism-build-4f37416.zip` 上传状态为 `uploaded`。下载复核：大小 5,120,783 bytes，SHA-256 `f4d5f1be0c769ffc5372ab6a9b780042768f82529827b7222a843ef642605bee`，顶层结构 `komari-theme.json`、`preview.png`、`dist/`，包内版本 `3.1.3`。
- 2026-07-14 v3.1.0 release：发布提交 `14dac71` 已推送 `main`；GitHub Actions run `#42` 成功。Release `v3.1.0` 为正式发布（非 draft / prerelease），target 为完整提交 `14dac711d3e1ad1e7963c6dc2609ab6d1921f82d`，zip 资产上传状态为 `uploaded`。
- 2026-07-14 official detail metric dashboard / Ping custom range：`komari-theme.json` 解析通过，共 56 个表单行、48 个唯一 key、无重复；12 个图表族使用的 Tabler 图标均存在。最终 `bun run lint` 与 `bun run build` 通过，生成 `dist/` 和 `komari-theme-Glassmorphism-build-4e9ae53.zip`，zip 顶层保持 `komari-theme.json`、`preview.png`、`dist/`。本地 `http://127.0.0.1:5174/` 页面非空且桌面布局无重叠；本地无 Komari 后端，未完成真实节点数据下的移动端详情页、新旧 Ping 接口和 GPU 多设备实测。构建仍只有既有 `@vueuse/core` PURE 注释与 `globe` chunk 体积警告。
- 2026-07-13 managed settings compact keys follow-up：`komari-theme.json` 经 PowerShell `ConvertFrom-Json` 解析通过，共 56 个表单行、48 个唯一 key、0 个 Slot 字段、5 个 `richtext` 多行 keys 字段。混合分隔样例 `cpu,memory\ndisk process；gpu` 按顺序解析为 5 个 key。`bun run lint` 通过；`bun run build` 内含 `vue-tsc --build` 并通过，生成 `dist/` 与 `komari-theme-Glassmorphism-build-4e9ae53.zip`。构建仍只有既有 `@vueuse/core` PURE 注释和 `globe` 大 chunk 警告。
- 2026-07-13 Komari 1.2.6 detail/settings/iOS adaptation：`bun run lint` 通过；`bun run build` 通过，生成 `dist/` 与 `komari-theme-Glassmorphism-build-4e9ae53.zip`。Zip 顶层已核对为 `komari-theme.json`、`preview.png`、`dist/`；清单 71 个设置 key 无重复。390x844 浏览器检查无横向溢出，中文与旧浏览器提示可读。因本地无 Komari 后端，尚未验证真实 1.2.6 数据、后台保存流程和 iOS 15.4 真机；构建仍仅有既有 `@vueuse/core` PURE 注释和 `globe` 大 chunk 警告。
- 2026-07-13 light-mode flash and home reveal follow-up：`bun run lint` 通过；`bun run build` 通过，生成 `dist/` 与 `komari-theme-Glassmorphism-build-4e9ae53.zip`。构建仍有既有 `@vueuse/core` PURE 注释警告与 `globe` chunk 超过 600 kB 警告。本轮将 light mode 根背景、默认毛玻璃 preset、自定义默认色、Firefox fallback、默认背景和 loading/video fallback 全部压到低亮灰蓝雾面；自定义图片预加载阶段保留默认背景兜底；LoadingCover/app shell/router/HomeView 增加更柔和过渡并遵守 `disablePageAnimation` / reduced-motion。未做真实浏览器硬刷新录屏或真实 Komari 自定义背景验证，需在真实环境中确认视觉效果。
- 2026-07-13 home refresh flash fix / custom background / ping follow-up：`bun run lint` 通过；`bun run build` 通过，生成 `dist/` 与 `komari-theme-Glassmorphism-build-4e9ae53.zip`。构建仍有既有 `@vueuse/core` PURE 注释警告与 `globe` chunk 超过 600 kB 警告。已修复 `#app` 不透明背景覆盖自定义背景的问题；已调整自定义背景启用时的 `LoadingCover`，刷新加载阶段不再覆盖白雾遮罩/Loading 文案，仅保留轻量圆形指示器，并移除外层 Transition blur；图片背景预加载阶段不再显示纯白 token 占位，普通 loading 改低对比灰蓝/深色。已修复首页 Ping metric null 点误计丢包；首页小卡延迟/丢包采样条按用户反馈恢复为等高整条颜色分级；legacy `common:getRecords` fallback 仍保留按 `value < 0` 计算丢包。未做真实浏览器夜间首屏录屏、真实 Komari 自定义背景验证或新旧后端 Ping 实测，需在真实环境中确认视觉效果与 Ping 摘要。
- 2026-07-13 v3.0.1 release refresh：README 已重写为更短、更有设计感的功能介绍，致谢已收束到文末；`komari-theme.json.version` 已更新为 `3.0.1`，准备按发布契约推送 main 触发新 release。
- `bun run lint`：通过；本脚本带 `--fix`，运行后已继续执行 build 验证。
- `bun run build`：首次失败，原因是 `src/utils/rpc.ts` 的 `MetricQueryParams` / `PingMetricStatsParams` 传给 RPC `call()` 时缺少 `Record<string, unknown>` index signature；已补充 `[key: string]: unknown` 后重跑通过。
- `bun run build`：最终通过；生成 `dist/` 与 `komari-theme-Glassmorphism-build-881385d.zip`。构建中仍有既有 Rollup 提示：`@vueuse/core` PURE 注释位置警告，以及 `globe` chunk 超过 600 kB 的体积警告。
- CSV 攻击样例检查：通过。对 `"\t=cmd|' /C calc'!\r\nFakeNode,10.0.0.1,Admin"` 调用 `escapeCsvCell()` 输出为单个加引号 CSV cell，内容前置半角单引号并保留 CRLF 在 RFC 4180 引号包裹内。
- 2026-07-13 official metric-store feature port：`bun run lint` 通过；`bun run build` 通过，生成 `dist/` 与 `komari-theme-Glassmorphism-build-881385d.zip`。构建中仍有既有 Rollup 提示：`@vueuse/core` PURE 注释位置警告，以及 `globe` chunk 超过 600 kB 的体积警告。
- 2026-07-13 full official feature port：首次 `bun run lint && bun run build` lint 失败（LoadChart `chartData` 前置引用）；第二次 build 失败（`parseChartDashboardTemplate` 局部变量类型过窄）；均已修复。最终 `bun run lint && bun run build` 通过，生成 `dist/` 与 `komari-theme-Glassmorphism-build-881385d.zip`。构建仍有既有 `@vueuse/core` PURE 注释警告与 `globe` chunk 超过 600 kB 警告。
- 2026-07-13 settings compaction / GPU switch：`bun run lint && bun run build` 通过，生成 `dist/` 与 `komari-theme-Glassmorphism-build-881385d.zip`。构建仍有既有 `@vueuse/core` PURE 注释警告与 `globe` chunk 超过 600 kB 警告。
- 2026-07-13 v3.0.0 release prep：README 已删除预览图并重写为实用功能介绍，`komari-theme.json.version` 已更新为 `3.0.0`；`bun run lint && bun run build` 通过，生成 `dist/` 与 `komari-theme-Glassmorphism-build-881385d.zip`。构建仍有既有 `@vueuse/core` PURE 注释警告与 `globe` chunk 超过 600 kB 警告。
- v3.0.0 已提交并推送 main：commit `c50f6ed`；GitHub release workflow #34 已成功；Release `v3.0.0` 已发布，资产为 `komari-theme-Glassmorphism-build-c50f6ed.zip`。
- 2026-07-13 v3.0.0 frontend follow-up / AuditLogPanel：`bun run lint` 通过；`bun run build` 通过，生成 `dist/` 与 `komari-theme-Glassmorphism-build-6ccc9d7.zip`。构建仍有既有 `@vueuse/core` PURE 注释警告与 `globe` chunk 超过 600 kB 警告。
- 2026-07-13 v3.0.2 home card cleanup：按用户反馈移除首页 NodeCard 的物理核心文案和磁盘“数据积累中”提示，HealthSummaryPanel 也不再输出该提示；详情页 LoadChart 磁盘模块继续显示磁盘预测和样本不足原因；`bun run lint && bun run build` 通过，生成 `dist/` 与本地 `komari-theme-Glassmorphism-build-7be6c21.zip`（提交前短 SHA）。构建仍有既有 `@vueuse/core` PURE 注释警告与 `globe` chunk 超过 600 kB 警告。
- 2026-07-13 chunk/request pressure follow-up：同步 `origin/main` 后首次 `bun run lint && bun run build` 因远端 README 标题从 H1 跳到 H3 触发 `markdown/heading-increment` 失败；已将副标题改为 H2 并同步 README 当前版本为 v3.0.3。重跑 `bun run lint && bun run build` 通过；构建输出新增 `assets/v3-services-*.js`（约 54.67 kB / gzip 18.22 kB），用于合并 v3 共享服务/工具模块；生成 `dist/` 与 `komari-theme-Glassmorphism-build-94691f1.zip`（提交前短 SHA）。构建仍有既有 `@vueuse/core` PURE 注释警告与 `globe` chunk 超过 600 kB 警告。已提交并推送 main：commit `8b40b59`；GitHub release workflow #29231673966 成功；Release `v3.0.3` 已发布，资产为 `komari-theme-Glassmorphism-build-8b40b59.zip`。

## 风险点

- `bun run lint` 当前脚本包含 `--fix`，会自动修改文件；如需运行，应在运行后检查 diff。
- PingChart、首页 Ping 摘要、LoadChart 历史模式已优先尝试 public metric store，并保留 legacy fallback；HealthSummaryPanel 尚未迁移到 metric store。
- PingChart 自定义范围在 metric API 可用时精确传 `start/end`；legacy fallback 会按保留时间扩大回溯后再裁剪，但仍受旧接口最大保留时长与 6000 点上限约束。
- AuditLogPanel 已按 `admin:getLogs` 接入但尚未在真实登录后端手动验证返回形态；若后端字段或分页语义变化，需按真实响应微调。
- 自定义 LoadChart 时间范围在 metric API 可用时精确传 `start` / `end`；旧后端 fallback 仍只能近似为“最近 N 小时”。
- `traffic_up` / `traffic_down` 当前只做字段接收与历史 normalize，不替换现有流量 UI 语义。
- `message` 已在 NodeCard / NodeList 以纯文本 tooltip 展示，禁止 `v-html` 的约束仍需保持。
- JSON 导出已经分片构建节点字符串，但最终字符串拼接和 Blob 创建仍是浏览器同步边界；相比原先整棵大对象 `JSON.stringify` 已降低主线程尖峰。
- 不应对整个 `NodeData` 使用 `markRaw`，否则会破坏实时 CPU、内存、网络和在线状态响应式刷新。

## 交接说明

已完成：

- 首页强闪屏修复：首屏前预设暗色 class/color-scheme、文档初始背景 token 化、LoadingCover 去除 `bg-white/80`、密集节点卡片禁用首轮动画与在线状态扩散环。
- 自定义背景图片 follow-up：`src/styles/main.css` 不再给 `#app` 设置不透明背景，避免遮住 `Background.vue` 的 fixed 背景层；仍保留 `html` / `body` token 背景来降低首屏白底闪现。`LoadingCover.vue` 在自定义背景启用且当前模式有背景 URL 时不再铺白雾遮罩/Loading 文案，仅保留轻量圆形指示器。
- 本次未做真实浏览器夜间首屏录屏或真实 Komari 自定义背景验证；建议在真实 Komari 多节点环境中用暗色/auto 模式硬刷新首页，并打开自定义背景图片确认无白屏闪烁且背景可见。
- HTTP/WS timeout 与 abort 清理、RequestManager 队列 `finally` 释放、共享 Promise reject/finally 清理。
- Provider metadata 模块级共享缓存与 `markRaw` 元数据。
- NodeTopologyPanel 拓扑索引与离线上游解析复杂度优化。
- NodeList 虚拟列表固定行高与文本截断防御。
- useNodeLoadStats 对在线节点 0 采样的 DEV warn。
- CSV 公式注入与 RFC 4180 转义收尾修复。
- Snapshot JSON/CSV 导出加载态与异步分片构建。
- `AICACHE.md` 已从旧文档任务交接内容更新为当前 v3.0 任务状态。
- Komari 1.2.x 第一批兼容补丁已完成：RPC/API 类型补新字段、`common:getRecords` `maxCount` 兼容、public RPC/metric 方法壳、历史 records array/map normalize、节点 store 同步新字段、详情页展示物理核心。
- 官方 komari-web 高价值功能移植第一批已完成：metric series 工具、metrics service、PingChart / 首页 Ping 摘要 metric 优先 + legacy fallback、NodeCard / NodeList 探针 `message` 纯文本提示。
- 用户要求“全部上马”后的剩余官方功能已完成：LoadChart 历史模式 metric store 优先 + legacy fallback、GPU detail/per-device metric 图表、`chartDashboardTemplate` 托管配置读取和布局排序。
- 详情页 Metric Store 扩展已完成：25 个官方 definition 归并为 12 个图表族，补齐流量、显存、温度、Ping 延迟/丢包卡片及预设；概览恢复宽屏 4 列和 8/12/16 卡预设；PingChart 支持自定义起止时间并补强新旧丢包 fallback。
- v3.0.0 复查 follow-up 已完成：物理核心 UI / 每核成本、自定义 LoadChart 时间范围、metric definitions TTL 缓存、`SharedCache.retain()` 修复、AuditLogPanel、磁盘预测数据积累提示、NodeCard 显式传 `LOAD_RECORD_MAX_COUNT`。

未完成：

- chunk/request pressure follow-up 已完成：`vite.config.ts` 新增 `v3-services` manual chunk；`LoadChart.vue` legacy fallback 与详情页统计统一使用 `LOAD_RECORD_MAX_COUNT` 维度，降低重复历史请求概率。
- HealthSummaryPanel 尚未接入 metric store。
- 尚未实现后台写入/保存 `chartDashboardTemplate`，当前只读取托管配置。
- 尚未在真实 Komari 1.2.x 后端上手动确认 `public:getPingMetricStats` / `public:queryMetrics` / GPU metric 返回形态；当前只通过类型检查、lint、build 验证。

下一步：

1. 人工查看当前 diff，注意工作区还包含此前 v3.0 稳定性重构和 AI 文档改动，不只有本批 Komari 1.2.x 适配。
2. 在真实新版后端打开 PingChart 和 LoadChart，确认 Network 优先出现 `public:getPingMetricStats` / `public:queryMetrics`，旧后端确认 fallback 到 `common:getRecords` / `loadNodeLoadRecords`。
3. 有 GPU 节点时检查 GPU 卡片、per-device tooltip、显存百分比和温度展示；无 GPU 节点时确认 GPU 卡片自动隐藏。
4. 若不希望提交构建产物，提交前按项目发布流程决定是否保留本次 `dist/` 与 zip 输出。

---

## 上一个任务记录

- 状态：done
- 目标：整理 AI 开发入口文档，新增 AIAGENTREADME 与 AICACHE，让 AI/二开者能理解项目架构、开发路径和交接方式。
- 范围：根目录 AI 文档、Claude/Agent 指引、src 作用域指引、AI 工作缓存模板。
- 不做：不改运行时代码、不改主题版本、不改 release workflow。

## 上一个任务执行日志

### 2026-07-12

- 新增 [AIAGENTREADME.md](AIAGENTREADME.md)：集中说明项目是什么、技术栈、架构分层、服务层职责、开发路径、发布契约、安全/性能规则和 AI 交接要求。
- 重写 [CLAUDE.md](CLAUDE.md)：精简为 Claude Code 入口，指向 AIAGENTREADME、AICACHE 和最近作用域 AGENTS。
- 重写 [AGENTS.md](AGENTS.md)：精简为根作用域 agent 指引，保留 build/release/root map/safeguards。
- 重写 [src/AGENTS.md](src/AGENTS.md)：精简为 src 子树实现规则，强调 v3 分层、store/service/UI/security/validation。
- 新增本文件 [AICACHE.md](AICACHE.md)：提供持久化待办、执行日志、验证和交接模板。

## 新任务模板

复制以下模板到“当前任务”或追加到执行日志：

```markdown
## 当前任务

- 状态：planned | in-progress | blocked | done
- 目标：
- 范围：
- 不做：
- 负责人/代理：

## 执行日志

### YYYY-MM-DD HH:mm

- 做了什么：
- 改了哪些文件：
- 决策原因：

## 验证记录

- 命令：
- 结果：
- 警告：
- 未验证项及原因：

## 风险点

-

## 交接说明

已完成：

-

未完成：

-

下一步：

1.
```

## 2026-07-15 Preview redesign (M4)

- Redesigning `docs/preview.png` because the current marketing-hero composition is too close to Komari Emerald (left title, large globe, three-word slogan).
- New direction: a product-first monitoring dashboard scene with frosted node cards and compact telemetry, no globe, no Emerald logo, no marketing slogan.
- Generated `output/imagegen/komari-glass-dashboard-preview-v2.png` with `gpt-image-2` (high quality) and selected its 1280x720 web derivative after visual inspection. The new composition is a full monitoring workspace with a top status strip, network overview, and six node cards.
- Runtime screenshot/mock work was deferred. `docs/preview.png` was replaced with a pure conceptual settings cover: no version badge and no actual page preview; it emphasizes eight configurable areas over the generated cyan/mint/lilac glass background.
- Shortened the managed configuration menu label from `Glassmorphism 设置` to `主题设置`.
- Release audit found `applyClient()` did not refresh the new billing fields after initial load. v3.1.7 now updates rates, anchor state, cumulative traffic, and startup-fee-applied state during the existing client metadata polling cycle.
- Fixed the misleading `完整` general-card preset: it was hard-coded to six cards even though the responsive renderer supports additional rows. It now expands to every unique `ALL_GENERAL_CARD_KEYS` entry; other presets remain curated six-card layouts.

## 2026-07-15 v3.1.7 release candidate

- `bun run lint`: passed.
- `bun run build`: passed, including `vue-tsc`; only the existing Rollup annotation and large globe chunk warnings remain.
- Local archive contains `komari-theme.json`, `preview.png`, and `dist/index.html`; embedded manifest version is `3.1.7` and configuration name is `主题设置`.
- Home -> detail -> home was browser-verified earlier with no refresh and no Fragment/Transition warning after moving `PingMonitorDialog` inside the single `HomeView` root.
- Komari PR #604 head `f08f47d` is `CLEAN` / `MERGEABLE`; all frontend and cross-platform binary checks succeeded.
- komari-web PR #82 head `0fee1f1` is `CLEAN` / `MERGEABLE`; that exact commit is embedded under `public/admin-app/`.
- Local-only `.claude/`, `output/`, and `tmp/` must remain uncommitted.

## 2026-07-15 v3.1.7 published

- Release commit: `3710532164e6b58433373199321d2977574e9913`.
- GitHub Actions run `29428658864`: success.
- Release: `https://github.com/sanrokamlan-prog/komari-theme-Glassmorphism/releases/tag/v3.1.7`.
- Published asset: `komari-theme-Glassmorphism-build-3710532.zip`, SHA-256 `ac1a203a53a5d31fdc8a148964e1e64f1659dea7beb9745c906a8731686180a4`.
- Downloaded asset verification passed: manifest `3.1.7`, `主题设置`, `preview.png` hash equals repository preview, and `dist/index.html` exists.
- Old preview seen after upgrading is browser cache: komari-web uses `/themes/<short>/<preview>` without a version query. A hard refresh/cleared image cache displays the released image; a durable cache-busting change belongs in komari-web.
- Maintainer feedback indicates the real-time billing PRs do not fit Komari's simple cycle billing model. Treat Komari #604 and komari-web #82 as experimental fork work pending explicit upstream acceptance: wall-clock hourly estimates include offline time, traffic estimates do not reset by billing cycle, and startup fee is a static one-time add-on rather than a cycle item.

## 2026-07-15 v3.1.8 Swap tooltip hotfix

- Root cause: the Swap hover used `DataTooltip`, whose absolutely positioned content remains inside the node-card overflow boundary. The card clipped the tooltip into a thick horizontal bar that overlaid unrelated content.
- Fix: memory metrics now use a native `title` tooltip, which does not participate in card layout or clipping. The text reports `Swap 已用 <size> / 总计 <size>` and falls back to used-only when total is unavailable.
- Guardrail: do not use the current non-portal `DataTooltip` for content that must escape node/list containers with overflow clipping; use a native title or a portal-backed overlay.
- Validation: `bun run lint` and `bun run build` passed. The local archive contains `komari-theme.json`, `preview.png`, and `dist/index.html`; its embedded manifest is version `3.1.8` with configuration name `主题设置`.

## 2026-07-15 v3.1.8 published

- Release commit: `a52572aea7631239e1c35a47283c74a744a9911d`.
- GitHub Actions run `29430366028`: success.
- Release: `https://github.com/sanrokamlan-prog/komari-theme-Glassmorphism/releases/tag/v3.1.8`.
- Published asset: `komari-theme-Glassmorphism-build-a52572a.zip`, SHA-256 `f4dd86ad26a9a55ebfcecc1c76ac07cdcd5fcfd1883cf608ec4e7f491388ea26`.
- Downloaded asset verification passed: manifest `3.1.8`, configuration name `主题设置`, `preview.png`, and `dist/index.html` are present.

## 2026-07-16 v3.1.9 release candidate (M4/M5/M6)

- Removed all theme/runtime dependencies on experimental Komari #604 and komari-web #82 fields. The embedded admin is rebuilt from official komari-web `radix` commit `ebfbd3e079f8777a746276fe67429b519024f7c7`; the integration core is upstream Komari `43547b947ff82b4b899452ead7ba7b1517ba1f84` and does not contain #604.
- Added a per-node frontend usage estimator under `theme:usage-estimator:v1:<node_uuid>`. It uses a frozen cumulative traffic snapshot, manual billable hours, a one-time estimate-only add-on, explicit source/display currencies, TiB units, finite non-negative bounds and a clear non-billing disclaimer.
- Reworked the value dialog into fixed-value, metered-estimate and exchange-rate sections. Rate source/update time is visible; missing exchange rates are not silently treated as 1; local settings can be cleared.
- Synced the complete official admin app and rewrote root-relative flag/OS assets for `/admin-app/`. The sync script injects the route bridge and hash-busts `glass-admin.css`; the CSS applies stronger cyan/mint/lilac glass styling while avoiding per-card backdrop filters on dense tables.
- Fixed the embedded-default identity mismatch that caused Theme Management to request an uninstalled `/themes/Glassmorphism` directory. Integration packages normalize the embedded manifest short name to `default`; the release theme remains `Glassmorphism`.
- Added safe persistent background resolution: `local:path` maps to `/themes/user-assets/<encoded path>` and rejects `.`/`..`. Administrators should store files under Komari `data/theme/user-assets/`, outside replaceable theme packages.
- Added the compact header advanced-tools toggle, removed the monthly-cost quick filter, changed the authenticated visitor label to `尊敬的管理员`, hid the detail visitor card below `2xl`, and retained the bottom IP pill.
- Constrained the standard earth canvas and increased the header band height so the globe no longer overlaps controls or the first node row at 1280px. Ping gaps now say `无采样数据` instead of `N/A`.
- Browser verification on `https://mt.vpnmiao.com/`: 390x844 and 1280x720 had no document overflow; the visitor detail card stayed hidden; globe/list boundaries were visually clean; `/admin`, `/admin/settings/theme`, `/admin/theme_managed` and `/terminal` loaded; Theme Management had no 404; admin images had no broken resources; console had no new warnings/errors.
- Integration validation: `go test ./database/clients ./web/api/client ./web/rpc/jsonrpc` and `go vet ./...` passed. Linux amd64 CGO/static build succeeded and was deployed for live testing. The test host was cleaned to the active binary/data only, with no backups retained per operator request.
- Release guardrail: do not reintroduce #604/#82 into the theme release or new upstream PRs. Komari default-theme work must be a clean branch from upstream main; komari-web asset-path work must be a clean branch from upstream radix.

## 2026-07-16 v3.1.9 published and upstreamed

- Release commit `f17a5eb7c18138fba78d22504e1ed5b19b347284`; workflow `29492624741` succeeded; Release `v3.1.9` points to the same SHA.
- Published asset `komari-theme-Glassmorphism-build-f17a5eb.zip`, SHA-256 `aab1572006c02447461410422962d5c65c569c6429a0191a74e6ee5544eaff9b`. Downloaded verification passed for version, `Glassmorphism` short name, `主题设置`, preview hash, `dist/index.html`, embedded admin index, admin source SHA and absence of #604 fields.
- Komari fork branch `codex/glassmorphism-default-theme`, commit `7b64db3c403f05f6dfbcb603ae4763c8842442a8`, upstream PR `komari-monitor/komari#606`. It pins Glassmorphism `v3.1.9`, builds with Bun, normalizes the embedded manifest to `short: default`, and tests metadata preservation. PR CI run `29493915098` passed frontend plus all seven Linux/Windows binary jobs.
- komari-web fork branch `codex/base-aware-static-assets`, commit `2ff6c2be70ac12a641ac7272cdfed1995439d58a`, upstream PR `komari-monitor/komari-web#83`. It resolves flag and OS images from Vite `BASE_URL`; lint has 0 errors/27 existing warnings, and both root and `/admin-app/` production builds pass.
- The admin sync script accepts both legacy root-relative komari-web assets (rewritten after build) and #83-style native BASE_URL assets (already correct). Do not restore the old requirement that at least one root-relative path must be rewritten.

## 2026-07-16 default-theme updater and globe follow-up (M4/M5/M6)

- In progress: paired clean upstream PRs add writable updates for Komari's embedded `default` theme. Core changes use `data/theme/default` as an atomic overlay and retain the binary-embedded theme as fallback; komari-web exposes the update action and explains the fallback behavior.
- Core regression coverage includes successful default installation, manifest normalization, preservation of the previous overlay after an invalid archive, safe local asset lookup, and rejection of traversal paths.
- Globe regression found in v3.1.9: the normal header was raised from the established `md:h-58` layout to `md:h-72` and the globe column gained forced height/clipping. Those three layout classes are being restored to the v3.1.8 implementation; renderer selection remains configurable and `realistic` remains the default.
- Cross-renderer browser verification found and fixed a tiled-map scoped-CSS regression: `:global(.dark) .child` compiled to bare `.dark` selectors, applying map image opacity/filter rules to the entire document. The selectors now wrap the complete descendant selector in `:global(...)`.
- Browser checks use the real 47-node test dataset. Realistic renders at about 475px desktop / 369px mobile after the original layout restoration; Cobe renders at 448px / 348px; tiled mode keeps its 672px mobile map inside a 356px horizontal scroll container with no document overflow.
- v3.2.0 validation: `bun run lint` and `bun run build` passed; the local archive contains manifest version `3.2.0`, `preview.png`, and `dist/index.html`. Browser checks covered all three earth renderers on desktop/mobile and home -> detail -> home. The only build warnings are the existing VueUse annotation and large globe chunk notices.
- Default-theme updater validation: `go test ./web/api/admin ./web/public` and targeted `go vet` passed. A broader `go test ./web/...` reached unrelated SQLite-backed packages and failed because the local Go binary uses `CGO_ENABLED=0`; do not treat that environment failure as a regression in these packages.
- komari-web updater UI: i18n sync is clean, lint reports 0 errors / 27 existing warnings, and both root-base and `/admin-app/` production builds pass.

## 2026-07-25 metric tags, node search and CPU estimate follow-up (M4/M6)

- Komari main commit `d853a83e` removed the deprecated public metric `tag` alias; current responses use `tags`. Keep the theme's legacy `tag` type and fallback for transitional 1.2.x cores, but merge in `labels -> tag -> tags` order so canonical `tags` always wins conflicts.
- Komari 1.2.5 does not expose `public:queryMetrics`; detail and Ping history must retain the existing `getRecords` / `getPingRecords` fallback. Do not make MetricSeries support a hard requirement.
- Metric tag identity keys now use sorted JSON tuples instead of delimiter-joined strings, avoiding collisions when tag values contain `|` or `=`. Normalized series clear the legacy `tag` alias after canonicalizing it into `tags`.
- Home search moved to `utils/nodeSearch.ts` and now covers node name, UUID, region, groups, tags, OS/kernel, virtualization/architecture, public metadata, CPU/GPU model and available IPv4/IPv6 values. IPv4 octet wildcards such as `192.168.x.x` and `192.168.*.*` are supported. Guest search cannot expose private IPs because Komari omits them from the public node payload before the theme receives it.
- The local S/A/B CPU heuristic was discarded after review because model-family rules cannot provide a credible performance ladder. Detail pages now generate a small external PassMark CPU Mark lookup link from the reported model; benchmark data and ranking stay with PassMark and are not copied into the theme.
- Komari snapshot `c7819cd9` adds public Ping task `weight`. The theme accepts it as optional and orders metric Ping lines by `weight -> id`; old cores without weight remain compatible and fall back to numeric task ID ordering.
- Mobile visitor bar now hides while actively scrolling and returns 700 ms after scroll idle; its mobile layout hides the redundant `Your IP:` label and truncates long IPv6 values. Back-to-top appears only after 320 px, uses a smaller mobile button above the visitor bar, and no longer uses a modal-level `z-index`.
- Validation: `bun run lint`, `bun run build`, and `git diff --check` passed after all changes. Behavior smokes passed for `tags` precedence, collision-safe metric keys, Ping weight ordering, fuzzy IPv4/IPv6 and CPU text search, and PassMark model normalization/link generation. The required theme archive layout remains intact; only the existing VueUse annotation and large globe chunk warnings remain.
- CPU benchmark data remains external: PassMark does not expose a browser CORS API and its downloadable benchmark data is licensed, so do not reintroduce guessed local grades or scrape the site from the theme. The lookup action now sits at the CPU card's top-right and opens the normalized model query directly.
- At the maintainer's request, CPU detail also shows a clearly labelled local approximate model tier. The ordered classifier covers common EPYC/Xeon/Ryzen/Core/Threadripper/Apple Silicon/Ampere/Graviton/Neoverse and low-power/legacy families without embedding proprietary scores. Preserve the established labels (`旗舰服务器级`, `高端消费级`, `云原生 ARM 级`, etc.); only the underlying model-generation data should evolve. Keep the tooltip disclaimer: this is a model-generation reference, not a benchmark of the node's allocated vCPUs.
- Disk prediction subtitles are intentionally compact (`预计 N 天后满`, `暂无趋势`, `样本不足`, `趋势积累中`) to avoid wrapping over the chart on narrow viewports.
- CPU tier samples were checked across EPYC 7551/7B13/9654, Xeon E5 v4/Gold 6133/Platinum 8480+, Core i9-14900K, Ryzen 9950X, Ampere Altra Max, Intel N100, KVM64 and an unknown model. Final `bun run lint`, `bun run build`, and `git diff --check` passed; the test archive remains `komari-theme-Glassmorphism-build-ce11932.zip`.
- CPU rating presentation keeps the established unframed row under the model (`tier + thin bar + label`). Only the external CPU Mark action belongs in the card header; do not turn the tier into a top-right badge.

## 2026-07-25巡检效率与大规模节点优化（M2/M4/M5）

- 超过 30 台节点时，卡片模式使用 `DeferredRender` 在视口前后 700px 内按需挂载 `NodeCard`，未挂载区域保留按卡片密度计算的稳定高度；列表模式继续使用既有虚拟列表。
- 收藏节点保存在站点隔离的 `theme:favorite-nodes:v1`，卡片、列表与详情页均可切换星标；首页快捷控制新增 `favorite`。运行时会清洗损坏的本地存储值。
- 详情页头部新增收藏、上一台、下一个和下拉节点切换器，继续使用公开可见节点列表，不引入新接口。
- 首页工具新增公开的实时节点对比，最多选择 4 台，支持按名称/IP/CPU 搜索，显示 CPU、内存、磁盘、网络、流量、运行时间和按隐私设置降级的价格；选择保存在 `theme:node-compare:v1`。
- 健康摘要在现有历史请求结果上派生综合异常排行，合并离线、CPU、内存、磁盘、流量、Ping 和磁盘耗尽风险，不增加重复请求。
- 明确排除：不做地球自动画质，也不增加 CPU 天梯规则的在线维护功能。
- PR #29 (`7e582c2`, merged as `9c9a7ee`) restores PWA metadata. Local integration preserves its iOS standalone intent and manifest retention, then hardens it: the root theme links the manifest, Apple touch uses the existing 512px PNG, and `sync-komari-admin.ts` parses manifest JSON to rewrite `/assets/` icons under `/admin-app/assets/`. Service worker files remain intentionally removed to avoid stale admin assets after route bridging.
- Final test package validation passed: `bun run lint`, `bun run build`, and `git diff --check`; `dist/index.html` links `/admin-app/manifest.json` and `/admin-app/assets/pwa-icon.png`, all manifest PWA paths resolve inside the archive, and the output remains manifest version `3.2.0`. After removing the redundant default quick control, test zip SHA-256 is `DF72FC12C4B57C59482A24F28793C1C9B7E7874205F21E410DC87BE487B5610D`.
- Quick controls no longer render a redundant `默认` item or expose a default-filter setting. No active filter means all nodes; clicking a filter selects it, clicking it again clears it, matching the advanced-tool toggle interaction. Legacy `default` keys are ignored during normalization.

## 2026-07-25 online browser verification follow-up (M2/M4)

- The uploaded 54-node build passed desktop checks for toggleable quick filters, favorites, four-node comparison limits, detail previous/next/select navigation, normalized CPU Mark links, compact disk trend text, and document-width containment.
- Node comparison no longer preselects two nodes. Its empty state previews every available comparison field, while persisted explicit selections remain supported.
- Fixed a dynamic-enable gap in `DeferredRender`: when the node list initially starts below the 30-node threshold and later grows above it, offscreen cards are now suspended after a viewport-distance check instead of remaining mounted. A requestAnimationFrame-throttled scroll/resize fallback covers browsers without `IntersectionObserver`.
- First uploaded-build verification proved the component-level watcher alone was insufficient: the initial data injection still retained 54 already-mounted cards, while toggling a quick filter remounted the same grid with only 16 near-viewport cards. The node wrapper key now includes the deferred/full mode so crossing the 30-node threshold deterministically recreates wrappers in deferred mode.
- Second uploaded-build verification reduced the desktop first mount to 20 cards plus 34 stable placeholders with no horizontal overflow. Its scroll reveal still stalled in the in-app browser, whose page environment did not expose `IntersectionObserver` or `requestAnimationFrame`; the fallback scheduler now uses a 16 ms window timer when animation frames are unavailable.
- Deferred cards now use a hybrid reveal policy: the viewport and its 700px buffer mount first, scrolling prioritizes newly-near cards, and staggered idle timers progressively mount the remaining cards over roughly 1–5 seconds even when the user does not scroll. Each timer is cleared after an early reveal or component teardown.
- Final live verification on `https://mt.vpnmiao.com/` loaded the expected `index-Cq7ioLuk.js` asset. Desktop remount measured 16 cards at 0/500 ms, 26 at 2.3 s and all 54 at 5.1 s; a rapid 1800px scroll raised the mounted set from 16 to 40 within 200 ms. Mobile 390x844 measured 4 cards initially and all 54 by 5.3 s, with `scrollWidth === clientWidth` on both breakpoints.
- The comparison panel opened at 0/4 with all comparison metric labels previewed. Weekly health generation returned an immediate realtime summary, completed the capped 6,000-sample history pass in about 8 seconds, and populated composite anomaly, CPU, memory, disk-growth, traffic and Ping findings. The final browser console contained no warnings or errors.

## 2026-07-25 visual regression automation (M6)

- Goal: add deterministic Playwright screenshot regression coverage without adding any runtime theme feature or real-site dependency.
- Planned fixture coverage: long node names, IPv4/IPv6, Swap, offline/high-load/traffic-warning states, fixed prices and fixed timestamps. Network responses are mocked in Playwright; fixture data must not enter the release zip.
- Planned baseline matrix starts intentionally small: desktop/mobile home, desktop list, desktop detail, dark/color-vision home and one alternate earth renderer. GitHub Actions must upload actual/diff artifacts on failure.
- Implemented 7 deterministic Playwright baselines: light desktop home, dark mobile home, accessible desktop list, Cobe and tiled earth layouts, light desktop detail and dark mobile detail. All use mocked Komari API/RPC/visitor data, fixed time, disabled animations and hidden dynamic 3D canvas pixels while retaining globe layout boundaries.
- First baseline generation and repeated comparison both passed 7/7 with system Chrome. Windows system-channel Chrome did not exit cleanly after reporting results, so release validation does not treat that local channel teardown as a product failure; CI installs and runs Playwright's managed Chromium.
- Added the independent `Visual Regression` workflow for pull requests and `main`, with actual/diff/HTML report artifacts retained for 14 days on failure. Release target is v3.3.0.
