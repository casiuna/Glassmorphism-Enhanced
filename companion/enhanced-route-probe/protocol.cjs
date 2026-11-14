'use strict'
// Selective redesign of Transit RouteProbeCoordinator (MIT):
// Copyright (c) 2026 yyy622hhh; Copyright (c) 2025 Tony Liu.
// Full notice: LICENSE. No Transit tag transport, legacy GET tokens or remote exec.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const JOB_ID = /^[0-9a-f]{48}$/
const HELPER_VERSION = /^\d+\.\d+\.\d+(?:[-+][0-9A-Z.+-]{1,80})?$/i
const CITIES = ['beijing', 'shanghai', 'guangzhou', 'hubei']
const CARRIERS = ['telecom', 'unicom', 'mobile']
const RAW_HASH = /^[a-f0-9]{64}$/
const CDN_ID = 'hubei-cdn'
const CDN_HOSTS = { telecom: 'hb-ct-v4.ip.zstaticcdn.com', unicom: 'hb-cu-v4.ip.zstaticcdn.com', mobile: 'hb-cm-v4.ip.zstaticcdn.com' }
function cdnProfiles(raw) {
  const profiles = typeof raw === 'string' ? JSON.parse(raw) : (raw ?? {})
  keys(profiles, [CDN_ID])
  for (const profile of Object.values(profiles)) {
    keys(profile, CARRIERS)
    for (const carrier of CARRIERS) {
      const row = profile[carrier]
      keys(row, ['hostname', 'udpPort', 'tcpPort'])
      assert(row.hostname === CDN_HOSTS[carrier] && [row.udpPort, row.tcpPort].every(p => Number.isInteger(p) && [80, 443].includes(p)), 'unapproved CDN host/port')
    }
  }
  return profiles
}
function cdnBinding(profile) {
  return JSON.stringify(CARRIERS.map(c => [c, profile[c].hostname, profile[c].udpPort, profile[c].tcpPort]))
}
function bindingProfile(binding) {
  assert(typeof binding === 'string' && binding.length <= 512, 'bounded CDN binding required')
  const rows = JSON.parse(binding)
  assert(Array.isArray(rows) && rows.length === 3 && rows.every((r, i) => Array.isArray(r) && r.length === 4 && r[0] === CARRIERS[i]), 'invalid CDN binding')
  const profile = Object.fromEntries(rows.map(r => [r[0], { hostname: r[1], udpPort: r[2], tcpPort: r[3] }]))
  cdnProfiles({ [CDN_ID]: profile })
  assert(cdnBinding(profile) === binding, 'noncanonical CDN binding')
  return profile
}
function publicV4(ip) {
  if (!ipv4(ip))
    return false
  const [a, b, c] = ip.split('.').map(Number)
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) || (a === 203 && b === 0 && c === 113))
}
const STATUSES = ['ok', 'unknown', 'timeout', 'permission-denied', 'no-traceroute', 'probe-failed', 'output-limit']
const TARGETS = {
  beijing: ['219.141.140.10', '202.106.195.68', '221.179.155.161'],
  shanghai: ['202.96.209.133', '210.22.97.1', '211.136.112.200'],
  guangzhou: ['58.60.188.222', '210.21.196.6', '120.196.165.24'],
  hubei: ['202.103.24.68', '218.104.111.122', '211.137.58.20'],
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
  keys(raw, ['enabled', 'nodes', 'cdnTargets'])
  const cdnTargets = cdnProfiles(raw.cdnTargets)
  const nodes = typeof raw.nodes === 'string' ? JSON.parse(raw.nodes) : raw.nodes || {}
  assert(Object.keys(nodes).length <= 200, 'too many nodes')
  keys(nodes, Object.keys(nodes))
  for (const uuid of Object.keys(nodes)) {
    assert(UUID.test(uuid), 'UUID required')
    const item = nodes[uuid]
    keys(item, ['enabled', 'city', 'periodMinutes'])
    assert(typeof item.enabled === 'boolean' && (CITIES.includes(item.city) || Object.hasOwn(cdnTargets, item.city)), 'invalid node policy')
    assert(Number.isInteger(item.periodMinutes) && item.periodMinutes >= 60 && item.periodMinutes <= 10080, 'period must be 60–10080 minutes')
  }
  return { enabled: raw.enabled === true, nodes, ...(raw.cdnTargets !== undefined ? { cdnTargets } : {}) }
}
function normalizeResult(result, uuid, city, now) {
  if (result && [2, 3].includes(result.schema))
    return normalizeV2Result(result, uuid, city, now)
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
const V4_PART = /^(?:0|[1-9]\d{0,2})$/
const UTC_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/
const PREFIX_HINTS = { CN2: '59.43.', 163: '202.97.', CMI: '223.120.' }
function ipv4(ip) {
  return typeof ip === 'string' && ip.split('.').length === 4 && ip.split('.').every(p => V4_PART.test(p) && Number(p) <= 255)
}
function evidenceTime(value, now) {
  assert(typeof value === 'string' && UTC_TIME.test(value), 'UTC evidence time required')
  const time = Date.parse(value)
  assert(Number.isFinite(time) && Math.abs(now - time) <= 300000 && new Date(time).toISOString().slice(0, 19) === value.slice(0, 19), 'invalid evidence time')
  return new Date(time).toISOString()
}
function normalizeV2Result(result, uuid, city, now) {
  const cdn = result.schema === 3
  keys(result, ['schema', 'uuid', 'city', 'collectedAt', 'source', 'carriers', 'protocols', ...(cdn ? ['targetBinding', 'dns', 'captures', 'captureOrigin'] : [])])
  assert(result.uuid === uuid && result.city === city && (cdn ? city === CDN_ID : CITIES.includes(city)), 'result binding mismatch')
  assert((cdn ? ['helper', 'replay'] : ['helper', 'fixture']).includes(result.source), 'invalid source')
  assert(Array.isArray(result.protocols) && result.protocols.length >= 1 && result.protocols.length <= 2 && new Set(result.protocols).size === result.protocols.length && result.protocols.every(p => p === 'udp' || p === 'tcp'), 'fixed protocols required')
  const collectedAt = evidenceTime(result.collectedAt, now)
  let profile
  if (cdn) {
    assert(result.protocols.length === 2, 'CDN dual protocols required')
    profile = bindingProfile(result.targetBinding)
    keys(result.dns, CARRIERS)
    keys(result.captures, CARRIERS)
    keys(result.captureOrigin, ['uuid', 'city', 'collectedAt'])
    assert(UUID.test(result.captureOrigin.uuid) && ['hubei-cdn-trial', CDN_ID].includes(result.captureOrigin.city) && result.captureOrigin.collectedAt === result.collectedAt, 'invalid capture provenance')
    if (result.source === 'helper')
      assert(result.captureOrigin.uuid === uuid && result.captureOrigin.city === city, 'live origin mismatch')
    for (const c of CARRIERS) {
      const dns = result.dns[c]
      keys(dns, ['hostname', 'addresses', 'selectedIPv4', 'resolvedAt'])
      assert(dns.hostname === profile[c].hostname && Array.isArray(dns.addresses) && dns.addresses.length >= 1 && dns.addresses.length <= 16 && new Set(dns.addresses).size === dns.addresses.length && dns.addresses.every(publicV4) && dns.addresses.includes(dns.selectedIPv4), 'unsafe DNS snapshot')
      evidenceTime(dns.resolvedAt, Date.parse(collectedAt))
      assert(Date.parse(dns.resolvedAt) <= Date.parse(collectedAt), 'DNS after collection')
      keys(result.captures[c], result.protocols)
      for (const p of result.protocols) {
        const meta = result.captures[c][p]
        keys(meta, ['port', 'exitCode', 'executionStatus', 'rawSha256'])
        assert(meta.port === profile[c][`${p}Port`] && RAW_HASH.test(meta.rawSha256) && STATUSES.includes(meta.executionStatus) && meta.executionStatus !== 'unknown' && (meta.exitCode === null ? meta.executionStatus !== 'ok' : Number.isInteger(meta.exitCode) && meta.exitCode >= -255 && meta.exitCode <= 255) && (meta.executionStatus !== 'ok' || meta.exitCode === 0), 'invalid execution/port evidence')
      }
    }
  }
  keys(result.carriers, CARRIERS)
  const carriers = {}
  let queries = 0
  for (const carrier of CARRIERS) {
    keys(result.carriers[carrier], result.protocols)
    carriers[carrier] = {}
    for (const protocol of result.protocols) {
      const row = result.carriers[carrier][protocol]
      keys(row, ['protocol', 'family', 'direction', 'target', 'collectedAt', 'status', 'reachedTarget', 'hops', 'asnLookup'])
      assert(row.protocol === protocol && row.family === 4 && row.direction === 'node-to-cn' && row.target === `${city}-${carrier}`, 'fixed IPv4 target/protocol required')
      assert(STATUSES.includes(row.status) && typeof row.reachedTarget === 'boolean' && Array.isArray(row.hops) && row.hops.length <= 20, 'invalid protocol result')
      const at = evidenceTime(row.collectedAt, Date.parse(collectedAt))
      assert(Date.parse(at) <= Date.parse(collectedAt), 'protocol time after batch')
      keys(row.asnLookup, ['enabled', 'queries', 'cacheHits', 'failures'])
      assert(typeof row.asnLookup.enabled === 'boolean' && ['queries', 'cacheHits', 'failures'].every(k => Number.isInteger(row.asnLookup[k]) && row.asnLookup[k] >= 0 && row.asnLookup[k] <= 80), 'invalid lookup accounting')
      assert(row.asnLookup.enabled || ['queries', 'cacheHits', 'failures'].every(k => row.asnLookup[k] === 0), 'disabled external lookup has activity')
      queries += row.asnLookup.queries
      const ttls = new Set()
      const hops = row.hops.map((hop) => {
        keys(hop, ['ttl', 'asns', 'ips', 'asnSource', 'prefixHints'])
        assert(Number.isInteger(hop.ttl) && hop.ttl >= 1 && hop.ttl <= 20 && !ttls.has(hop.ttl), 'invalid hop TTL')
        ttls.add(hop.ttl)
        assert(Array.isArray(hop.ips) && hop.ips.length <= 4 && hop.ips.every(ipv4) && new Set(hop.ips).size === hop.ips.length, 'invalid IPv4 responses')
        assert(Array.isArray(hop.asns) && hop.asns.length <= 4 && hop.asns.every(n => Number.isInteger(n) && n > 0 && n <= 4294967295) && new Set(hop.asns).size === hop.asns.length, 'invalid ASN')
        assert(['none', 'traceroute', 'team-cymru'].includes(hop.asnSource) && (hop.asns.length ? hop.asnSource !== 'none' && hop.ips.length > 0 : hop.asnSource === 'none'), 'invalid ASN provenance')
        assert(hop.asnSource !== 'team-cymru' || row.asnLookup.enabled, 'Cymru provenance without consented lookup')
        if (hop.prefixHints !== undefined)
          assert(!hop.asns.length && Array.isArray(hop.prefixHints) && hop.prefixHints.length <= 3 && new Set(hop.prefixHints).size === hop.prefixHints.length && hop.prefixHints.every(h => Object.hasOwn(PREFIX_HINTS, h) && hop.ips.some(ip => ip.startsWith(PREFIX_HINTS[h]))), 'prefix hints are not real ASNs')
        return { ttl: hop.ttl, asns: [...hop.asns], ips: [...hop.ips], asnSource: hop.asnSource, ...(hop.prefixHints ? { prefixHints: [...hop.prefixHints] } : {}) }
      }).sort((a, b) => a.ttl - b.ttl)
      const target = cdn ? result.dns[carrier].selectedIPv4 : TARGETS[city][CARRIERS.indexOf(carrier)]
      if (cdn)
        assert(Date.parse(result.dns[carrier].resolvedAt) <= Date.parse(at), 'DNS after protocol')
      assert(!row.reachedTarget || hops.some(h => h.ips.includes(target)), 'target reachability lacks response evidence')
      assert(row.status !== 'ok' || (row.reachedTarget && hops.some(h => h.asns.length)), 'ok result lacks ASN/target evidence')
      carriers[carrier][protocol] = { protocol, family: 4, direction: 'node-to-cn', target: row.target, collectedAt: at, status: row.status, reachedTarget: row.reachedTarget, hops, asnLookup: { ...row.asnLookup } }
    }
  }
  assert(queries <= 8, 'external ASN query budget exceeded')
  return { schema: cdn ? 3 : 2, uuid, city, collectedAt, source: result.source, protocols: [...result.protocols], carriers, ...(cdn ? { targetBinding: result.targetBinding, dns: JSON.parse(JSON.stringify(result.dns)), captures: JSON.parse(JSON.stringify(result.captures)), captureOrigin: { ...result.captureOrigin } } : {}) }
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
    node.job = { id: this.randomId(), city, status: 'queued', createdAt: now, expires: now + 600000, lease: null, leaseUntil: 0, ...(city === CDN_ID ? { targetBinding: cdnBinding(config.cdnTargets[city]) } : {}) }
    node.lastStarted = now
    return node.job
  }

  register(uuid, version) {
    assert(typeof version === 'string' && HELPER_VERSION.test(version), 'invalid helper version')
    const node = this.node(uuid)
    node.registeredAt = node.registeredAt ?? this.now()
    node.helperVersion = version
    return { schema: 1, uuid, registered: true }
  }

  poll(uuid, config, version) {
    if (version !== undefined)
      this.register(uuid, version)
    this.node(uuid).seenAt = this.now()
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
    if (job && (job.city !== setting.city || (job.city === CDN_ID && job.targetBinding !== cdnBinding(config.cdnTargets[CDN_ID])))) {
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
    return { schema: 1, uuid, state: 'running', job: { id: job.id, city: job.city, lease: job.lease, leaseUntil: job.leaseUntil, ...(job.targetBinding ? { targetBinding: job.targetBinding } : {}) } }
  }

  submit(uuid, body, config) {
    keys(body, ['token', 'uuid', 'job_id', 'lease', 'result'])
    assert(body.uuid === uuid, 'UUID authentication mismatch')
    const node = this.node(uuid)
    const job = node.job
    assert(config.enabled && config.nodes[uuid] && config.nodes[uuid].enabled, 'node disabled')
    assert(job && job.city === config.nodes[uuid].city, 'policy changed')
    assert(job && job.id === body.job_id && job.lease === body.lease, 'lease mismatch')
    assert(body.result?.source !== 'replay', 'historical replay requires disabled administrator restore')
    if (job.city === CDN_ID)
      assert(body.result?.schema === 3 && body.result.targetBinding === job.targetBinding && job.targetBinding === cdnBinding(config.cdnTargets[CDN_ID]), 'CDN policy/lease binding changed')
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
    for (const uuid of new Set([...Object.keys(config.nodes), ...Object.keys(this.nodes)])) {
      const node = this.nodes[uuid]
      nodes[uuid] = {
        enabled: Boolean(config.enabled && config.nodes[uuid]?.enabled),
        seenAt: node ? node.seenAt : null,
        registeredAt: node?.registeredAt ?? null,
        helperVersion: node?.helperVersion || null,
        state: node && node.job ? (['queued', 'running'].includes(node.job.status) && node.job.expires <= this.now() ? 'expired' : node.job.status) : 'not-detected',
        latest: node ? node.latest : null,
      }
    }
    return { schema: 1, nodes }
  }

  exportState() { return { schema: 1, nodes: this.nodes } }

  restoreNode(uuid, node, config) {
    assert(config.enabled === false, 'disable collection before restoring')
    if (node.latest?.schema === 3)
      assert(config.cdnTargets?.[CDN_ID] && node.latest.targetBinding === cdnBinding(config.cdnTargets[CDN_ID]), 'administrator CDN whitelist required for import')
    this.importState({ schema: 1, nodes: { ...this.nodes, [uuid]: node } })
    return { restored: true, uuid }
  }

  importState(raw) {
    keys(raw, ['schema', 'nodes'])
    assert(raw.schema === 1 && Object.keys(raw.nodes).length <= 200, 'invalid stored state')
    for (const uuid of Object.keys(raw.nodes)) {
      assert(UUID.test(uuid), 'invalid stored UUID')
      const node = raw.nodes[uuid]
      keys(node, ['seenAt', 'registeredAt', 'helperVersion', 'lastStarted', 'latest', 'job'])
      assert(Number.isFinite(node.lastStarted) && node.lastStarted >= 0, 'invalid stored node')
      assert(node.seenAt === null || (Number.isFinite(node.seenAt) && node.seenAt >= 0), 'invalid heartbeat')
      assert(node.registeredAt === undefined || (Number.isFinite(node.registeredAt) && node.registeredAt >= 0), 'invalid registration time')
      assert(node.helperVersion === undefined || (typeof node.helperVersion === 'string' && HELPER_VERSION.test(node.helperVersion)), 'invalid helper version')
      if (node.latest)
        normalizeResult(node.latest, uuid, node.latest.city, Date.parse(node.latest.collectedAt))
      if (node.job) {
        keys(node.job, ['id', 'city', 'status', 'createdAt', 'expires', 'lease', 'leaseUntil', 'targetBinding'])
        assert((CITIES.includes(node.job.city) || node.job.city === CDN_ID) && JOB_ID.test(node.job.id), 'invalid stored job')
        if (node.job.city === CDN_ID)
          bindingProfile(node.job.targetBinding)
        else
          assert(node.job.targetBinding === undefined, 'unexpected stored CDN binding')
        assert(['queued', 'running', 'completed', 'cancelled', 'expired'].includes(node.job.status), 'invalid job status')
        assert([node.job.createdAt, node.job.expires, node.job.leaseUntil].every(n => Number.isFinite(n) && n >= 0), 'invalid job clock')
        assert(node.job.lease === null || JOB_ID.test(node.job.lease), 'invalid lease')
      }
    }
    this.nodes = raw.nodes
  }
}
module.exports = { Coordinator, policy, normalizeResult, keys, UUID, CITIES, CARRIERS, TARGETS, CDN_ID, CDN_HOSTS, cdnProfiles, cdnBinding, bindingProfile, publicV4 }
