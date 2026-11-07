const assert = require('node:assert/strict')
const { randomBytes } = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const { test } = require('node:test')
const { Coordinator, policy, normalizeResult } = require('../../companion/enhanced-route-probe/protocol.cjs')
const { ClientRequestLimiter } = require('../../companion/enhanced-route-probe/request-limits.cjs')
const { Store } = require('../../companion/enhanced-route-probe/storage.cjs')

const UUID = '00000000-0000-4000-8000-000000000001'
const OTHER = '00000000-0000-4000-8000-000000000002'
const NOW = Date.parse('2026-11-07T00:00:00Z')
function setup() {
  let now = NOW
  const c = new Coordinator(() => randomBytes(24).toString('hex'), () => now)
  const config = policy({ enabled: true, nodes: { [UUID]: { enabled: true, city: 'beijing', periodMinutes: 360 } } })
  return {
    c,
    config,
    advance(ms) {
      now += ms
    },
  }
}
function result(uuid = UUID, now = NOW) {
  return {
    schema: 1,
    uuid,
    city: 'beijing',
    source: 'fixture',
    collectedAt: new Date(now).toISOString(),
    carriers: Object.fromEntries(['telecom', 'unicom', 'mobile'].map(carrier => [carrier, { direction: 'node-to-cn', target: `beijing-${carrier}`, status: 'ok', reachedTarget: true, hops: [{ ttl: 1, asns: [4134] }] }])),
  }
}
function submit(c, config, job, value = result()) {
  return c.submit(UUID, { uuid: UUID, job_id: job.id, lease: job.lease, result: value }, config)
}

test('defaults do not schedule; names and arbitrary cities are rejected', () => {
  const { c, config } = setup()
  assert.equal(c.poll(UUID, policy({})).state, 'disabled')
  assert.throws(() => policy({ enabled: true, nodes: { Wendy: {} } }))
  assert.throws(() => c.enqueue(UUID, 'example.invalid', config))
  assert.throws(() => policy({ enabled: true, nodes: { [UUID]: { enabled: true, city: 'beijing', periodMinutes: 1 } } }))
})
test('per-node concurrency is one; authentication UUID cannot be supplied by result', () => {
  const { c, config } = setup()
  const job = c.poll(UUID, config).job
  assert(job)
  assert.equal(c.poll(UUID, config).job, null)
  assert.throws(() => c.submit(OTHER, { uuid: UUID, job_id: job.id, lease: job.lease, result: result() }, config))
})
test('fresh cache avoids probing and completed replay is idempotent', () => {
  const { c, config, advance } = setup()
  const job = c.poll(UUID, config).job
  assert.equal(submit(c, config, job).accepted, true)
  assert.equal(submit(c, config, job).duplicate, true)
  assert.equal(c.poll(UUID, config).job, null)
  advance(360 * 60000)
  assert(c.poll(UUID, config).job)
})
test('expired/replaced lease cannot overwrite a newer result', () => {
  const { c, config, advance } = setup()
  const old = c.poll(UUID, config).job
  advance(180001)
  const next = c.poll(UUID, config).job
  assert.notEqual(next.lease, old.lease)
  assert.throws(() => submit(c, config, old, result(UUID, NOW + 180001)))
  submit(c, config, next, result(UUID, NOW + 180001))
})
test('disabled or changed policy cancels old leased work', () => {
  const { c, config } = setup()
  const job = c.poll(UUID, config).job
  config.enabled = false
  assert.equal(c.poll(UUID, config).state, 'disabled')
  assert.throws(() => submit(c, config, job))
  config.enabled = true
  config.nodes[UUID].city = 'shanghai'
  assert.equal(c.poll(UUID, config).job, null)
  assert.throws(() => submit(c, config, job))
})
test('global concurrent leases never exceed four', () => {
  const { c, config } = setup()
  for (let i = 1; i <= 5; i++) {
    const uuid = `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`
    config.nodes[uuid] = { enabled: true, city: 'beijing', periodMinutes: 360 }
    if (i <= 4)
      assert(c.poll(uuid, config).job)
    else
      assert.throws(() => c.poll(uuid, config))
  }
})
for (const [name, mutate] of [
  ['reverse direction', r => r.carriers.telecom.direction = 'cn-to-node'],
  ['arbitrary target', r => r.carriers.telecom.target = '127.0.0.1;command'],
  ['injected ASN', r => r.carriers.telecom.hops[0].asns = ['$(command)']],
  ['duplicate hops', r => r.carriers.telecom.hops.push(r.carriers.telecom.hops[0])],
  ['unknown status', r => r.carriers.telecom.status = 'made-up-success'],
  ['unexpected field', r => r.command = 'never-run'],
  ['future timestamp', r => r.collectedAt = new Date(NOW + 600000).toISOString()],
]) {
  test(`result protocol rejects ${name}`, () => {
    const value = result()
    mutate(value)
    assert.throws(() => normalizeResult(value, UUID, 'beijing', NOW))
  })
}
test('failure states are evidence, not a silent previous success', () => {
  const { c, config } = setup()
  const job = c.poll(UUID, config).job
  const value = result()
  value.carriers.telecom.status = 'timeout'
  submit(c, config, job, value)
  assert.equal(c.snapshot(config).nodes[UUID].latest.carriers.telecom.status, 'timeout')
})
test('bounded per-authenticated-node token buckets refill', () => {
  let now = NOW
  const limiter = new ClientRequestLimiter(() => now)
  for (let i = 0; i < 6; i++)
    assert.equal(limiter.take(UUID, 'poll'), 0)
  assert(limiter.take(UUID, 'poll') > 0)
  assert.equal(limiter.take(OTHER, 'poll'), 0)
  now += 5000
  assert.equal(limiter.take(UUID, 'poll'), 0)
})
test('0600 atomic state restores results and rejects corrupt state without overwriting it', () => {
  const { c, config } = setup()
  submit(c, config, c.poll(UUID, config).job)
  const root = fs.mkdtempSync(path.join(process.cwd(), 'test-results/storage-'))
  try {
    const storage = new Store(fs, path, root, c)
    storage.restore()
    assert.equal(fs.statSync(storage.file).mode & 0o777, 0o600)
    const next = setup()
    new Store(fs, path, root, next.c).restore()
    assert(next.c.snapshot(config).nodes[UUID].latest)
    fs.writeFileSync(storage.file, '{corrupt')
    assert.throws(() => new Store(fs, path, root, next.c).restore())
    assert.equal(fs.readFileSync(storage.file, 'utf8'), '{corrupt')
  }
  finally {
    fs.rmSync(root, { recursive: true })
  }
})
