import type { CdnTraceEvidence } from '@/utils/cdnRouteEvidence'
import type { ReturnCarrier, ReturnHop, ReturnTarget } from '@/utils/returnRouteClassification'
import type { AsnLookup, ProbeProtocol } from '@/utils/routeProbeEvidence'
import { parseCdnTrace } from '@/utils/cdnRouteEvidence'
import { classifyReturnRoute, RETURN_CARRIERS, RETURN_TARGETS } from '@/utils/returnRouteClassification'
import { evidenceKeys, parseAsnLookup, parseHopEvidence } from '@/utils/routeProbeEvidence'

export interface ManualReturnRoute { label: string, updatedAt: string | null }
export interface AutoReturnRoute {
  cdn?: CdnTraceEvidence
  protocol?: ProbeProtocol
  family?: 4
  asnLookup?: AsnLookup
  status?: 'ok' | 'unknown' | 'timeout' | 'permission-denied' | 'no-traceroute' | 'probe-failed' | 'output-limit'
  source?: 'helper' | 'fixture' | 'replay'
  direction: 'node-to-cn'
  target: ReturnTarget
  collectedAt: string
  reachedTarget: boolean
  hops: ReturnHop[]
}
export interface NodeReturnRoutes {
  manual: Partial<Record<ReturnCarrier, ManualReturnRoute>>
  auto: Partial<Record<ReturnCarrier, AutoReturnRoute>>
}
export interface ReturnRouteDocument { version: 1, nodes: Record<string, NodeReturnRoutes> }
export interface ReturnRouteConfig { document: ReturnRouteDocument, error: string | null, migrated: boolean }
export interface ReturnRouteDisplay {
  protocolState?: 'single' | 'same' | 'different' | 'partial'
  carrier: ReturnCarrier
  label: string
  status: 'manual' | 'fresh-auto' | 'unknown' | 'expired' | 'not-detected' | 'failed'
  source: 'manual' | 'auto' | 'fixture' | 'replay' | null
  at: string | null
  detail: string
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/
const MAX_CONFIG_CHARS = 262144
const PROBE_ERRORS: Record<string, string> = { 'timeout': '探测超时', 'permission-denied': '权限不足', 'no-traceroute': '未安装 traceroute', 'probe-failed': '探测失败', 'output-limit': '输出超限' }
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('需要 JSON 对象')
  return value as Record<string, unknown>
}
function timestamp(value: unknown): string {
  if (typeof value !== 'string' || !UTC_TIMESTAMP.test(value) || !Number.isFinite(Date.parse(value)))
    throw new Error('时间必须为 UTC ISO 字符串（以 Z 结尾）')
  const normalized = new Date(value).toISOString()
  if (normalized.slice(0, 19) !== value.slice(0, 19))
    throw new Error('采集/更新时间不是有效日期')
  return normalized
}
function manual(value: unknown, legacy: boolean): ManualReturnRoute {
  const data = legacy && typeof value === 'string' ? { label: value, updatedAt: null } : object(value)
  const label = typeof data.label === 'string' ? data.label.trim() : ''
  if (!label || label.length > 80 || Array.from(label).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127))
    throw new Error('手动线路名需要 1–80 个非控制字符')
  return { label, updatedAt: data.updatedAt == null ? null : timestamp(data.updatedAt) }
}
function automatic(value: unknown, carrier: ReturnCarrier): AutoReturnRoute {
  const data = object(value)
  const target = data.target as ReturnTarget
  if (data.status !== undefined && !['ok', 'unknown', ...Object.keys(PROBE_ERRORS)].includes(String(data.status)))
    throw new Error('无效采集状态')
  if (data.source !== undefined && data.source !== 'helper' && data.source !== 'fixture' && data.source !== 'replay')
    throw new Error('无效采集来源')
  if (data.direction !== 'node-to-cn' || typeof target !== 'string' || !Object.hasOwn(RETURN_TARGETS, target) || RETURN_TARGETS[target].carrier !== carrier)
    throw new Error('自动结果必须是本节点向国内对应三网白名单目标的回程')
  if (typeof data.reachedTarget !== 'boolean' || !Array.isArray(data.hops) || data.hops.length > 30)
    throw new Error('自动结果需要 reachedTarget 和最多 30 个逐跳记录')
  const seen = new Set<number>()
  const hops = data.hops.map((value): ReturnHop => {
    const hop = object(value)
    const ttl = hop.ttl
    if (typeof ttl !== 'number' || !Number.isInteger(ttl) || ttl < 1 || ttl > 30 || seen.has(ttl) || !Array.isArray(hop.asns) || hop.asns.length > 4)
      throw new Error('跳数必须唯一且在 1–30 之间，每跳最多 4 个 ASN')
    seen.add(ttl)
    const asns = hop.asns.map((asn) => {
      if (typeof asn !== 'number' || !Number.isInteger(asn) || asn < 1 || asn > 4294967295)
        throw new Error('ASN 必须为有效正整数，不接受命令或 URL')
      return asn
    })
    return parseHopEvidence(hop, { ttl, asns: [...new Set(asns)] })
  }).sort((a, b) => a.ttl - b.ttl)
  let metadata = {}
  const cdn = target.startsWith('hubei-cdn-') ? parseCdnTrace(data.cdn, carrier) : undefined
  if (!cdn && data.cdn !== undefined)
    throw new Error('固定目标不能附带 CDN 覆写')
  if (cdn && (Date.parse(cdn.resolvedAt) > Date.parse(String(data.collectedAt)) || Date.parse(String(data.collectedAt)) - Date.parse(cdn.resolvedAt) > 300000))
    throw new Error('DNS 解析快照不在采集时间内')
  if (data.protocol !== undefined || data.family !== undefined || data.asnLookup !== undefined) {
    evidenceKeys(data, ['protocol', 'family', 'asnLookup', 'status', 'source', 'direction', 'target', 'collectedAt', 'reachedTarget', 'hops', 'cdn'])
    if ((data.protocol !== 'tcp' && data.protocol !== 'udp') || data.family !== 4 || !hops.every(h => h.ttl <= 20 && h.ips !== undefined && h.asnSource !== undefined))
      throw new Error('仅支持显式 IPv4 TCP/UDP 证据')
    const asnLookup = parseAsnLookup(data.asnLookup)
    if (hops.some(h => h.asnSource === 'team-cymru') && !asnLookup.enabled)
      throw new Error('Cymru 来源需要外部查询启用记录')
    if (data.reachedTarget && !hops.some(h => h.ips?.includes(cdn?.selectedIPv4 ?? RETURN_TARGETS[target].address)))
      throw new Error('目标到达状态缺少响应证据')
    if (data.status === 'ok' && (!data.reachedTarget || !hops.some(h => h.asns.length)))
      throw new Error('成功状态缺少目标或 ASN 证据')
    metadata = { protocol: data.protocol, family: 4, asnLookup, ...(cdn ? { cdn } : {}) }
  }
  return { direction: 'node-to-cn', target, collectedAt: timestamp(data.collectedAt), reachedTarget: data.reachedTarget, hops, ...metadata, ...(data.status ? { status: data.status as AutoReturnRoute['status'] } : {}), ...(data.source ? { source: data.source as AutoReturnRoute['source'] } : {}) }
}

