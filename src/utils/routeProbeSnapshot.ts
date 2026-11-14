import type { ReturnCarrier } from '@/utils/returnRouteClassification'
import type { AutoReturnRoute, ReturnRouteDisplay, ReturnRouteDocument } from '@/utils/returnRoutes'
import type { ProbeProtocol } from '@/utils/routeProbeEvidence'
import { CDN_ID, cdnTraceFromSnapshot } from '@/utils/cdnRouteEvidence'
import { RETURN_CARRIERS } from '@/utils/returnRouteClassification'
import { parseReturnRouteConfig, resolveReturnRoutes } from '@/utils/returnRoutes'
import { evidenceKeys } from '@/utils/routeProbeEvidence'

export type ProtocolPaths = Partial<Record<ReturnCarrier, Partial<Record<ProbeProtocol, AutoReturnRoute>>>>
export interface ProbeNode {
  enabled: boolean
  state: string
  seenAt: number | null
  registeredAt?: number | null
  helperVersion?: string | null
  auto: Partial<Record<ReturnCarrier, AutoReturnRoute>>
  protocols?: ProtocolPaths
}
export interface ProbeSnapshot { nodes: Record<string, ProbeNode> }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const UTC_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/

export function parseProbeSnapshot(raw: unknown): ProbeSnapshot {
  if (!raw || typeof raw !== 'object')
    throw new Error('invalid companion snapshot')
  const data = raw as { schema?: unknown, nodes?: Record<string, Record<string, unknown>> }
  if (data.schema !== 1 || !data.nodes || typeof data.nodes !== 'object' || Array.isArray(data.nodes) || Object.keys(data.nodes).length > 400)
    throw new Error('invalid companion protocol')
  const nodes: ProbeSnapshot['nodes'] = {}
  for (const [uuid, value] of Object.entries(data.nodes)) {
    if (!UUID.test(uuid) || !value || typeof value.enabled !== 'boolean' || typeof value.state !== 'string')
      throw new Error('invalid companion node')
    const latest = value.latest as ({ schema: number, uuid: string, city?: string, source: string, collectedAt: string, carriers: Record<string, unknown>, protocols?: unknown } & Record<string, unknown>) | null
    let auto: ProbeNode['auto'] = {}
    let protocols: ProtocolPaths | undefined
    if (latest) {
      if (![1, 2, 3].includes(latest.schema) || latest.uuid !== uuid || !(latest.schema === 3 ? ['helper', 'replay'] : ['helper', 'fixture']).includes(latest.source) || !latest.carriers || !RETURN_CARRIERS.every(carrier => Object.hasOwn(latest.carriers, carrier)))
        throw new Error('invalid companion result binding')
      if (latest.schema === 1) {
        const rows = Object.fromEntries(Object.entries(latest.carriers).map(([carrier, row]) => [carrier, { ...(row as object), collectedAt: latest.collectedAt, source: latest.source }]))
        const parsed = parseReturnRouteConfig({ version: 1, nodes: { [uuid]: { auto: rows } } })
        if (parsed.error)
          throw new Error('invalid companion route evidence')
        auto = parsed.document.nodes[uuid]!.auto
      }
      else {
        const cdn = latest.schema === 3
        evidenceKeys(latest, ['schema', 'uuid', 'city', 'source', 'collectedAt', 'protocols', 'carriers', ...(cdn ? ['targetBinding', 'dns', 'captures', 'captureOrigin'] : [])])
        if (!(cdn ? latest.city === CDN_ID : ['beijing', 'shanghai', 'guangzhou', 'hubei'].includes(String(latest.city))) || !Array.isArray(latest.protocols) || !latest.protocols.length || latest.protocols.length > 2 || (cdn && latest.protocols.length !== 2) || new Set(latest.protocols).size !== latest.protocols.length || !latest.protocols.every(p => p === 'tcp' || p === 'udp'))
          throw new Error('invalid fixed protocol selection')
        const batchTime = Date.parse(latest.collectedAt)
        if (typeof latest.collectedAt !== 'string' || !UTC_TIME.test(latest.collectedAt) || !Number.isFinite(batchTime) || new Date(batchTime).toISOString().slice(0, 19) !== latest.collectedAt.slice(0, 19))
          throw new Error('invalid batch time')
        if (cdn) {
          evidenceKeys(latest.captureOrigin, ['uuid', 'city', 'collectedAt'])
          if (typeof latest.captureOrigin.uuid !== 'string' || !UUID.test(latest.captureOrigin.uuid) || !['hubei-cdn-trial', CDN_ID].includes(String(latest.captureOrigin.city)) || latest.captureOrigin.collectedAt !== latest.collectedAt || (latest.source === 'helper' && (latest.captureOrigin.uuid !== uuid || latest.captureOrigin.city !== latest.city)))
            throw new Error('invalid recorded capture provenance')
        }
        evidenceKeys(latest.carriers, RETURN_CARRIERS)
        protocols = {}
        let queries = 0
        for (const carrier of RETURN_CARRIERS) {
          const values = latest.carriers[carrier]
          evidenceKeys(values, latest.protocols)
          protocols[carrier] = {}
          for (const protocol of latest.protocols as ProbeProtocol[]) {
            const row = values[protocol]
            evidenceKeys(row, ['protocol', 'family', 'direction', 'target', 'collectedAt', 'status', 'reachedTarget', 'hops', 'asnLookup'])
            if (row.protocol !== protocol || row.target !== `${latest.city}-${carrier}` || typeof row.status !== 'string' || row.family !== 4)
              throw new Error('invalid fixed protocol binding')
            const parsed = parseReturnRouteConfig({ version: 1, nodes: { [uuid]: { auto: { [carrier]: { ...row, source: latest.source, ...(cdn ? { cdn: cdnTraceFromSnapshot(latest, carrier, protocol) } : {}) } } } } })
            if (parsed.error)
              throw new Error('invalid protocol evidence')
            const trace = parsed.document.nodes[uuid]!.auto[carrier]!
            const time = Date.parse(trace.collectedAt)
            if (time > batchTime || batchTime - time > 300000)
              throw new Error('protocol time outside batch')
            queries += trace.asnLookup!.queries
            protocols[carrier]![protocol] = trace
          }
          const traces = Object.values(protocols[carrier]!)
          const newest = [...traces].sort((a, b) => Date.parse(b.collectedAt) - Date.parse(a.collectedAt))[0]!
          // A multi-protocol placeholder has no combined hops. Presentation is
          // derived from each independent record below, never a flattened path.
          auto[carrier] = traces.length === 1 ? newest : { ...newest, hops: [], status: 'unknown', reachedTarget: false }
        }
        if (queries > 8)
          throw new Error('ASN query budget exceeded')
      }
    }
    nodes[uuid] = { enabled: value.enabled, state: value.state.slice(0, 40), seenAt: typeof value.seenAt === 'number' && Number.isFinite(value.seenAt) ? value.seenAt : null, registeredAt: typeof value.registeredAt === 'number' && Number.isFinite(value.registeredAt) ? value.registeredAt : null, helperVersion: typeof value.helperVersion === 'string' ? value.helperVersion.slice(0, 96) : null, auto, ...(protocols ? { protocols } : {}) }
  }
  return { nodes }
}

