import type { NodeGeoLocation, RegionCluster } from '@/composables/useNodeGeoClusters'
import type { NodeData } from '@/stores/nodes'
import { buildNodeUpstreamRelations } from '@/utils/nodeTopology'

export type EarthArcMode = 'auto' | 'persistent' | 'upstream' | 'off'
export type EarthArcSource = 'auto' | 'upstream'

export interface EarthArcData {
  id: string
  source: EarthArcSource
  from: [number, number]
  to: [number, number]
}

const AUTO_ARC_LIMIT = 24
const UPSTREAM_ARC_LIMIT = 48
const COORD_PRECISION = 3

function isValidCoord(coord: [number, number] | undefined): coord is [number, number] {
  return Boolean(coord
    && Number.isFinite(coord[0])
    && Number.isFinite(coord[1])
    && coord[0] >= -90
    && coord[0] <= 90
    && coord[1] >= -180
    && coord[1] <= 180)
}

function coordKey(coord: [number, number]): string {
  return `${coord[0].toFixed(COORD_PRECISION)},${coord[1].toFixed(COORD_PRECISION)}`
}

function uniqueClustersByCoord(clusters: RegionCluster[]): RegionCluster[] {
  const unique = new Map<string, RegionCluster>()
  for (const cluster of [...clusters].sort((left, right) => (
    right.servers - left.servers
    || right.onlineServers - left.onlineServers
    || left.id.localeCompare(right.id)
  ))) {
    if (isValidCoord(cluster.coord) && !unique.has(coordKey(cluster.coord)))
      unique.set(coordKey(cluster.coord), cluster)
  }
  return [...unique.values()]
}

export function buildAutomaticEarthArcs(clusters: RegionCluster[], limit = AUTO_ARC_LIMIT): EarthArcData[] {
  const cappedLimit = Math.max(0, Math.floor(limit))
  const candidates = uniqueClustersByCoord(clusters).slice(0, cappedLimit + 1)
  const hub = candidates[0]
  if (!hub)
    return []

  return candidates.slice(1).map(cluster => ({
    id: `auto:${cluster.id}->${hub.id}`,
    source: 'auto',
    from: cluster.coord,
    to: hub.coord,
  }))
}

export function buildUpstreamEarthArcs(
  nodes: NodeData[],
  locationByNodeUuid: ReadonlyMap<string, NodeGeoLocation>,
  limit = UPSTREAM_ARC_LIMIT,
): EarthArcData[] {
  const cappedLimit = Math.max(0, Math.floor(limit))
  if (cappedLimit === 0)
    return []
  const seen = new Set<string>()
  const arcs: EarthArcData[] = []
  const relations = buildNodeUpstreamRelations(nodes).sort((left, right) => (
    left.child.uuid.localeCompare(right.child.uuid)
    || left.upstream.uuid.localeCompare(right.upstream.uuid)
  ))

  for (const relation of relations) {
    const from = locationByNodeUuid.get(relation.child.uuid)?.coord
    const to = locationByNodeUuid.get(relation.upstream.uuid)?.coord
    if (!isValidCoord(from) || !isValidCoord(to))
      continue

    const edgeKey = `${coordKey(from)}->${coordKey(to)}`
    if (coordKey(from) === coordKey(to) || seen.has(edgeKey))
      continue

    seen.add(edgeKey)
    arcs.push({
      id: `upstream:${relation.child.uuid}->${relation.upstream.uuid}`,
      source: 'upstream',
      from,
      to,
    })
    if (arcs.length >= cappedLimit)
      break
  }

  return arcs
}

export function buildEarthArcs(
  mode: EarthArcMode,
  clusters: RegionCluster[],
  nodes: NodeData[],
  locationByNodeUuid: ReadonlyMap<string, NodeGeoLocation>,
): EarthArcData[] {
  if (mode === 'off')
    return []
  if (mode === 'upstream')
    return buildUpstreamEarthArcs(nodes, locationByNodeUuid)
  return buildAutomaticEarthArcs(clusters)
}
