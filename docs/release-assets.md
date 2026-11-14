# 发行附件命名与兼容计划

## v1.2.1：保留已发布名称和 URL

发行 Commit 固定为 `0332d5f7c73f7994ba21c01e4b739d04835120b1`，本轮不重命名、不删除、不替换附件，也不移动 Tag。

- 推荐普通用户：[komari-theme-Glassmorphism-build-0332d5f.zip](https://github.com/casiuna/Glassmorphism-Enhanced/releases/download/v1.2.1/komari-theme-Glassmorphism-build-0332d5f.zip)。这是唯一的公开原生主题 ZIP。
- 可选高级用户：[Glassmorphism-Enhanced-Full-0332d5f.tar.gz](https://github.com/casiuna/Glassmorphism-Enhanced/releases/download/v1.2.1/Glassmorphism-Enhanced-Full-0332d5f.tar.gz)。不能直接上传到主题管理器。

原生 ZIP 的 manifest 为 `Glassmorphism Enhanced` / `Enhanced` / `1.2.1`，根目录为 `komari-theme.json`、`preview.png`、`dist/`。Komari 按 manifest 识别主题，不靠上游下载文件名前缀；独立原生安装测试将真实附件字节以通用上传文件名提交，仍按 `Enhanced` 安装／升级。

## 后续版本建议

建议未来获准的新版本使用单一原生附件名：

```text
Glassmorphism-Enhanced-vX.Y.Z.zip
```

**本轮仅完成影响评估，不激活命名迁移。** 当前打包逻辑、v1.2.1 链接和正式资产均不变。新名字应在后续新版本中一次性同步实现并重新验收，不能通过重命名现有附件来实现。

| 位置                                            | 未来必须同步的内容                                                                         |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `vite.config.ts`                                | 原生 ZIP 输出名称；保留根目录、manifest 身份、预览与 BUILD 的源码 Commit 绑定              |
| `scripts/package-route.py`                      | Theme ZIP 发现／记录路径；Plugin / Helper 的独立版本线不变                                 |
| `scripts/package-full.py`                       | Theme 文件查找和 Full matrix 中的相对路径、SHA、大小                                       |
| `.github/workflows/release-on-version-bump.yml` | 原生附件匹配规则；版本标题和对应 Release Notes 已动态化                                    |
| `tests/full/verify_delivery.py`                 | 正式原生文件名契约；不得放宽 clean-source、源码绑定或归档安全校验                          |
| 原生 / Companion / Full 集成测试及测试工具      | 去除旧文件名前缀发现假设，按明确的 artifact 记录或 matrix 读取；同时验证旧版升级与新文件名 |
| README、安装指南、每个新版本 Release Notes      | 普通主题优先，新版提供新版链接；旧版 URL 永久保留                                          |
| 市场兼容验证                                    | 保持公开 Release 只有一个原生 ZIP，不同时上传旧名和新名的两个 ZIP                          |

## 市场兼容性：只读评估，不更新市场

本轮只读核对了 [官方 updater 源码](https://github.com/komari-monitor/theme-market/blob/main/scripts/update-theme-releases.mjs)：它先找 catalog 当前文件名；没有匹配时，仅在 Release 恰有一个 `.zip` 时尝试唯一 ZIP，并读取根目录 manifest。新名字在此回退规则下具备兼容路径，但这不是保证所有旧消费者都兼容。

因此未来迁移方案应是：保持 `short: Enhanced`，每个新版本只发布一个新名原生 ZIP；Full 继续使用非 ZIP 的外层包。不要额外上传一个旧名兼容 ZIP 造成歧义。历史 v1.2.1 / v1.2.0 附件和所有已发布直链保持原样；安装器以 matrix 指向模块，而不是改变已发布包。需要更新 catalog 或其他消费者时，必须另行授权并测试，不能在本轮提交市场 Issue / PR 或修改市场版本。

本轮没有改动命名／打包实现，也没有执行市场 updater。Tag 及已发布包中的旧文档仍不可变，修正后的 Release 只引导至主分支持续维护文档。
