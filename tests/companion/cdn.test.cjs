// Synthetic contract inputs ONLY. Actual CDN measurement remains private/unchanged.
const assert = require('node:assert/strict')
const { test } = require('node:test')
const { Coordinator, policy, normalizeResult, cdnBinding, CDN_HOSTS, publicV4 } = require('../../companion/enhanced-route-probe/protocol.cjs')

const uuid = '00000000-0000-4000-8000-000000000001'
const now = Date.parse('2026-11-13T03:08:52.146Z')
const carriers = ['telecom', 'unicom', 'mobile']
const profile = () => Object.fromEntries(carriers.map(c => [c, { hostname: CDN_HOSTS[c], udpPort: 80, tcpPort: 80 }]))
function config(enabled = true) {
  return policy({ enabled, cdnTargets: { 'hubei-cdn': profile() }, nodes: { [uuid]: { enabled: true, city: 'hubei-cdn', periodMinutes: 60 } } })
}
function sample() {
  const dns = {}
  const captures = {}
  const rows = {}
  for (const [i, c] of carriers.entries()) {
    const ip = ['1.1.1.1', '8.8.8.8', '9.9.9.9'][i]
    dns[c] = { hostname: CDN_HOSTS[c], addresses: [ip], selectedIPv4: ip, resolvedAt: new Date(now - 10000).toISOString() }
    captures[c] = {}
    rows[c] = {}
    for (const protocol of ['udp', 'tcp']) {
      captures[c][protocol] = { port: 80, exitCode: 0, executionStatus: 'ok', rawSha256: 'a'.repeat(64) }
      rows[c][protocol] = { protocol, family: 4, direction: 'node-to-cn', target: `hubei-cdn-${c}`, collectedAt: new Date(now - 5000).toISOString(), status: 'unknown', reachedTarget: true, hops: [{ ttl: 1, ips: [ip], asns: [], asnSource: 'none' }], asnLookup: { enabled: false, queries: 0, cacheHits: 0, failures: 0 } }
    }
  }
  return { schema: 3, uuid, city: 'hubei-cdn', source: 'helper', protocols: ['udp', 'tcp'], collectedAt: new Date(now).toISOString(), targetBinding: cdnBinding(profile()), dns, captures, captureOrigin: { uuid, city: 'hubei-cdn', collectedAt: new Date(now).toISOString() }, carriers: rows }
}
module.exports = { sample, config, profile, uuid, now }

test('CDN off unless administrator approves exact catalog', () => {
  assert.throws(() => policy({ enabled: true, nodes: config().nodes }))
  assert.doesNotThrow(() => config())
  for (const key of ['hostname', 'udpPort', 'tcpPort']) {
    const p = profile()
    p.telecom[key] = key === 'hostname' ? 'evil.example' : 22
    assert.throws(() => policy({ cdnTargets: { 'hubei-cdn': p }, nodes: {} }))
  }
})
test('schema3 source/target/DNS/ports normalize without losing evidence', () => {
  const r = sample()
  assert.deepEqual(normalizeResult(r, uuid, r.city, now), r)
})
for (const ip of ['0.0.0.0', '10.1.2.3', '127.0.0.1', '169.254.169.254', '172.16.0.1', '192.168.1.1', '100.64.0.1', '198.18.0.1', '203.0.113.1', '224.0.0.1', '::1', '01.1.1.1']) {
  test(`CDN DNS rejects ${ip}`, () => {
    assert.equal(publicV4(ip), false)
    const r = sample()
    r.dns.telecom.addresses.push(ip)
    assert.throws(() => normalizeResult(r, uuid, r.city, now))
  })
}
const mutations = {
  'hostname injection': (r) => { r.dns.telecom.hostname = 'hb-ct-v4.ip.zstaticcdn.com.evil.example' },
  'unbound port': (r) => { r.captures.telecom.tcp.port = 443 },
  'selected outside DNS': (r) => { r.dns.telecom.selectedIPv4 = '4.4.4.4' },
  'false arrival': (r) => { r.carriers.telecom.tcp.hops[0].ips = ['4.4.4.4'] },
  'exit success confusion': (r) => { r.captures.telecom.tcp.exitCode = 1 },
  'DNS after trace': (r) => { r.dns.telecom.resolvedAt = r.collectedAt },
  'Cymru without consent': (r) => { r.carriers.telecom.tcp.hops[0] = { ttl: 1, ips: ['1.1.1.1'], asns: [1], asnSource: 'team-cymru' } },
  'arbitrary command': (r) => { r.command = 'touch never' },
  'UUID': (r) => { r.uuid = '00000000-0000-4000-8000-000000000002' },
}
for (const [name, mutate] of Object.entries(mutations)) {
  test(`schema3 rejects ${name}`, () => {
    const r = sample()
    mutate(r)
    assert.throws(() => normalizeResult(r, uuid, 'hubei-cdn', now))
  })
}
test('lease binds local-approved profile and rejects stale/replay/changed ports', () => {
  let id = 0
  const c = new Coordinator(() => (++id).toString(16).padStart(48, '0'), () => now)
  const cfg = config()
  const job = c.poll(uuid, cfg).job
  assert.equal(job.targetBinding, cdnBinding(profile()))
  const body = { uuid, job_id: job.id, lease: job.lease, result: sample() }
  body.result.source = 'replay'
  assert.throws(() => c.submit(uuid, body, cfg))
  body.result = sample()
  body.result.collectedAt = new Date(now - 600000).toISOString()
  assert.throws(() => c.submit(uuid, body, cfg))
  body.result = sample()
  assert.equal(c.submit(uuid, body, cfg).accepted, true)
  assert.equal(c.submit(uuid, body, cfg).duplicate, true)
})
test('historical replay only disabled administrator import and exact whitelist', () => {
  const c = new Coordinator(() => 'a'.repeat(48), () => now + 60 * 60 * 1000)
  const r = sample()
  r.source = 'replay'
  const n = { seenAt: null, lastStarted: 0, latest: r, job: null }
  assert.throws(() => c.restoreNode(uuid, n, config(true)))
  assert.throws(() => c.restoreNode(uuid, n, policy({ enabled: false, nodes: {} })))
  assert(c.restoreNode(uuid, n, config(false)).restored)
  assert.deepEqual(c.snapshot(config(false)).nodes[uuid].latest, r)
})
test('port policy change cancels queued/running lease and preserves cooldown', () => {
  let id = 0
  const c = new Coordinator(() => (++id).toString(16).padStart(48, '0'), () => now)
  const cfg = config()
  const j = c.poll(uuid, cfg).job
  cfg.cdnTargets['hubei-cdn'].telecom.tcpPort = 443
  assert.equal(c.poll(uuid, cfg).state, 'cancelled')
  assert.throws(() => c.submit(uuid, { uuid, job_id: j.id, lease: j.lease, result: sample() }, cfg))
})
