import type { ReturnCarrier, ReturnHop } from '../../src/utils/returnRouteClassification'
import type { AutoReturnRoute } from '../../src/utils/returnRoutes'
import type { ProbeProtocol } from '../../src/utils/routeProbeEvidence'
import { createRequire } from 'node:module'
import { expect, test } from '@playwright/test'
import { classifyReturnRoute } from '../../src/utils/returnRouteClassification'
import { compactReturnRoute } from '../../src/utils/returnRouteDisplay'
import { parseReturnRouteConfig, resolveReturnRoutes } from '../../src/utils/returnRoutes'
import { parseProbeSnapshot, protocolEvidenceGroups, protocolRouteDisplay, withProbeResults } from '../../src/utils/routeProbeSnapshot'

interface Fixture { schema: number, uuid: string, city: string, source: string, collectedAt: string, protocols: ProbeProtocol[], carriers: Record<ReturnCarrier, Record<ProbeProtocol, AutoReturnRoute>> }
const require = createRequire(import.meta.url)
const { fixtureV2, invalidV2 } = require('../companion/probe-v2-fixture.cjs') as { fixtureV2: (at?: string) => Fixture, invalidV2: Array<[string, (r: Fixture) => void]> }
const { normalizeResult } = require('../../companion/enhanced-route-probe/protocol.cjs')

const AT = '2026-07-25T11:00:00.000Z'
const NOW = Date.parse(AT) + 1000
const BASE = fixtureV2(AT)
const UUID = BASE.uuid
const snapshot = (latest = structuredClone(BASE)) => ({ schema: 1, nodes: { [UUID]: { enabled: true, state: 'fixture-complete', seenAt: NOW, latest } } })
const parse = (latest = structuredClone(BASE)) => parseProbeSnapshot(snapshot(latest)).nodes[UUID]!

