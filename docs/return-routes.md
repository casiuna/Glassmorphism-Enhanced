# 节点标签与回程线路（Enhanced v1.2.0）

> 当前统一发行/安装/管理入口见 [Enhanced Full v1.2.0](full.md)。内部插件/助手协议参考见 [稳定版伴生模块说明](companion.md)。真实 Komari 1.6.0 的插件/主题上传、鉴权、fixture 回传与浏览器消费已验证；真实网络 traceroute/ASN 仍未运行、未验证。Komari 1.6.1 本轮未实测。

## 节点头部自定义标签

Komari 后台「节点 → 编辑信息 → 标签」的普通标签显示在卡片第二行右侧，与在线时长/价格分区并自动换行；底部不再重复。沿用现有分号分隔及 `标签<颜色>` 解析格式，不修改原始 tags。`customTagsVisible=false` 隐藏卡片/详情/列表普通标签；列表还遵从原 `nodeListCustomTagsVisible`。`upstream/parent/上游/父节点` 和 `route/return-route/transit-route/enhanced-route` 元数据不作为普通 pill 显示，但原始数据和拓扑解析仍保留。

## 手动配置（现在可用）

当前 Full v1.2.0 可在管理员登录主题后通过页头 **「Enhanced 管理」**，选一次节点 UUID，直接设置三网手动覆盖和采集/显示策略。也保留原生托管配置入口：**Komari 后台 → 主题 → Glassmorphism Enhanced (`Enhanced`) → 主题设置 →「10 · 回程线路」**。从 Enhanced 1.1.1 升级时，旧托管设置不会被安装器主动覆盖；安装前后均应保留私有备份。

1. 打开「显示回程线路」。默认关闭，不改变未启用用户的卡片布局。
2. 在「按节点 UUID 配置三网回程 JSON」填写下例。用后台实际节点 UUID 替换示例键；不要填写节点名称，改名不影响匹配。
3. 正常保存主题设置并刷新主题。不要把整个主题配置替换成仅有回程字段的 API 载荷，Komari 的主题设置接口会覆盖整个配置。沿用官方后台保存完整配置的流程；本主题不直接写库。

```json
{
  "version": 1,
  "nodes": {
    "00000000-0000-4000-8000-000000000001": {
      "manual": {
        "telecom": { "label": "管理员确认的电信线路", "updatedAt": "2026-10-19T08:00:00Z" },
        "unicom": { "label": "管理员确认的联通线路", "updatedAt": "2026-10-19T08:00:00Z" },
        "mobile": { "label": "管理员确认的移动线路", "updatedAt": "2026-10-19T08:00:00Z" }
      }
    }
  }
}
```

这是公开展示数据，**禁止写入密码、Agent token、API key、私人逐跳 IP**。手动名称为 1–80 个非控制字符；支持特殊字符，Vue 以文本渲染。时间为 UTC ISO 字符串；手动旧记录缺少时间显示「时间未提供」，不伪造采集时间。删除某运营商的 manual 项可回退到该运营商自动结果；删除节点项只移除线路配置，不动用户 tags、Ping 任务或节点。

优先级 **manual > 未过期的 auto > 未检测/未知**。自动过期显示「已过期」，不会把旧标签继续当作当前线路；手动覆盖不受自动 TTL 影响。卡片及详情显示相同 UUID 结果、来源和时间。配置错误会明确显示提示，不返回半份“成功”数据。版本 0 的手动字符串值可经解析/序列化迁移为版本 1 的 `{label,updatedAt:null}`，没有名称推测或 tags 自动写回。

## 自动结果消费（已实现，不等于采集）

浏览器没有 Shell、远程 exec 或 traceroute 执行能力。开关「消费已采集的自动结果」默认关闭；若不开伴生连接，只消费上述 JSON 中已有 `auto` 数据。独立助手/插件必须另行安装并按 UUID 明确启用，管理员主题才会经鉴权读取结果；访客不请求自动 API。导入格式：

