'use strict'
// Selective redesign of Transit RouteProbeCoordinator (MIT):
// Copyright (c) 2026 yyy622hhh; Copyright (c) 2025 Tony Liu.
// Full notice: LICENSE. No Transit tag transport, legacy GET tokens or remote exec.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const JOB_ID = /^[0-9a-f]{48}$/
const CITIES = ['beijing', 'shanghai', 'guangzhou']
const CARRIERS = ['telecom', 'unicom', 'mobile']
const STATUSES = ['ok', 'unknown', 'timeout', 'permission-denied', 'no-traceroute', 'probe-failed', 'output-limit']
const TARGETS = {
  beijing: ['219.141.140.10', '202.106.195.68', '221.179.155.161'],
  shanghai: ['202.96.209.133', '210.22.97.1', '211.136.112.200'],
  guangzhou: ['58.60.188.222', '210.21.196.6', '120.196.165.24'],
}
function assert(value, message = 'invalid protocol input') {
  if (!value)
    throw new TypeError(message)
}
function keys(value, allowed) {
  assert(value && typeof value === 'object' && !Array.isArray(value))
  assert(Object.keys(value).every(key => allowed.includes(key)), 'unexpected fields')
}
function policy(raw) {
  keys(raw, ['enabled', 'nodes'])
  const nodes = typeof raw.nodes === 'string' ? JSON.parse(raw.nodes) : raw.nodes || {}
  assert(Object.keys(nodes).length <= 200, 'too many nodes')
  keys(nodes, Object.keys(nodes))
  for (const uuid of Object.keys(nodes)) {
    assert(UUID.test(uuid), 'UUID required')
    const item = nodes[uuid]
    keys(item, ['enabled', 'city', 'periodMinutes'])
    assert(typeof item.enabled === 'boolean' && CITIES.includes(item.city), 'invalid node policy')
    assert(Number.isInteger(item.periodMinutes) && item.periodMinutes >= 60 && item.periodMinutes <= 10080, 'period must be 60–10080 minutes')
  }
  return { enabled: raw.enabled === true, nodes }
}
function normalizeResult(result, uuid, city, now) {
  keys(result, ['schema', 'uuid', 'city', 'collectedAt', 'source', 'carriers'])
  assert(result.schema === 1 && result.uuid === uuid && result.city === city, 'result binding mismatch')
  assert(['helper', 'fixture'].includes(result.source), 'invalid source')
  const time = Date.parse(result.collectedAt)
  assert(typeof result.collectedAt === 'string' && Number.isFinite(time) && Math.abs(now - time) <= 300000, 'invalid collectedAt')
  keys(result.carriers, CARRIERS)
  const carriers = {}
  for (const carrier of CARRIERS) {
    const row = result.carriers[carrier]
    keys(row, ['direction', 'target', 'status', 'reachedTarget', 'hops'])
    assert(row.direction === 'node-to-cn' && row.target === `${city}-${carrier}`, 'fixed target required')
    assert(STATUSES.includes(row.status) && typeof row.reachedTarget === 'boolean', 'invalid probe status')
    assert(Array.isArray(row.hops) && row.hops.length <= 20, 'hop limit')
    const ttls = new Set()
    const hops = row.hops.map((hop) => {
      keys(hop, ['ttl', 'asns'])
      assert(Number.isInteger(hop.ttl) && hop.ttl >= 1 && hop.ttl <= 20 && !ttls.has(hop.ttl), 'invalid hop TTL')
      ttls.add(hop.ttl)
      assert(Array.isArray(hop.asns) && hop.asns.length <= 4 && hop.asns.every(asn => Number.isInteger(asn) && asn > 0 && asn <= 4294967295), 'invalid ASN')
      return { ttl: hop.ttl, asns: [...new Set(hop.asns)] }
    })
    carriers[carrier] = { direction: 'node-to-cn', target: row.target, status: row.status, reachedTarget: row.reachedTarget, hops }
  }
  return { schema: 1, uuid, city, collectedAt: new Date(time).toISOString(), source: result.source, carriers }
}
class Coordinator {
  constructor(randomId, now = Date.now) {
    this.randomId = randomId
    this.now = now
    this.nodes = {}
  }

  node(uuid) {
    assert(typeof uuid === 'string' && UUID.test(uuid), 'UUID required')
    if (!this.nodes[uuid]) {
      assert(Object.keys(this.nodes).length < 200, 'node capacity reached')
      this.nodes[uuid] = { seenAt: null, job: null, latest: null, lastStarted: 0 }
    }
    return this.nodes[uuid]
  }

