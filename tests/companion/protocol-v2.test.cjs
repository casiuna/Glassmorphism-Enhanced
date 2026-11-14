const assert = require('node:assert/strict')
const { randomBytes } = require('node:crypto')
const { test } = require('node:test')
const { Coordinator, normalizeResult, policy } = require('../../companion/enhanced-route-probe/protocol.cjs')
const { fixtureV2, invalidV2 } = require('./probe-v2-fixture.cjs')

const BASE = fixtureV2()
const UUID = BASE.uuid
const NOW = Date.parse(BASE.collectedAt)
const fresh = () => structuredClone(BASE)

for (const [name, mutate] of invalidV2) {
  test(`schema2 rejects ${name}`, () => {
    const result = fresh()
    mutate(result)
    assert.throws(() => normalizeResult(result, UUID, 'beijing', NOW))
  })
}
test('actual Python fixture output round-trips without merging TCP/UDP paths or inventing ASN', () => {
  const result = normalizeResult(BASE, UUID, 'beijing', NOW)
  assert.deepEqual(result, BASE)
  assert.notDeepEqual(result.carriers.telecom.udp.hops, result.carriers.telecom.tcp.hops)
  assert.deepEqual(result.carriers.mobile.tcp.hops[0].asns, [])
  assert.deepEqual(result.carriers.mobile.tcp.hops[0].prefixHints, ['CMI'])
  result.carriers.telecom.udp.hops[0].asns[0] = 1
  assert.equal(BASE.carriers.telecom.udp.hops[0].asns[0], 4134)
})
for (const protocol of ['tcp', 'udp']) {
  test(`single ${protocol} result is accepted independently`, () => {
    const result = fresh()
    result.protocols = [protocol]
    for (const carrier of Object.keys(result.carriers))
      result.carriers[carrier] = { [protocol]: result.carriers[carrier][protocol] }
    assert.deepEqual(normalizeResult(result, UUID, 'beijing', NOW).protocols, [protocol])
  })
}
test('schema2 completed replay, cross-UUID rejection, snapshot and persisted state keep independent paths', () => {
  const coordinator = new Coordinator(() => randomBytes(24).toString('hex'), () => NOW)
  const config = policy({ enabled: true, nodes: { [UUID]: { enabled: true, city: 'beijing', periodMinutes: 360 } } })
  const job = coordinator.poll(UUID, config).job
  const body = { uuid: UUID, job_id: job.id, lease: job.lease, result: fresh() }
  assert.throws(() => coordinator.submit('00000000-0000-4000-8000-000000000002', body, config))
  assert(coordinator.submit(UUID, body, config).accepted)
  assert(coordinator.submit(UUID, body, config).duplicate)
  assert.deepEqual(coordinator.snapshot(config).nodes[UUID].latest, BASE)
  const restored = new Coordinator(() => randomBytes(24).toString('hex'), () => NOW)
  restored.importState(JSON.parse(JSON.stringify(coordinator.exportState())))
  assert.deepEqual(restored.snapshot(config).nodes[UUID].latest, BASE)
})
test('one protocol failure remains a failure record, never silently replaced by the other protocol', () => {
  const result = fresh()
  result.carriers.telecom.tcp.status = 'permission-denied'
  result.carriers.telecom.tcp.hops = []
  result.carriers.telecom.tcp.reachedTarget = false
  const normalized = normalizeResult(result, UUID, 'beijing', NOW)
  assert.equal(normalized.carriers.telecom.tcp.status, 'permission-denied')
  assert.equal(normalized.carriers.telecom.udp.status, 'ok')
})
