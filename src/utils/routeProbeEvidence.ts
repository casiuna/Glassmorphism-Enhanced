// SPDX-License-Identifier: MIT
import type { ReturnHop } from '@/utils/returnRouteClassification'

export type ProbeProtocol = 'udp' | 'tcp'
export interface AsnLookup { enabled: boolean, queries: number, cacheHits: number, failures: number }
const V4_PART = /^(?:0|[1-9]\d{0,2})$/
const HINTS = { CN2: '59.43.', 163: '202.97.', CMI: '223.120.' }
export function isProbeIPv4(ip: unknown): ip is string {
  return typeof ip === 'string' && ip.split('.').length === 4 && ip.split('.').every(p => V4_PART.test(p) && Number(p) <= 255)
}
export function evidenceKeys(value: unknown, allowed: readonly string[]): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !allowed.includes(k)))
    throw new Error('无效的回程证据字段')
}
export function parseHopEvidence(value: Record<string, unknown>, base: ReturnHop): ReturnHop {
  if (value.ips === undefined && value.asnSource === undefined && value.prefixHints === undefined)
    return base
  evidenceKeys(value, ['ttl', 'asns', 'ips', 'asnSource', 'prefixHints'])
  if (Array.isArray(value.asns) && new Set(value.asns).size !== value.asns.length)
    throw new Error('逐跳实际 ASN 不得重复')
  const ips = value.ips
  const source = value.asnSource
  if (!Array.isArray(ips) || ips.length > 4 || !ips.every(isProbeIPv4) || new Set(ips).size !== ips.length || !['none', 'traceroute', 'team-cymru'].includes(String(source)) || (base.asns.length ? source === 'none' || !ips.length : source !== 'none'))
    throw new Error('无效的 IPv4 / ASN 来源')
  const hints = value.prefixHints
  if (hints !== undefined) {
    if (base.asns.length || !Array.isArray(hints) || hints.length > 3 || new Set(hints).size !== hints.length || !hints.every(h => typeof h === 'string' && Object.hasOwn(HINTS, h) && ips.some(ip => ip.startsWith(HINTS[h as keyof typeof HINTS]))))
      throw new Error('IP 前缀仅能作为低置信度提示，不能替代真实 ASN')
  }
  return { ...base, ips: [...ips], asnSource: source as ReturnHop['asnSource'], ...(hints ? { prefixHints: [...hints as NonNullable<ReturnHop['prefixHints']>] } : {}) }
}
export function parseAsnLookup(value: unknown): AsnLookup {
  evidenceKeys(value, ['enabled', 'queries', 'cacheHits', 'failures'])
  if (typeof value.enabled !== 'boolean' || !['queries', 'cacheHits', 'failures'].every(k => typeof value[k] === 'number' && Number.isInteger(value[k]) && Number(value[k]) >= 0 && Number(value[k]) <= 80) || (!value.enabled && ['queries', 'cacheHits', 'failures'].some(k => value[k] !== 0)))
    throw new Error('外部 ASN 查询统计无效')
  return { enabled: value.enabled, queries: Number(value.queries), cacheHits: Number(value.cacheHits), failures: Number(value.failures) }
}