  enqueue(uuid, city, config) {
    const setting = config.nodes[uuid]
    assert(config.enabled && setting && setting.enabled && city === setting.city, 'node is not enabled for this city')
    const node = this.node(uuid)
    const now = this.now()
    if (node.job && node.job.expires > now && ['queued', 'running'].includes(node.job.status))
      return node.job
    assert(now - node.lastStarted >= 60000, 'node cooldown; retry after 60 seconds')
    assert(Object.values(this.nodes).filter(n => n.job && n.job.status === 'running' && n.job.leaseUntil > now).length < 4, 'global concurrency limit')
    node.job = { id: this.randomId(), city, status: 'queued', createdAt: now, expires: now + 600000, lease: null, leaseUntil: 0 }
    node.lastStarted = now
    return node.job
  }

  poll(uuid, config) {
    const setting = config.nodes[uuid]
    if (!config.enabled || !setting || !setting.enabled) {
      const old = this.nodes[uuid]
      if (old && old.job && ['queued', 'running'].includes(old.job.status)) {
        old.job.status = 'cancelled'
        old.job.lease = null
      }
      return { schema: 1, uuid, state: 'disabled', job: null }
    }
    const node = this.node(uuid)
    node.seenAt = this.now()
    let job = node.job
    const now = this.now()
    if (job && job.city !== setting.city) {
      job.status = 'cancelled'
      job.lease = null
    }
    if (job && job.expires <= now && ['queued', 'running'].includes(job.status))
      job.status = 'expired'
    if ((!job || !['queued', 'running'].includes(job.status)) && now - node.lastStarted >= setting.periodMinutes * 60000)
      job = this.enqueue(uuid, setting.city, config)
    if (!job || !['queued', 'running'].includes(job.status) || (job.status === 'running' && job.leaseUntil > now))
      return { schema: 1, uuid, state: job ? job.status : 'idle', job: null }
    assert(Object.values(this.nodes).filter(n => n.job && n.job.status === 'running' && n.job.leaseUntil > now).length < 4, 'global concurrency limit')
    job.status = 'running'
    job.lease = this.randomId()
    job.leaseUntil = now + 180000
    return { schema: 1, uuid, state: 'running', job: { id: job.id, city: job.city, lease: job.lease, leaseUntil: job.leaseUntil } }
  }

  submit(uuid, body, config) {
    keys(body, ['token', 'uuid', 'job_id', 'lease', 'result'])
    assert(body.uuid === uuid, 'UUID authentication mismatch')
    const node = this.node(uuid)
    const job = node.job
    assert(config.enabled && config.nodes[uuid] && config.nodes[uuid].enabled, 'node disabled')
    assert(job && job.city === config.nodes[uuid].city, 'policy changed')
    assert(job && job.id === body.job_id && job.lease === body.lease, 'lease mismatch')
    const result = normalizeResult(body.result, uuid, job.city, this.now())
    if (job.status === 'completed') {
      assert(JSON.stringify(node.latest) === JSON.stringify(result), 'completed result differs')
      return { accepted: true, duplicate: true }
    }
    assert(job.status === 'running' && job.leaseUntil > this.now() && job.expires > this.now(), 'lease expired')
    node.latest = result
    job.status = 'completed'
    return { accepted: true, duplicate: false }
  }

  snapshot(config) {
    const nodes = {}
    for (const uuid of Object.keys(config.nodes)) {
      const node = this.nodes[uuid]
      nodes[uuid] = {
        enabled: config.enabled && config.nodes[uuid].enabled,
        seenAt: node ? node.seenAt : null,
        state: node && node.job ? (['queued', 'running'].includes(node.job.status) && node.job.expires <= this.now() ? 'expired' : node.job.status) : 'not-detected',
        latest: node ? node.latest : null,
      }
    }
    return { schema: 1, nodes }
  }

  exportState() { return { schema: 1, nodes: this.nodes } }

  importState(raw) {
    keys(raw, ['schema', 'nodes'])
    assert(raw.schema === 1 && Object.keys(raw.nodes).length <= 200, 'invalid stored state')
    for (const uuid of Object.keys(raw.nodes)) {
      assert(UUID.test(uuid), 'invalid stored UUID')
      const node = raw.nodes[uuid]
      assert(node && typeof node.lastStarted === 'number', 'invalid stored node')
      if (node.latest)
        normalizeResult(node.latest, uuid, node.latest.city, Date.parse(node.latest.collectedAt))
      if (node.job)
        assert(CITIES.includes(node.job.city) && JOB_ID.test(node.job.id), 'invalid stored job')
    }
    this.nodes = raw.nodes
  }
}
module.exports = { Coordinator, policy, normalizeResult, keys, UUID, CITIES, CARRIERS, TARGETS }