```json
{
  "direction": "node-to-cn",
  "target": "beijing-telecom",
  "collectedAt": "2026-10-19T08:00:00Z",
  "reachedTarget": true,
  "hops": [
    { "ttl": 1, "asns": [] },
    { "ttl": 2, "asns": [4134] },
    { "ttl": 3, "asns": [4134] }
  ]
}
```

放在 `nodes.<uuid>.auto.telecom`（其它为 unicom/mobile）。这是**协议示例，不是实测数据**。`target` 只接受 Beijing/Shanghai/Guangzhou × telecom/unicom/mobile 九个固定 ID，必须与运营商匹配。只接受 `node-to-cn` 方向，最多 30 个唯一 TTL、每跳最多四个有效整数 ASN；不接收命令、任意地址或 URL。`reachedTarget=false`、多 ASN 单跳、单一响应跳、异常未来时间、未知骨干都保守显示不确定。自动 TTL 默认 24 小时，可设 1–168 小时，页面每分钟刷新时效。

分类参考 Transit 的三网 ASN 词汇：163 / CN2 / CTGNET，4837 / 9929 / 10099，CMNET / CMI / CMIN2。与上游不同，本实现**不以 AS4809 单一 ASN，甚至两个响应跳直接认证 GIA**：只保留 GIA 候选、GT 候选或混合/未知。它不是运营商商业产品证明。旧有 Ping 的 RTT/丢包与此区域完全独立，Transit Relay 的两段 RTT 估算也不作为路由依据。

## 独立采集端与 1.6.0 边界

参考源：`yyy622hhh/komari-theme-transit@ee9f31c5ff104e033ded858171ce0b63c672e878`，MIT。仅参考/改编分类词汇和固定目标，不整体合并主题，不复制官方后台。完整 MIT notice 随主题包位于 `dist/licenses/transit-MIT.txt`，见 THIRD_PARTY。

源码核对 Komari **1.6.0 Tag**：`internal/plugin/context.go` 有 `principal.roles/client_uuid`；插件支持 `allowRoutes`；托管配置按 short 覆盖完整 map。续作又在真实隔离 1.6.0 上实际验证这些 API、ZIP 安装、助手 fixture 回传、浏览器显示及重启持久化；没有把 Transit 的 1.4.x 声明直接当作 1.6.0 兼容证据，也没有以模拟 trace 冒充真实网络采集。

独立伴生插件按 UUID + 固定城市排队，助手主动轮询自己的租约并用安全固定 argv 执行；逐跳 ASN 证据、来源和时间绑定 UUID，具备限流/缓存/TTL/原子持久化。凭据只经 HTTPS 请求体和本地私有文件传递。可安装包和范围说明见新的试用指南；真实网络可达性和系统服务运行仍需后续授权验证。

没有移植旧 `admin:exec`、写回 tags 或自动启用 SSH 路径。只在本地隔离实验中安装独立插件/助手并执行固定 fixture；没有运行真实 traceroute 或连接生产数据库/Agent/VPS。系统服务模板不自动安装/启动。

## 首阶段本地验证（历史）

- 单元/组件 105 项通过；标签/回程 UI、Transit、流量关键回归共 47 项通过，均无跳过或失败。六种亮暗/桌面/手机/mini 场景保存截图，并断言标签区域不重叠、不横向溢出、星标/国旗及既有三网延迟丢包可见。
- 手动配置已验证序列化往返、UUID 隔离、节点改名/页面刷新、手动优先、旧格式迁移、时效和错误提示。保存测试在本地 mock 上验证官方完整 map API 契约及其它设置保留，**未宣称官方后台表单与真实数据库写入已经 E2E 通过**。
- TypeScript、非修复 ESLint、生产构建及 ZIP 内 MIT notice 核查通过。这些本地结果不表示已发布、已部署或已验证自动采集。
