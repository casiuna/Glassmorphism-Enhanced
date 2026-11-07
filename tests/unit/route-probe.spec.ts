import { expect, test } from '@playwright/test'
import { resolveReturnRoutes } from '../../src/utils/returnRoutes'
import { parseProbeSnapshot, withProbeResults } from '../../src/utils/routeProbeSnapshot'

const UUID = '00000000-0000-4000-8000-000000000001'
const NOW = Date.parse('2026-11-07T12:00:00Z')
function snapshot(status = 'ok', source = 'fixture') {
  return { schema: 1, nodes: { [UUID]: { enabled: true, state: 'completed', seenAt: NOW, latest: {
    schema: 1,
    uuid: UUID,
    source,
    collectedAt: new Date(NOW).toISOString(),
    carriers: Object.fromEntries(['telecom', 'unicom', 'mobile'].map(carrier => [carrier, {
      direction: 'node-to-cn',
      target: `beijing-${carrier}`,
      status,
      reachedTarget: true,
      hops: [{ ttl: 1, asns: [4134] }, { ttl: 2, asns: [4134] }],
    }])),
  } } } }
}

test('native companion evidence is bound to UUID and marked simulated, not a live probe', () => {
  const parsed = parseProbeSnapshot(snapshot())
  const merged = withProbeResults({ version: 1, nodes: {} }, UUID, parsed)
  expect(resolveReturnRoutes(merged, UUID, true, 24, NOW)[0]).toMatchObject({ label: '163', source: 'fixture', status: 'fresh-auto' })
  expect(Object.keys(merged.nodes)).toEqual([UUID])
})
test('manual overrides remain authoritative and state merge never mutates saved settings', () => {
  const document = { version: 1 as const, nodes: { [UUID]: { manual: { telecom: { label: '管理员标注', updatedAt: null } }, auto: {} } } }
  const before = JSON.stringify(document)
  const merged = withProbeResults(document, UUID, parseProbeSnapshot(snapshot()))
  expect(resolveReturnRoutes(merged, UUID, true, 24, NOW)[0]).toMatchObject({ label: '管理员标注', source: 'manual' })
  expect(JSON.stringify(document)).toBe(before)
})
test('disabled node never exposes cached plugin results', () => {
  const value = snapshot()
  value.nodes[UUID].enabled = false
  const document = { version: 1 as const, nodes: {} }
  expect(withProbeResults(document, UUID, parseProbeSnapshot(value))).toBe(document)
})
test('stale companion cache cannot replace a fresher imported observation', () => {
  const data = snapshot()
  data.nodes[UUID].latest.collectedAt = new Date(NOW - 48 * 3600000).toISOString()
  const document = { version: 1 as const, nodes: { [UUID]: { manual: {}, auto: { telecom: {
    direction: 'node-to-cn' as const,
    target: 'beijing-telecom' as const,
    collectedAt: new Date(NOW).toISOString(),
    reachedTarget: true,
    hops: [{ ttl: 1, asns: [23764] }, { ttl: 2, asns: [23764] }],
  } } } } }
  const merged = withProbeResults(document, UUID, parseProbeSnapshot(data))
  expect(resolveReturnRoutes(merged, UUID, true, 24, NOW)[0]).toMatchObject({ label: 'CTGNET', status: 'fresh-auto' })
})
test('TTL expires simulated and real observations alike, never a manual override', () => {
  const merged = withProbeResults({ version: 1, nodes: {} }, UUID, parseProbeSnapshot(snapshot()))
  expect(resolveReturnRoutes(merged, UUID, true, 1, NOW + 3600000)[0]).toMatchObject({ label: '已过期', source: 'fixture' })
})
for (const [status, label] of [
  ['timeout', '探测超时'],
  ['permission-denied', '权限不足'],
  ['no-traceroute', '未安装 traceroute'],
  ['probe-failed', '探测失败'],
  ['output-limit', '输出超限'],
]) {
  test(`probe failure status ${status} remains visible without a fabricated success`, () => {
    const merged = withProbeResults({ version: 1, nodes: {} }, UUID, parseProbeSnapshot(snapshot(status)))
    expect(resolveReturnRoutes(merged, UUID, true, 24, NOW)[0]).toMatchObject({ label, status: 'failed' })
  })
}
for (const [name, value] of [
  ['wrong schema', { schema: 2, nodes: {} }],
  ['name as key', { schema: 1, nodes: { Wendy: {} } }],
  ['malformed result', { schema: 1, nodes: { [UUID]: { enabled: true, state: 'completed', latest: {} } } }],
  ['unsupported source', snapshot('ok', 'unverified-claim')],
  ['unknown status', snapshot('pretend-ok')],
]) {
  test(`reject companion snapshot: ${name}`, () => {
    expect(() => parseProbeSnapshot(value)).toThrow()
  })
}
