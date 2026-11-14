import { expect, test } from '@playwright/test'
import { CDN_HOSTS, cdnBinding, parseCdnProfiles, publicCdnIPv4 } from '@/utils/cdnRouteEvidence'
import { parseProbePolicy } from '@/utils/enhancedManagement'
import { summaryReturnRoutes } from '@/utils/returnRouteDisplay'
import { returnRoutePreviewLayout } from '@/utils/returnRoutePreview'
import { parseReturnRouteConfig, resolveReturnRoutes } from '@/utils/returnRoutes'
import { parseProbeSnapshot, protocolEvidenceGroups, withProbeResults } from '@/utils/routeProbeSnapshot'

const UUID = '00000000-0000-4000-8000-000000000001'
const AT = '2026-11-13T03:08:52.146Z'
const NOW = Date.parse(AT)
const carriers = ['telecom', 'unicom', 'mobile'] as const
const profile = Object.fromEntries(carriers.map(c => [c, { hostname: CDN_HOSTS[c], udpPort: 80, tcpPort: 80 }])) as Record<typeof carriers[number], { hostname: string, udpPort: number, tcpPort: number }>
function fixture() {
  const dns = Object.fromEntries(carriers.map(c => [c, { hostname: CDN_HOSTS[c], addresses: ['1.1.1.1'], selectedIPv4: '1.1.1.1', resolvedAt: new Date(NOW - 10000).toISOString() }]))
  const captures = Object.fromEntries(carriers.map(c => [c, Object.fromEntries(['udp', 'tcp'].map(p => [p, { port: 80, exitCode: 0, executionStatus: 'ok', rawSha256: 'a'.repeat(64) }]))]))
  const rows = Object.fromEntries(carriers.map(c => [c, Object.fromEntries(['udp', 'tcp'].map(p => [p, { protocol: p, family: 4, direction: 'node-to-cn', target: `hubei-cdn-${c}`, collectedAt: AT, status: 'unknown', reachedTarget: true, hops: [{ ttl: 1, ips: ['1.1.1.1'], asns: [], asnSource: 'none' }], asnLookup: { enabled: false, queries: 0, cacheHits: 0, failures: 0 } }]))]))
  return { schema: 3, uuid: UUID, city: 'hubei-cdn', source: 'replay', protocols: ['udp', 'tcp'], collectedAt: AT, targetBinding: cdnBinding(profile), dns, captures, captureOrigin: { uuid: UUID, city: 'hubei-cdn-trial', collectedAt: AT }, carriers: rows }
}
function snapshot(latest = fixture()) {
  return parseProbeSnapshot({ schema: 1, nodes: { [UUID]: { enabled: true, state: 'historical-import', seenAt: null, latest } } })
}
test('CDN header and independent replay evidence preserve six explicit port/provenance rows', () => {
  const value = snapshot().nodes[UUID]!
  const groups = protocolEvidenceGroups(UUID, value.protocols!, 24, NOW)
  expect(groups).toHaveLength(3)
  expect(groups.flatMap(g => g.rows)).toHaveLength(6)
  expect(groups.flatMap(g => g.rows).every(r => r.trace.source === 'replay' && r.trace.cdn?.port === 80 && r.trace.cdn.exitCode === 0)).toBe(true)
})
test('unknown historical evidence cannot become a public confirmed route', () => {
  const document = withProbeResults(parseReturnRouteConfig('').document, UUID, snapshot())
  const entries = resolveReturnRoutes(document, UUID, true, 24, NOW)
  expect(summaryReturnRoutes(entries, true)).toEqual([])
  expect(summaryReturnRoutes(entries, false)).toEqual([])
})
test('fixed and CDN target evidence cannot be relabeled into each other', () => {
  const latest = fixture()
  latest.carriers.telecom.tcp.target = 'hubei-telecom'
  expect(() => snapshot(latest)).toThrow()
})
test('DNS public-only validation and selected-answer binding fail closed', () => {
  for (const ip of ['10.0.0.1', '127.0.0.1', '169.254.169.254', '100.64.0.1', '203.0.113.1', '224.0.0.1', '::1']) {
    expect(publicCdnIPv4(ip)).toBe(false)
    const latest = fixture()
    latest.dns.telecom.addresses.push(ip)
    expect(() => snapshot(latest)).toThrow()
  }
})
test('CDN ports and strict whitelist survive management parsing; never auto-authorize', () => {
  const raw = { enabled: false, nodes: JSON.stringify({ [UUID]: { enabled: true, city: 'hubei-cdn', periodMinutes: 360 } }) }
  expect(() => parseProbePolicy(raw)).toThrow()
  expect(parseProbePolicy({ ...raw, cdnTargets: JSON.stringify({ 'hubei-cdn': profile }) }).cdnTargets).toBeTruthy()
  expect(() => parseCdnProfiles({ 'hubei-cdn': { ...profile, telecom: { ...profile.telecom, hostname: 'evil.example' } } })).toThrow()
  const latest = fixture()
  latest.captures.telecom.tcp.port = 443
  expect(() => snapshot(latest)).toThrow()
})
test('UI A/B selector never enables a draft production presentation', () => {
  expect(returnRoutePreviewLayout('?return_route_preview=ping', false)).toBe('line')
  expect(returnRoutePreviewLayout('?return_route_preview=ping', true)).toBe('ping')
  expect(returnRoutePreviewLayout('?return_route_preview=line', true)).toBe('line')
})