for (const [name, mutate] of invalidV2) {
  test(`helper/plugin/frontend reject invalid schema2 contract: ${name}`, () => {
    const value = structuredClone(BASE)
    mutate(value)
    expect(() => normalizeResult(value, UUID, 'beijing', Date.parse(AT))).toThrow()
    expect(() => parse(value)).toThrow()
  })
}
test('real Python-parser fixture retains separate protocols, real ASN provenance and hidden hop', () => {
  const node = parse()
  expect(node.protocols!.telecom!.udp!.hops).not.toEqual(node.protocols!.telecom!.tcp!.hops)
  expect(node.protocols!.mobile!.udp!.hops[1]).toEqual({ ttl: 2, ips: [], asns: [], asnSource: 'none' })
  expect(node.protocols!.mobile!.tcp!.hops[0]).toMatchObject({ asns: [], asnSource: 'none', prefixHints: ['CMI'] })
  expect(node.auto.telecom).toMatchObject({ hops: [], status: 'unknown', reachedTarget: false })
})
for (const protocol of ['udp', 'tcp'] as const) {
  test(`frontend supports ${protocol} alone without inventing second protocol`, () => {
    const data = structuredClone(BASE)
    data.protocols = [protocol]
    for (const carrier of ['telecom', 'unicom', 'mobile'] as const)
      data.carriers[carrier] = { [protocol]: data.carriers[carrier][protocol] } as Fixture['carriers'][ReturnCarrier]
    const node = parse(data)
    expect(Object.keys(node.protocols!.telecom!)).toEqual([protocol])
    expect(node.auto.telecom!.hops).toEqual(node.protocols!.telecom![protocol]!.hops)
    expect(protocolEvidenceGroups(UUID, node.protocols!, 24, NOW)[0]!.summary.protocolState).toBe('single')
  })
}
test('different paths remain an explicit unknown result; identical paths are not commercial certification', () => {
  const node = parse()
  const merged = withProbeResults({ version: 1, nodes: {} }, UUID, parseProbeSnapshot(snapshot()))
  const initial = resolveReturnRoutes(merged, UUID, true, 24, NOW)
  const telecom = protocolRouteDisplay(UUID, initial[0]!, node.protocols!.telecom!, 24, NOW)
  expect(telecom).toMatchObject({ status: 'unknown', protocolState: 'different', label: 'TCP/UDP 路径不同', source: 'fixture' })
  expect(compactReturnRoute(telecom)).toBe('协议分歧')
  const unicom = protocolRouteDisplay(UUID, initial[1]!, node.protocols!.unicom!, 24, NOW)
  expect(unicom.protocolState).toBe('same')
  expect(unicom.label).toBe('10099 → 4837 混合')
  expect(unicom.detail).toContain('不代表商业线路认证')
})
test('same ASN label but different IP path is still a protocol disagreement', () => {
  const node = parse()
  node.protocols!.unicom!.tcp!.hops[0]!.ips = ['162.245.124.2']
  const group = protocolEvidenceGroups(UUID, node.protocols!, 24, NOW).find(g => g.carrier === 'unicom')!
  expect(group.rows[0]!.display.label).toEqual(group.rows[1]!.display.label)
  expect(group.summary.protocolState).toBe('different')
})
test('per-protocol TTL boundaries and permission failure do not reuse the other path', () => {
  const node = parse()
  const paths = node.protocols!.unicom!
  paths.tcp!.collectedAt = new Date(Date.parse(AT) - 1).toISOString()
  const base = resolveReturnRoutes({ version: 1, nodes: {} }, UUID, true, 1, NOW)[1]!
  expect(protocolRouteDisplay(UUID, base, paths, 1, Date.parse(AT) + 3599999)).toMatchObject({ status: 'unknown', protocolState: 'partial' })
  expect(protocolRouteDisplay(UUID, base, paths, 1, Date.parse(AT) + 3600000)).toMatchObject({ status: 'expired', label: '已过期' })
  paths.tcp!.collectedAt = AT
  paths.tcp!.status = 'permission-denied'
  paths.tcp!.hops = []
  paths.tcp!.reachedTarget = false
  expect(protocolRouteDisplay(UUID, base, paths, 24, NOW)).toMatchObject({ status: 'unknown', protocolState: 'partial' })
})
test('manual UUID override and newer saved data remain authoritative', () => {
  const document = parseReturnRouteConfig({ version: 1, nodes: { [UUID]: { manual: { telecom: { label: '我的 手动线路', updatedAt: AT } } } } }).document
  const merged = withProbeResults(document, UUID, parseProbeSnapshot(snapshot()))
  const manual = resolveReturnRoutes(merged, UUID, true, 24, NOW)[0]!
  expect(protocolRouteDisplay(UUID, manual, parse().protocols!.telecom!, 24, NOW)).toEqual(manual)
  expect(manual.label).toBe('我的 手动线路')
  const data = snapshot()
  data.nodes[UUID]!.enabled = false
  expect(withProbeResults(document, UUID, parseProbeSnapshot(data))).toBe(document)
  const saved = parse().protocols!.telecom!.tcp!
  saved.collectedAt = new Date(NOW + 1000).toISOString()
  document.nodes[UUID]!.auto.telecom = saved
  expect(withProbeResults(document, UUID, parseProbeSnapshot(snapshot())).nodes[UUID]!.auto.telecom).toBe(saved)
})
test('failed ASN enrichment remains unknown and prefix evidence never becomes real ASN', () => {
  const value = structuredClone(BASE)
  value.carriers.mobile.tcp.asnLookup = { enabled: true, queries: 1, cacheHits: 0, failures: 1 }
  const row = parse(value).protocols!.mobile!.tcp!
  const classification = classifyReturnRoute('mobile', row.hops, row.reachedTarget)
  expect(classification).toMatchObject({ confidence: 'uncertain', label: '疑似 CMI（仅 IP 前缀，非 ASN）' })
  expect(row.hops.every((h: ReturnHop) => !h.asns.length)).toBe(true)
})
test('one unknown protocol cannot be promoted by an identical successful path', () => {
  const paths = parse().protocols!.unicom!
  paths.tcp!.status = 'unknown'
  const group = protocolEvidenceGroups(UUID, { unicom: paths }, 24, NOW)[0]!
  expect(group.summary.status).toBe('unknown')
  expect(group.summary.protocolState).toBe('same')
})
for (const [carrier, sequence, label] of [
  ['telecom', [4134, 4809], 'CN2 GT 候选 / 163 混合'],
  ['telecom', [4809, 4134], 'CN2 → 163 混合'],
  ['telecom', [23764, 23764], 'CTGNET'],
  ['unicom', [10099, 4837], '10099 → 4837 混合'],
  ['unicom', [4837, 10099], '4837 → 10099 混合'],
  ['unicom', [10099, 4837, 10099], '10099 → 4837 → 10099 混合'],
  ['mobile', [58807, 58453, 9808], 'CMIN2 → CMI → CMNET 混合'],
] as const) {
  test(`ordered path, not ASN membership: ${sequence.join('->')}`, () => {
    const hops = sequence.map((asn, i) => ({ ttl: i + 1, asns: [asn] }))
    expect(classifyReturnRoute(carrier, [...hops].reverse(), true).label).toBe(label)
  })
}
test('hidden hops, repeated router and ambiguous same-TTL ASNs cannot prove GIA', () => {
  const hops: ReturnHop[] = [{ ttl: 1, asns: [4809], ips: ['59.43.1.1'] }, { ttl: 2, asns: [4809], ips: ['59.43.1.1'] }]
  expect(classifyReturnRoute('telecom', hops, true).label).toBe('CN2（不确定）')
  hops[1]!.ips = ['59.43.1.2']
  expect(classifyReturnRoute('telecom', hops, true).label).toBe('CN2（GIA 候选，未认证）')
  expect(classifyReturnRoute('telecom', [...hops, { ttl: 3, asns: [] }], true).label).not.toContain('GIA')
  expect(classifyReturnRoute('telecom', [{ ttl: 1, asns: [4809, 4134] }, hops[1]!], true).confidence).toBe('uncertain')
})
