import type { AutoReturnRoute, ReturnRouteDocument } from '@/utils/returnRoutes'
import { RETURN_CARRIERS } from '@/utils/returnRouteClassification'
import { parseReturnRouteConfig } from '@/utils/returnRoutes'

export interface ProbeNode {
  enabled: boolean
  state: string
  seenAt: number | null
  auto: Partial<Record<'telecom' | 'unicom' | 'mobile', AutoReturnRoute>>
}
export interface ProbeSnapshot { nodes: Record<string, ProbeNode> }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function parseProbeSnapshot(raw: unknown): ProbeSnapshot {
  if (!raw || typeof raw !== 'object')
    throw new Error('invalid companion snapshot')
  const data = raw as { schema?: unknown, nodes?: Record<string, Record<string, unknown>> }
  if (data.schema !== 1 || !data.nodes || typeof data.nodes !== 'object' || Array.isArray(data.nodes) || Object.keys(data.nodes).length > 200)
    throw new Error('invalid companion protocol')
  const nodes: ProbeSnapshot['nodes'] = {}
  for (const [uuid, value] of Object.entries(data.nodes)) {
    if (!UUID.test(uuid) || !value || typeof value.enabled !== 'boolean' || typeof value.state !== 'string')
      throw new Error('invalid companion node')
    const latest = value.latest as { schema: number, uuid: string, source: string, collectedAt: string, carriers: Record<string, unknown> } | null
    let auto: ProbeNode['auto'] = {}
    if (latest) {
      if (latest.schema !== 1 || latest.uuid !== uuid || !['helper', 'fixture'].includes(latest.source) || !latest.carriers || !RETURN_CARRIERS.every(carrier => Object.hasOwn(latest.carriers, carrier)))
        throw new Error('invalid companion result binding')
      const rows = Object.fromEntries(Object.entries(latest.carriers).map(([carrier, row]) => [carrier, { ...(row as object), collectedAt: latest.collectedAt, source: latest.source }]))
      const parsed = parseReturnRouteConfig({ version: 1, nodes: { [uuid]: { auto: rows } } })
      if (parsed.error)
        throw new Error('invalid companion route evidence')
      auto = parsed.document.nodes[uuid]!.auto
    }
    nodes[uuid] = { enabled: value.enabled, state: value.state.slice(0, 40), seenAt: typeof value.seenAt === 'number' ? value.seenAt : null, auto }
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
  // Manual settings remain authoritative. Plugin results are not written back to
  // theme settings or user tags; this merge only affects the current view.
  return { version: 1, nodes: { [uuid]: { manual: existing.manual, auto } } }
}
