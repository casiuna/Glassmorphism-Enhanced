import type { ReturnCarrier } from '@/utils/returnRouteClassification'
import type { ProbeProtocol } from '@/utils/routeProbeEvidence'
import { RETURN_CARRIERS } from '@/utils/returnRouteClassification'
import { evidenceKeys, isProbeIPv4 } from '@/utils/routeProbeEvidence'

export const CDN_ID = 'hubei-cdn'
const RAW_HASH = /^[a-f0-9]{64}$/
const UTC_TIME = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/
export const CDN_HOSTS = { telecom: 'hb-ct-v4.ip.zstaticcdn.com', unicom: 'hb-cu-v4.ip.zstaticcdn.com', mobile: 'hb-cm-v4.ip.zstaticcdn.com' } as const
export interface CdnTarget { hostname: string, udpPort: number, tcpPort: number }
export type CdnProfile = Record<ReturnCarrier, CdnTarget>
export interface CdnTraceEvidence { hostname: string, addresses: string[], selectedIPv4: string, resolvedAt: string, port: number, exitCode: number | null, executionStatus: string, rawSha256: string }
export function publicCdnIPv4(value: unknown): value is string {
  if (!isProbeIPv4(value))
    return false
  const [a, b, c] = value.split('.').map(Number) as [number, number, number, number]
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) || (a === 203 && b === 0 && c === 113))
}
export function parseCdnProfiles(raw: unknown): Partial<Record<typeof CDN_ID, CdnProfile>> {
  const value = typeof raw === 'string' ? JSON.parse(raw) : raw ?? {}
  evidenceKeys(value, [CDN_ID])
  for (const profile of Object.values(value)) {
    evidenceKeys(profile, RETURN_CARRIERS)
    for (const carrier of RETURN_CARRIERS) {
      const row = profile[carrier]
      evidenceKeys(row, ['hostname', 'udpPort', 'tcpPort'])
      if (row.hostname !== CDN_HOSTS[carrier] || ![row.udpPort, row.tcpPort].every(p => typeof p === 'number' && Number.isInteger(p) && [80, 443].includes(p)))
        throw new Error('CDN 目标必须位于管理员审核目录，端口仅 80/443')
    }
  }
  return value as Partial<Record<typeof CDN_ID, CdnProfile>>
}
export function cdnBinding(profile: CdnProfile): string {
  return JSON.stringify(RETURN_CARRIERS.map(c => [c, profile[c].hostname, profile[c].udpPort, profile[c].tcpPort]))
}
export function parseCdnBinding(value: unknown): CdnProfile {
  if (typeof value !== 'string' || value.length > 512)
    throw new Error('无效 CDN 绑定')
  const rows = JSON.parse(value) as unknown
  if (!Array.isArray(rows) || rows.length !== 3 || !rows.every((r, i) => Array.isArray(r) && r.length === 4 && r[0] === RETURN_CARRIERS[i]))
    throw new Error('无效 CDN 绑定')
  const profile = Object.fromEntries(rows.map(r => [r[0], { hostname: r[1], udpPort: r[2], tcpPort: r[3] }])) as CdnProfile
  parseCdnProfiles({ [CDN_ID]: profile })
  if (cdnBinding(profile) !== value)
    throw new Error('CDN 绑定必须规范化')
  return profile
}
export function parseCdnTrace(value: unknown, carrier: ReturnCarrier): CdnTraceEvidence {
  evidenceKeys(value, ['hostname', 'addresses', 'selectedIPv4', 'resolvedAt', 'port', 'exitCode', 'executionStatus', 'rawSha256'])
  if (value.hostname !== CDN_HOSTS[carrier] || !Array.isArray(value.addresses) || value.addresses.length < 1 || value.addresses.length > 16 || new Set(value.addresses).size !== value.addresses.length || !value.addresses.every(publicCdnIPv4) || typeof value.selectedIPv4 !== 'string' || !value.addresses.includes(value.selectedIPv4) || ![80, 443].includes(Number(value.port)) || typeof value.port !== 'number' || typeof value.rawSha256 !== 'string' || !RAW_HASH.test(value.rawSha256) || !['ok', 'timeout', 'permission-denied', 'no-traceroute', 'probe-failed', 'output-limit'].includes(String(value.executionStatus)) || (value.exitCode === null ? value.executionStatus === 'ok' : typeof value.exitCode !== 'number' || !Number.isInteger(value.exitCode) || value.exitCode < -255 || value.exitCode > 255) || (value.executionStatus === 'ok' && value.exitCode !== 0))
    throw new Error('无效 CDN DNS、端口或退出码证据')
  if (typeof value.resolvedAt !== 'string' || !UTC_TIME.test(value.resolvedAt) || !Number.isFinite(Date.parse(value.resolvedAt)) || new Date(value.resolvedAt).toISOString().slice(0, 19) !== value.resolvedAt.slice(0, 19))
    throw new Error('无效 DNS 解析时间')
  return value as unknown as CdnTraceEvidence
}
export function cdnTraceFromSnapshot(latest: Record<string, unknown>, carrier: ReturnCarrier, protocol: ProbeProtocol): CdnTraceEvidence {
  const profile = parseCdnBinding(latest.targetBinding)
  evidenceKeys(latest.dns, RETURN_CARRIERS)
  evidenceKeys(latest.captures, RETURN_CARRIERS)
  const dns = latest.dns[carrier]
  const captures = latest.captures[carrier]
  evidenceKeys(dns, ['hostname', 'addresses', 'selectedIPv4', 'resolvedAt'])
  evidenceKeys(captures, ['udp', 'tcp'])
  const meta = captures[protocol]
  evidenceKeys(meta, ['port', 'exitCode', 'executionStatus', 'rawSha256'])
  if (meta.port !== profile[carrier][`${protocol}Port`])
    throw new Error('CDN 端口未绑定管理员策略')
  return parseCdnTrace({ ...dns, ...meta }, carrier)
}