export function withProbeResults(document: ReturnRouteDocument, uuid: string, snapshot: ProbeSnapshot): ReturnRouteDocument {
  const node = snapshot.nodes[uuid]
  if (!node?.enabled)
    return document
  const existing = document.nodes[uuid] ?? { manual: {}, auto: {} }
  const auto = { ...existing.auto }
  for (const carrier of RETURN_CARRIERS) {
    const incoming = node.auto[carrier]
    const saved = auto[carrier]
    if (incoming && (!saved || Date.parse(incoming.collectedAt) >= Date.parse(saved.collectedAt)))
      auto[carrier] = incoming
  }
  return { version: 1, nodes: { [uuid]: { manual: existing.manual, auto } } }
}

export function protocolEvidenceGroups(uuid: string, paths: ProtocolPaths, ttlHours: number, now: number) {
  return (['unicom', 'telecom', 'mobile'] as const).flatMap((carrier) => {
    const values = paths[carrier]
    if (!values || !Object.keys(values).length)
      return []
    const rows = (Object.entries(values) as Array<[ProbeProtocol, AutoReturnRoute]>).map(([protocol, trace]) => ({ protocol, trace, display: resolveReturnRoutes({ version: 1, nodes: { [uuid]: { manual: {}, auto: { [carrier]: trace } } } }, uuid, true, ttlHours, now).find(r => r.carrier === carrier)! }))
    const base = rows[0]!.display
    return [{ carrier, rows, summary: protocolRouteDisplay(uuid, base, values, ttlHours, now) }]
  })
}

export function pathSignature(trace: AutoReturnRoute): string {
  return JSON.stringify(trace.hops.map(h => [h.ttl, [...h.asns].sort((a, b) => a - b), [...(h.ips ?? [])].sort()]))
}
export function protocolRouteDisplay(uuid: string, base: ReturnRouteDisplay, paths: Partial<Record<ProbeProtocol, AutoReturnRoute>>, ttlHours: number, now: number): ReturnRouteDisplay {
  if (base.source === 'manual')
    return base
  const items = Object.entries(paths) as Array<[ProbeProtocol, AutoReturnRoute]>
  const displays = items.map(([protocol, trace]) => ({ protocol, trace, display: resolveReturnRoutes({ version: 1, nodes: { [uuid]: { manual: {}, auto: { [base.carrier]: trace } } } }, uuid, true, ttlHours, now).find(r => r.carrier === base.carrier)! }))
  if (!displays.length)
    return base
  const detail = displays.map(r => `${r.protocol.toUpperCase()}: ${r.display.label} (${r.display.status}) · ${r.trace.collectedAt}`).join('；')
  if (displays.length === 1)
    return { ...displays[0]!.display, protocolState: 'single', detail: `${detail}；非商业线路认证` }
  if (displays.every(r => r.display.status === 'expired'))
    return { ...base, label: '已过期', status: 'expired', protocolState: 'partial', detail }
  if (displays.some(r => r.display.status === 'expired' || r.display.status === 'failed' || r.display.status === 'not-detected'))
    return { ...base, label: 'TCP/UDP 待复核', status: 'unknown', protocolState: 'partial', detail }
  if (pathSignature(displays[0]!.trace) !== pathSignature(displays[1]!.trace))
    return { ...base, label: 'TCP/UDP 路径不同', status: 'unknown', protocolState: 'different', detail: `${detail}；协议路径分歧，未合并` }
  const cautious = displays.find(r => r.display.status === 'unknown')?.display ?? displays[0]!.display
  return { ...cautious, protocolState: 'same', detail: `${detail}；TCP/UDP 路径一致，但不代表商业线路认证` }
}
