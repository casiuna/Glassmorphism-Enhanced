# CDN 目标与历史实测回放（v1.2.1 本地候选）

Theme 1.2.1、Plugin 0.3.0、Helper 0.3.0 的本地未提交扩展。schema1/schema2 不变；仅已批准的 CDN 采集使用 schema3。本文不授权任何生产安装、探测或部署。

## 双端白名单

仅允许经源码审查的 `hubei-cdn` 目录，域名不可改成任意 IP、URL、后缀近似域名或 Shell。Plugin 的管理员 `cdnTargets` 配置与 Helper 私有配置中的同名对象必须完全一致：

```json
{
  "hubei-cdn": {
    "telecom": { "hostname": "hb-ct-v4.ip.zstaticcdn.com", "udpPort": 80, "tcpPort": 80 },
    "unicom": { "hostname": "hb-cu-v4.ip.zstaticcdn.com", "udpPort": 80, "tcpPort": 80 },
    "mobile": { "hostname": "hb-cm-v4.ip.zstaticcdn.com", "udpPort": 80, "tcpPort": 80 }
  }
}
```

- 默认 `{}`，不批准 CDN。审核目录内只允许整数端口80/443，不能借此传入任意端口。
- Plugin 节点策略 `city: "hubei-cdn"` 必须有上述管理员批准对象。Helper 本地还要显式配置相同白名单和 `probeProtocols: ["udp", "tcp"]`，不能以远端策略代替本地批准。
- job 只包含目录ID与规范化绑定，不接受远端 IP、DNS 地址、任意域名或命令。Helper 比较本地绑定后才允许本地解析；策略变更会取消原 lease。
- 实时模式通过受超时控制的源 VPS 系统 IPv4 resolver 解析一次。混入私网、loopback、链路本地、CGNAT、组播、保留地址或重复/过量答案时整体拒绝；两协议固定同一选定IPv4，不重新解析、不静默回退。
- 固定目标 TCP443 默认不变。CDN目的端口进入 profile、lease、DNS快照与每协议 capture 证据；UDP使用固定目的端口 `-U`，不是递增端口。
- 仍保持每条20跳/25秒、单批6条、单节点持久冷却60秒、全局并发4、lease180秒、任务TTL10分钟、最小周期60分钟。DNS每个名称最多8秒，结果不进入Shell。

## schema3 与历史回放

schema3 在独立TCP/UDP跳表之外保留：`targetBinding`、每运营商DNS答案与解析时间、固定选中IP、每协议目的端口/命令退出码/执行状态/原文SHA256，以及原始采集UUID、实验ID、时间。未知线路不等于命令失败；退出0不等于到达，更不等于ASN分类成功。

本次输入是 `test-results/v121/nerwen-real-trial/hubei-cdn-v1/` 六份真实原文。原始采集时间2026-11-13 03:07–03:08 UTC不能改成导入时间。Helper通过显式本地 `--once --replay-dir` 重新解析并校验，输出 `source: "replay"`，不是fixture也不是新网络探测。重放目录必须owner-only且无符号链接；原文hash、解析跳表、到达、状态、ASN统计和逐协议采集时间必须与原记录相符。

`--replay-dir` 仅允许本地literal loopback配置、一次性执行、不能混用fixture；不解析DNS、不执行traceroute、不查询ASN、不发送Agent请求。示意：

```bash
python3 companion/helper/enhanced_route_helper.py \
  --config /absolute/private/isolated-helper.json --once \
  --replay-dir /absolute/private/hubei-cdn-v1
```

上述输出由已认证管理员在采集策略**关闭**且该CDN目录已批准时，通过现有 `restore-node` 导入隔离 Komari。导入时只映射本地测试节点UUID/正式目录ID，`captureOrigin` 保留原实验UUID/ID；原始IP、跳表、采集时间、到达状态、ASN和原文hash不改。

正常 Agent `/result` 仍保留原有UUID、lease与五分钟新鲜度检查，并明确拒绝 `source: replay`。不能将历史回放改时间后冒充实时上传。实时CDN分支的DNS/命令构造只做无网络单元验证，本轮不重跑真实网络探测。

## Theme 与权限

管理员可以读取六条独立路径、历史实测来源、DNS/端口、退出码、到达和ASN统计；前台未知/过期/协议分歧/回放结果不生成确认线路标签。管理员手动值优先且独立于原始证据。匿名访客不请求或获得私有快照及逐跳信息。

后续用户已选择独立文字方案并提出最终修改：节点卡片只显示红/蓝/绿小圆点和完整线路名，无“回程”或运营商可见文字，不使用省略截断；不足时换行。NodeCard已移除旧A/B预览分支，原预览URL不再切换布局。旧截图仅作历史保留；原监控、流量、价格、独立计费周期与三网Ping数据链不变。

## 未来 ASN 补全所需的最小授权（本轮未执行）

需要用户另行同意，并在本地明确设置 `cymruEnabled=true` 与 `cymruConsent=true`，不能由Plugin远端开启。本轮两者保持false，未用traceroute -A。

最小范围可以限于现有六条记录中的逐跳**公网 IPv4**，在本地单次调用现有受限查询器：最多8次外部查询、每次最多2秒，不再探测VPS、不修改生产或安装服务；只向Team Cymru披露待查公网IP，不发送节点Token、UUID、完整路径或隐藏节点资料。当前成功缓存1小时，失败缓存5分钟。若8次预算内仍不足，保持未知，不自动增加次数。

返回的ASN仍要按逐跳顺序、缺失跳和目标到达判读；不能认证CN2 GIA等商业线路。原始路径与后续ASN查询的时间/来源必须分别保留。

## 回退与验收范围

本轮没有生产变更，无需生产回滚。先移除对应节点的CDN调度策略，再清空双端CDN白名单即可阻止新CDN任务；旧固定目标和schema1/schema2仍能读取，历史schema3缓存仍保留为管理员证据。关闭线路展示可隐藏最终摘要，不覆盖手动数据和后台证据。

所有新旧失败日志和真实原文保留在私有test-results目录。构建、打包及局部浏览器通过不等于正式Release；禁止dirty Full公网安装，未经用户选择UI与发布授权不提交、推送、打Tag或更新市场。
