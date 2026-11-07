import type { AutoReturnRoute, NodeReturnRoutes } from '../../src/utils/returnRoutes'
import { expect, test } from '@playwright/test'
import { classifyReturnRoute } from '../../src/utils/returnRouteClassification'
import { parseReturnRouteConfig, resolveReturnRoutes, serializeReturnRoutes } from '../../src/utils/returnRoutes'

const UUID = '00000000-0000-4000-8000-000000000001'
const OTHER = '00000000-0000-4000-8000-000000000002'
const AT = '2026-07-25T11:00:00Z'
const NOW = Date.parse('2026-07-25T12:00:00Z')
function auto(overrides: Partial<AutoReturnRoute> = {}): AutoReturnRoute {
  return { direction: 'node-to-cn', target: 'beijing-telecom', collectedAt: AT, reachedTarget: true, hops: [{ ttl: 1, asns: [4134] }, { ttl: 2, asns: [4134] }], ...overrides }
}
function config(node: Partial<NodeReturnRoutes>) {
  const parsed = parseReturnRouteConfig(JSON.stringify({ version: 1, nodes: { [UUID]: node } }))
  expect(parsed.error).toBeNull()
  return parsed.document
}

test('configuration round-trips and binds manual overrides to UUID, not node name', () => {
  const document = config({ manual: { telecom: { label: '我的电信 < & "', updatedAt: AT } }, auto: { telecom: auto() } })
  expect(parseReturnRouteConfig(serializeReturnRoutes(document)).document).toEqual(document)
  const state = resolveReturnRoutes(document, UUID, true, 24, NOW)[0]!
  expect(state).toMatchObject({ label: '我的电信 < & "', status: 'manual', source: 'manual', at: '2026-07-25T11:00:00.000Z' })
  expect(resolveReturnRoutes(document, OTHER, true, 24, NOW).every(entry => entry.status === 'not-detected')).toBe(true)
  expect(resolveReturnRoutes(document, UUID, false, 24, NOW)[0]!.status).toBe('manual')
})

test('v0 manual strings migrate without inventing timestamps or using tags', () => {
  const legacy = parseReturnRouteConfig({ version: 0, nodes: { [UUID]: { manual: { unicom: '旧手动标注' } } } })
  expect(legacy.error).toBeNull()
  expect(legacy.migrated).toBe(true)
  expect(legacy.document.nodes[UUID]!.manual.unicom).toEqual({ label: '旧手动标注', updatedAt: null })
  expect(parseReturnRouteConfig(serializeReturnRoutes(legacy.document)).migrated).toBe(false)
})

test('manual removal falls back to fresh auto, TTL expires exactly at boundary', () => {
  const document = config({ auto: { telecom: auto() } })
  expect(resolveReturnRoutes(document, UUID, true, 24, NOW)[0]).toMatchObject({ label: '163', status: 'fresh-auto', source: 'auto' })
  expect(resolveReturnRoutes(document, UUID, true, 24, Date.parse(AT) + 24 * 3600000)[0]!.status).toBe('expired')
  expect(resolveReturnRoutes(document, UUID, true, 24, Date.parse(AT) + 24 * 3600000 - 1)[0]!.status).toBe('fresh-auto')
  expect(resolveReturnRoutes(document, UUID, false, 24, NOW)[0]!.label).toBe('未检测')
  expect(resolveReturnRoutes(document, UUID, true, 1, NOW)[0]!.label).toBe('已过期')
})

test('unknown, future clock, no data and partial traces remain distinct', () => {
  const document = config({ auto: { telecom: auto({ hops: [{ ttl: 1, asns: [64500] }] }) } })
  expect(resolveReturnRoutes(document, UUID, true, 24, NOW)[0]).toMatchObject({ label: '未知', status: 'unknown' })
  expect(resolveReturnRoutes(document, UUID, true, 24, Date.parse(AT) - 3600000)[0]!.status).toBe('unknown')
  expect(resolveReturnRoutes(document, UUID, true, 24, NOW)[1]!.label).toBe('未检测')
  expect(classifyReturnRoute('telecom', auto().hops, false).confidence).toBe('uncertain')
})

for (const [carrier, asn, label] of [
  ['telecom', 4134, '163'],
  ['telecom', 23764, 'CTGNET'],
  ['unicom', 4837, '4837'],
  ['unicom', 9929, '9929'],
  ['unicom', 10099, '10099 / CUG'],
  ['mobile', 9808, 'CMNET'],
  ['mobile', 58453, 'CMI'],
  ['mobile', 58807, 'CMIN2'],
] as const) {
  test(`ASN fixture classification ${carrier}/${asn} => ${label}`, () => {
    expect(classifyReturnRoute(carrier, [{ ttl: 2, asns: [asn] }, { ttl: 3, asns: [asn] }], true)).toMatchObject({ label, confidence: 'observed' })
  })
}

