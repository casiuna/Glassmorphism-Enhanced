import type { ReturnCarrier } from '@/utils/returnRouteClassification'
import type { ProbeNode } from '@/utils/routeProbeSnapshot'
import { CDN_ID, parseCdnProfiles } from '@/utils/cdnRouteEvidence'
import { RETURN_CARRIERS } from '@/utils/returnRouteClassification'
import { parseReturnRouteConfig, serializeReturnRoutes } from '@/utils/returnRoutes'

export const PROBE_SHORT = 'enhanced-route-probe'
export const THEME_SHORT = 'Enhanced'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const PROBE_CITIES = ['beijing', 'shanghai', 'guangzhou', 'hubei', CDN_ID] as const
export interface NodeProbePolicy { enabled: boolean, city: string, periodMinutes: number }
export interface ProbePolicy { enabled: boolean, nodes: Record<string, NodeProbePolicy>, cdnTargets?: ReturnType<typeof parseCdnProfiles> }
export interface ManagementDraft {
  uuid: string
  globalEnabled: boolean
  nodeEnabled: boolean
  city: string
  periodMinutes: number
  ttlHours: number
  displayEnabled: boolean
  manual: Record<ReturnCarrier, string>
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('需要有效配置对象')
  return value as Record<string, unknown>
}
export function stableValue(value: unknown): string {
  if (Array.isArray(value))
    return `[${value.map(stableValue).join(',')}]`
  if (value && typeof value === 'object')
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${stableValue(v)}`).join(',')}}`
  return JSON.stringify(value) ?? 'null'
}
export function parseProbePolicy(raw: Record<string, unknown>): ProbePolicy {
  const nodes = record(typeof raw.nodes === 'string' ? JSON.parse(raw.nodes) : raw.nodes ?? {})
  const cdnTargets = parseCdnProfiles(raw.cdnTargets)
  if (Object.keys(nodes).length > 200 || Object.keys(raw).some(k => !['enabled', 'nodes', 'cdnTargets'].includes(k)))
    throw new Error('插件配置不兼容，需在官方后台检查')
  for (const [uuid, value] of Object.entries(nodes)) {
    const node = record(value)
    if (!UUID.test(uuid) || typeof node.enabled !== 'boolean' || !PROBE_CITIES.includes(node.city as typeof PROBE_CITIES[number]) || !Number.isInteger(node.periodMinutes) || Number(node.periodMinutes) < 60 || Number(node.periodMinutes) > 10080 || Object.keys(node).some(k => !['enabled', 'city', 'periodMinutes'].includes(k)))
      throw new Error('插件策略需要有效 UUID、固定城市及 60–10080 分钟周期')
    if (node.city === CDN_ID && !cdnTargets[CDN_ID])
      throw new Error('请先在 Plugin 和 Helper 本地双端配置 CDN 白名单')
  }
  return { enabled: raw.enabled === true, nodes: nodes as unknown as ProbePolicy['nodes'], ...(raw.cdnTargets !== undefined ? { cdnTargets } : {}) }
}
export function managementChanges(settings: Record<string, unknown>, config: Record<string, unknown>, draft: ManagementDraft, at = new Date().toISOString()) {
  const policy = parseProbePolicy(config)
  if (!UUID.test(draft.uuid) || !PROBE_CITIES.includes(draft.city as typeof PROBE_CITIES[number]) || !Number.isInteger(draft.periodMinutes) || draft.periodMinutes < 60 || draft.periodMinutes > 10080 || !Number.isInteger(draft.ttlHours) || draft.ttlHours < 1 || draft.ttlHours > 168)
    throw new Error('请检查节点 UUID、城市、周期或 TTL')
  const parsed = parseReturnRouteConfig(settings.returnRouteConfig)
  if (parsed.error)
    throw new Error('原有手动线路配置无效；不会覆盖，请先在官方后台修复')
  const document = structuredClone(parsed.document)
  const node = document.nodes[draft.uuid] ?? { manual: {}, auto: {} }
  for (const carrier of RETURN_CARRIERS) {
    const label = draft.manual[carrier].trim()
    if (!label) {
      delete node.manual[carrier]
    }
    else if (label !== node.manual[carrier]?.label) {
      node.manual[carrier] = { label, updatedAt: at }
    }
  }
  document.nodes[draft.uuid] = node
  const serialized = serializeReturnRoutes(document)
  const plugin = { ...config, enabled: draft.globalEnabled, nodes: JSON.stringify({ ...policy.nodes, [draft.uuid]: { enabled: draft.nodeEnabled, city: draft.city, periodMinutes: draft.periodMinutes } }) }
  parseProbePolicy(plugin)
  return {
    theme: { ...settings, returnRoutesVisible: draft.displayEnabled, returnRouteAutoEnabled: draft.displayEnabled, returnRouteCompanionEnabled: draft.displayEnabled, returnRouteTtlHours: draft.ttlHours, returnRouteConfig: serialized },
    plugin,
  }
}
export function helperPresence(node: ProbeNode | undefined, now: number): string {
  if (!node?.seenAt)
    return node?.registeredAt ? 'Helper 已登记，尚未轮询' : '未登记 Helper'
  if (node.seenAt > now + 60000 || now - node.seenAt > 90000)
    return 'Helper 离线或心跳已过期'
  return node.helperVersion ? 'Helper 在线' : '旧版 Helper 在线（版本未上报）'
}
export function nodeBootstrapCommand(panel: string, uuid: string): string {
  if (!UUID.test(uuid))
    return ''
  const url = new URL(panel)
  if (url.origin !== panel || !['https:', 'http:'].includes(url.protocol))
    return ''
  const quote = (value: string) => `'${value.replaceAll('\'', '\'\\\'\'')}'`
  const local = ['127.0.0.1', '[::1]'].includes(url.hostname)
  if (url.protocol === 'http:' && !local)
    return '此面板未使用 HTTPS，拒绝生成会传递节点凭据的接入命令。'
  return `python3 manage.py node --panel ${quote(panel)} --uuid ${quote(uuid)}${local && url.protocol === 'http:' ? ' --allow-loopback-http' : ''} \\\n  --agent-config '/absolute/private/node-agent.json' \\\n  --prefix '/absolute/owned/helper-VERSION' --state-dir '/absolute/private/helper-state'`
}
