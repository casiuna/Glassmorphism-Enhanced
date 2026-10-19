# v1.1.0：迁移到 Enhanced

`Enhanced` 是新的主题身份。它与旧安装 `Glassmorphism` 并存，上传不会自动继承旧主题的服务端配置，也不会替你删除旧主题。ZIP 文件名仍沿用 `komari-theme-Glassmorphism-build-<commit>.zip`，安装身份以包内 manifest 的 `short` 为准。

## 迁移

1. 升级前备份 Komari，并在旧 `Glassmorphism` 仍启用时保存其主题设置。特别保留三网任务、`Relay|Target|LinkTask` 中转规则、外观、图表和 RPC 连接模式。
2. 从正式 v1.1.0 Release 下载主题 ZIP；待审核的本地候选包不等于正式 Release。
3. 在后台上传 ZIP。确认列表同时保留 `Glassmorphism` 和 `Enhanced`，后者名称为 **Glassmorphism Enhanced**、作者为 **casiuna**、版本为 **1.1.0**。
4. 为 `Enhanced` 填入原主题配置，再启用它。主题配置 schema 未重命名；无需改 Agent、Ping 任务或数据库。
5. 对照旧值检查三网显示、Transit、流量口径、图表和 RPC 模式；保存后刷新，确认配置持久化。

需要精确迁移的维护者可以在已鉴权的后台使用现有接口：旧主题启用时 `GET /api/public` 读取其 `theme_settings`；将该对象发送到 `POST /api/admin/theme/settings?theme=Enhanced`；通过后台启用新主题后再次读取 `/api/public`，比较配置。不要把包含二级导出密码等设置的 JSON 公开上传。本主题不自动执行这些写操作。

同一域名下，现有浏览器偏好和财务设置的 localStorage 键保持不变，SGD、手动汇率和缓存继续沿用；这不代表服务端的主题配置会自动跨身份复制。

## 回退

在后台重新启用旧 `Glassmorphism` 即可。原主题文件和原身份的配置必须保留，不需要改数据库或重装 Agent。不要用上游市场中的同名 `Glassmorphism` 更新包覆盖自己的旧 Enhanced 安装。

独立的 Komari 1.6.0 与 1.5.1 测试环境已实际验证：上传旧包和新包、两个身份并存、复制配置、启用新身份、切回旧身份读取原值、再次启用新身份。没有通过直接 SQL 编辑或删除旧主题完成迁移。
