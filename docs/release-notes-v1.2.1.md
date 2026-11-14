# v1.2.1

## 推荐安装：原生主题 ZIP

普通用户只需下载 [komari-theme-Glassmorphism-build-0332d5f.zip](https://github.com/casiuna/Glassmorphism-Enhanced/releases/download/v1.2.1/komari-theme-Glassmorphism-build-0332d5f.zip)，在 **Komari 1.6.0 后台 → 主题管理**中上传并启用 **Enhanced**，然后刷新主页。

- 主题身份保持 `Glassmorphism Enhanced` / `Enhanced` / `1.2.1`。
- 标签、手动三网线路、已有三网 Ping、Transit、价格、流量及独立流量周期均属于主题基础功能，不需要 Enhanced Plugin、Helper 或 Full 安装器。
- 原生 ZIP 包含 manifest、预览图和 `dist/`；使用预构建主题不需要另外运行 Node.js、Bun、Python 或开发服务器。监控与 Ping 仍使用已有 Komari / Agent 能力。
- 管理员登录后，在主页「Enhanced 管理」选择节点、填写联通／电信／移动三个手动名称；线路开关、有效期及 Ping／Transit 同属「03 · 线路与延迟」。原始 JSON 是同一配置的高级编辑入口，不是第二套配置。
- 从 v1.2.0 原位升级时保持 `short: Enhanced`，保留托管配置；升级前请备份主题设置及旧主题 ZIP，不要先删除主题或直接覆盖整份配置。

## 更新内容

- 顶部自定义标签保持居中、尺寸与长文本提示；不改写原始 tags 或内部拓扑元数据。
- 节点线路摘要严格三等分：红／蓝／绿圆点与完整线路名在各自等宽列内居中，不添加运营商前缀，不省略截断。
- 后台统一为 01–05 五个分类，线路显示、自动结果消费、有效期、手动线路与 Ping／Transit 统一归入 03；04 仅保留外观与背景，可选采集诊断默认折叠。
- 手动线路提供节点选择和三个输入框；保留管理员校验、保存后读回、已检测冲突拒绝、旧 JSON 兼容及其他字段保留。未知、过期、失败、模拟和协议冲突不冒充有效线路，私有逐跳证据仅管理员可见。
- 新增逐节点独立流量重置日，按上海时区计算周期；短月回退到月末，后续月份恢复原设定日期。历史不足时显示数据不足，不用机器累计量冒充周期配额，不在前台增加重置倒计时。
- 保留原有 Ping、Transit、累计流量、价格、财务和历史记录。原生 API 没有跨请求事务／原子 CAS，冲突复核与读回校验不等于数据库级事务保证。
- Full 升级仅接受新 Plugin manifest 的精确默认配置项，保留版本保护、真实加载失败后的补偿回滚及管理员并发修改拒绝。

## 可选高级安装：Full 一体化包

[Glassmorphism-Enhanced-Full-0332d5f.tar.gz](https://github.com/casiuna/Glassmorphism-Enhanced/releases/download/v1.2.1/Glassmorphism-Enhanced-Full-0332d5f.tar.gz) 供需要统一安装、升级、备份与回滚工具的高级用户选择。它包含已校验的内层 Full ZIP、安装器及 Theme / Plugin / Helper，**不是 Komari 原生主题 ZIP，不能整体上传至主题管理器，也不是普通主题安装的前提**。

Theme / Full 为 `1.2.1`；Plugin / Helper 为 `0.3.0+git.0332d5f`。Plugin 每个 Komari 服务端一次；Helper 仅供明确授权参与源端探测的节点使用，不要求所有 VPS 安装，不自动开启远控、安装软件或启动系统服务。

## 自动探测：尚未完成生产验收

**本版不承诺生产可用的实时自动回程探测，也不承诺可靠识别 CN2 GIA、9929、CMI 等商业线路。**

现有 Helper / Plugin 实验链路默认关闭，具备 UUID 认证、租约、限流、私有存储和证据兼容。实时 Helper → Plugin → 可靠 ASN／商业线路分类的公网生产闭环仍未完成验收。历史路径采集、fixture 与 replay 不能代替它；缺少可信证据时保持未知。原生 Agent 替代 Helper 仅完成审计，本版没有通用远程执行桥接。

## 兼容性与持续维护文档

实测隔离目标为 Komari **1.6.0**；1.6.1、物理 GPU 遥测及 systemd / OpenRC 实际服务运行未承诺。独立流量周期不能恢复已删除的历史，也不是服务商账单核对工具。

发行源码与附件固定在 `0332d5f7c73f7994ba21c01e4b739d04835120b1`。**历史 Tag 和附件内的文档不会随主分支文档修正而变化**；其中旧版 Full 安装说明的过时版本描述，请以以下维护文档为准。本次仅修正现有 Release 文本及后续源码文档／工作流，不替换附件，不移动 Tag。

[普通主题安装与配置](https://github.com/casiuna/Glassmorphism-Enhanced/blob/main/README.md) · [可选 Full 安装、升级与回滚](https://github.com/casiuna/Glassmorphism-Enhanced/blob/main/docs/full.md) · [伴生组件依赖审计](https://github.com/casiuna/Glassmorphism-Enhanced/blob/main/docs/settings-companion-audit.md) · [验证范围](https://github.com/casiuna/Glassmorphism-Enhanced/blob/main/docs/full-validation.md)

[完整变更：v1.2.0…v1.2.1](https://github.com/casiuna/Glassmorphism-Enhanced/compare/v1.2.0...v1.2.1)。v1.2.0 原 Tag、Release 和下载保留不变。本次不更新 Komari 官方主题市场，不部署或修改生产环境。