export function parseReturnRouteConfig(raw: unknown): ReturnRouteConfig {
  const empty: ReturnRouteDocument = { version: 1, nodes: {} }
  if (raw === undefined || raw === null || raw === '')
    return { document: empty, error: null, migrated: false }
  try {
    if (typeof raw === 'string' && raw.length > MAX_CONFIG_CHARS)
      throw new Error('配置超过 256 Ki 字符限制')
    const data = object(typeof raw === 'string' ? JSON.parse(raw) : raw)
    if (data.version !== 1 && data.version !== 0)
      throw new Error('不支持的回程配置版本')
    const entries = Object.entries(object(data.nodes))
    if (entries.length > 2000)
      throw new Error('回程配置最多 2000 个节点')
    const nodes: ReturnRouteDocument['nodes'] = {}
    for (const [uuid, value] of entries) {
      if (!UUID.test(uuid))
        throw new Error('节点键必须是 UUID，不能使用名称')
      const node = object(value)
      const result: NodeReturnRoutes = { manual: {}, auto: {} }
      const manualData = node.manual === undefined ? {} : object(node.manual)
      const autoData = node.auto === undefined ? {} : object(node.auto)
      if ([...Object.keys(manualData), ...Object.keys(autoData)].some(key => !RETURN_CARRIERS.includes(key as ReturnCarrier)))
        throw new Error('运营商键只支持 telecom、unicom、mobile')
      for (const carrier of RETURN_CARRIERS) {
        if (manualData[carrier] !== undefined)
          result.manual[carrier] = manual(manualData[carrier], data.version === 0)
        if (autoData[carrier] !== undefined)
          result.auto[carrier] = automatic(autoData[carrier], carrier)
      }
      nodes[uuid] = result
    }
    return { document: { version: 1, nodes }, error: null, migrated: data.version === 0 }
  }
  catch (error) {
    // Never return partially trusted data or echo the raw setting into the UI.
    const message = error instanceof SyntaxError ? 'JSON 格式错误' : error instanceof Error ? error.message : '无效配置'
    return { document: empty, error: message, migrated: false }
  }
}

