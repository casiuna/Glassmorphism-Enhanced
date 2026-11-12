'use strict'
// Additional behavior contracts; original sixteen protocol cases remain intact.
const assert = require('node:assert/strict')
const test = require('node:test')
const { Coordinator, policy } = require('../../companion/enhanced-route-probe/protocol.cjs')

const UUID = '00000000-0000-4000-8000-000000000001'
const NOW = Date.parse('2026-11-09T12:00:00Z')
function coordinator() {
  return new Coordinator(() => 'a'.repeat(48), () => NOW)
}

test('register is native-identity metadata only: no lease, no online heartbeat, no policy activation', () => {
  const c = coordinator()
  assert.deepEqual(c.register(UUID, '0.2.0+git.fixture'), { schema: 1, uuid: UUID, registered: true })
  const node = c.snapshot(policy({})).nodes[UUID]
  assert.equal(node.enabled, false)
  assert.equal(node.seenAt, null)
  assert.equal(node.registeredAt, NOW)
  assert.equal(node.helperVersion, '0.2.0+git.fixture')
  assert.equal(node.latest, null)
  assert.equal(c.nodes[UUID].job, null)
})
test('disabled polling provides a heartbeat without scheduling a single probe', () => {
  const c = coordinator()
  assert.equal(c.poll(UUID, policy({}), '0.2.0').state, 'disabled')
  assert.equal(c.snapshot(policy({})).nodes[UUID].seenAt, NOW)
  assert.equal(c.nodes[UUID].lastStarted, 0)
})
test('registration rejects arbitrary version strings and malformed identities before mutation', () => {
  const c = coordinator()
  for (const version of ['<script>', 'x'.repeat(200), {}, null])
    assert.throws(() => c.register(UUID, version))
  assert.throws(() => c.register('Wendy', '0.2.0'))
  assert.deepEqual(c.nodes, {})
})
test('legacy schema-1 checkpoints still load without a helper version', () => {
  const c = coordinator()
  c.importState({ schema: 1, nodes: { [UUID]: { seenAt: null, lastStarted: 0, job: null, latest: null } } })
  assert.equal(c.snapshot(policy({})).nodes[UUID].helperVersion, null)
})
test('per-node restore requires collection disabled and validates the whole checkpoint before changing it', () => {
  const c = coordinator()
  const node = { seenAt: NOW, lastStarted: 0, job: null, latest: null, helperVersion: '0.2.0' }
  assert.throws(() => c.restoreNode(UUID, node, policy({ enabled: true })))
  assert.deepEqual(c.nodes, {})
  c.restoreNode(UUID, node, policy({}))
  assert.equal(c.exportState().nodes[UUID].helperVersion, '0.2.0')
  const before = JSON.stringify(c.exportState())
  assert.throws(() => c.restoreNode(UUID, { ...node, command: 'forbidden' }, policy({})))
  assert.equal(JSON.stringify(c.exportState()), before)
})
test('hostile stored jobs and malformed heartbeat/version data fail closed', () => {
  for (const node of [
    { seenAt: Infinity, lastStarted: 0 },
    { seenAt: null, lastStarted: -1 },
    { seenAt: null, lastStarted: 0, helperVersion: 'unbounded-unsupported' },
    { seenAt: null, lastStarted: 0, job: { city: 'beijing', id: 'a'.repeat(48), command: 'forbidden' } },
  ])
    assert.throws(() => coordinator().importState({ schema: 1, nodes: { [UUID]: node } }))
})