test('CN2 never proves GIA from an ASN alone; GT/mixed candidates retain evidence', () => {
  expect(classifyReturnRoute('telecom', [{ ttl: 1, asns: [4809] }], true)).toMatchObject({ confidence: 'uncertain', label: 'CN2（不确定）' })
  expect(classifyReturnRoute('telecom', [{ ttl: 1, asns: [4809] }, { ttl: 2, asns: [4809] }], true)).toMatchObject({ confidence: 'uncertain', label: 'CN2（GIA 候选，未认证）' })
  expect(classifyReturnRoute('telecom', [{ ttl: 1, asns: [4134] }, { ttl: 2, asns: [4809] }], true).label).toContain('GT 候选')
  const mixed = classifyReturnRoute('telecom', [{ ttl: 1, asns: [4809] }, { ttl: 2, asns: [23764] }], true)
  expect(mixed.label).toContain('CTGNET')
  expect(mixed.label).not.toContain('163')
  expect(classifyReturnRoute('telecom', [{ ttl: 1, asns: [4809, 4134] }, { ttl: 2, asns: [4809] }], true).confidence).toBe('uncertain')
})

test('carriers stay independent and mixed lines are not converted from Ping RTT', () => {
  expect(classifyReturnRoute('unicom', [{ ttl: 2, asns: [10099] }, { ttl: 4, asns: [9929] }], true).confidence).toBe('mixed')
  expect(classifyReturnRoute('mobile', [{ ttl: 1, asns: [4809] }, { ttl: 2, asns: [4809] }], true).label).toBe('未知')
  const data = config({ manual: { mobile: { label: '手动线路', updatedAt: null } } })
  expect(resolveReturnRoutes(data, UUID, true, Number.NaN, NOW).map(entry => entry.status)).toEqual(['not-detected', 'not-detected', 'manual'])
})

for (const [name, value] of [
  ['bad JSON', '{malformed-private-data'],
  ['unknown version', { version: 9, nodes: {} }],
  ['name instead of UUID', { version: 1, nodes: { Wendy: {} } }],
  ['oversized input', ' '.repeat(262145)],
  ['wrong carrier', { version: 1, nodes: { [UUID]: { manual: { CT: { label: 'typo' } } } } }],
  ['empty label', { version: 1, nodes: { [UUID]: { manual: { telecom: { label: '' } } } } }],
  ['long label', { version: 1, nodes: { [UUID]: { manual: { telecom: { label: 'x'.repeat(81) } } } } }],
  ['control label', { version: 1, nodes: { [UUID]: { manual: { telecom: { label: 'x\u0000y' } } } } }],
  ['invalid calendar', { version: 1, nodes: { [UUID]: { manual: { telecom: { label: 'route', updatedAt: '2026-02-30T01:00:00Z' } } } } }],
]) {
  test(`reject configuration without partial success: ${name}`, () => {
    const parsed = parseReturnRouteConfig(value)
    expect(parsed.error).toBeTruthy()
    expect(parsed.document.nodes).toEqual({})
    expect(parsed.error).not.toContain('malformed-private-data')
  })
}

for (const [name, patch] of [
  ['reverse direction', { direction: 'cn-to-node' }],
  ['arbitrary target', { target: 'example.invalid;command' }],
  ['carrier mismatch', { target: 'beijing-mobile' }],
  ['missing timestamp', { collectedAt: '' }],
  ['duplicate ttl', { hops: [{ ttl: 1, asns: [4134] }, { ttl: 1, asns: [] }] }],
  ['too many hops', { hops: Array.from({ length: 31 }, (_, i) => ({ ttl: i + 1, asns: [] })) }],
  ['command ASN', { hops: [{ ttl: 1, asns: ['$(command)'] }] }],
  ['string ttl', { hops: [{ ttl: '1', asns: [4134] }] }],
] satisfies Array<[string, Record<string, unknown>]>) {
  test(`reject automatic fixture: ${name}`, () => {
    const parsed = parseReturnRouteConfig({ version: 1, nodes: { [UUID]: { auto: { telecom: { ...auto(), ...patch } } } } })
    expect(parsed.error).toBeTruthy()
    expect(parsed.document.nodes).toEqual({})
  })
}

test('serialization drops non-schema fields and keeps input immutable', () => {
  const input = { version: 1, nodes: { [UUID]: { manual: { telecom: { label: '163' } }, unrelated: 'not-persisted' } } }
  const before = JSON.stringify(input)
  const parsed = parseReturnRouteConfig(input)
  expect(parsed.error).toBeNull()
  expect(serializeReturnRoutes(parsed.document)).not.toContain('not-persisted')
  expect(JSON.stringify(input)).toBe(before)
  expect(parseReturnRouteConfig(undefined).error).toBeNull()
})

// All observations above are deterministic local fixtures, not live traceroutes.