export function serializeReturnRoutes(document: ReturnRouteDocument): string {
  const parsed = parseReturnRouteConfig(document)
  if (parsed.error)
    throw new Error(parsed.error)
  return JSON.stringify(parsed.document, null, 2)
}

export function resolveReturnRoutes(document: ReturnRouteDocument, uuid: string, autoEnabled: boolean, ttlHours: number, now = Date.now()): ReturnRouteDisplay[] {
  const node = document.nodes[uuid]
  const ttl = Math.min(168, Math.max(1, Number.isFinite(ttlHours) ? ttlHours : 24)) * 3600000
  return RETURN_CARRIERS.map((carrier) => {
    const base: ReturnRouteDisplay = { carrier, label: '未检测', status: 'not-detected', source: null, at: null, detail: '没有启用或提供回程采集结果；不使用 Ping RTT 推断线路' }
    const override = node?.manual[carrier]
    if (override)
      return { ...base, label: override.label, status: 'manual', source: 'manual', at: override.updatedAt, detail: '管理员手动标注，优先于自动结果；不是自动测量认证' }
    const observed = autoEnabled ? node?.auto[carrier] : undefined
    if (!observed)
      return base
    const source = observed.source === 'fixture' ? 'fixture' : observed.source === 'replay' ? 'replay' : 'auto'
    const age = now - Date.parse(observed.collectedAt)
    if (!Number.isFinite(age) || age < -300000)
      return { ...base, label: '未知', status: 'unknown', source, at: observed.collectedAt, detail: '采集时间异常；未采用此结果' }
    if (age >= ttl)
      return { ...base, label: '已过期', status: 'expired', source, at: observed.collectedAt, detail: '超过 TTL，旧线路不作为当前结果' }
    if (observed.status && PROBE_ERRORS[observed.status])
      return { ...base, label: PROBE_ERRORS[observed.status]!, status: 'failed', source, at: observed.collectedAt, detail: '采集失败，不以历史记录或 Ping RTT 冒充当前线路' }
    const classified = classifyReturnRoute(carrier, observed.hops, observed.reachedTarget)
    return { ...base, label: classified.label, status: classified.confidence === 'uncertain' || observed.status === 'unknown' ? 'unknown' : 'fresh-auto', source, at: observed.collectedAt, detail: `${observed.target} · ${classified.evidence} · ${classified.confidence}；非运营商产品保证` }
  })
}
