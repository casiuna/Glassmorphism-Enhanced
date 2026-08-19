import type { NodeData } from '@/stores/nodes'
import { parseTags } from '@/utils/tagHelper'

export interface NodeUpstreamRelation {
  child: NodeData
  upstream: NodeData
}

const NORMALIZE_SPACE_REGEX = /\s+/g
const UPSTREAM_PREFIXES = new Set(['upstream', 'parent', '上游', '父节点'])
const UPSTREAM_SEPARATORS = [':', '=', '：'] as const

export function normalizeNodeRef(value: string): string {
  return value.trim().toLowerCase().replace(NORMALIZE_SPACE_REGEX, ' ')
}

export function parseUpstreamRef(text: string): string {
  const trimmed = text.trim()
  const lower = trimmed.toLowerCase()

  for (const separator of UPSTREAM_SEPARATORS) {
    const separatorIndex = lower.indexOf(separator)
    if (separatorIndex <= 0)
      continue

    const key = lower.slice(0, separatorIndex).trim()
    if (!UPSTREAM_PREFIXES.has(key))
      continue

    return trimmed.slice(separatorIndex + separator.length).trim()
  }

  return ''
}

export function getNodeUpstreamRefs(node: Pick<NodeData, 'tags'>): string[] {
  return parseTags(node.tags)
    .map(tag => parseUpstreamRef(tag.text))
    .filter(Boolean)
}

export function buildNodeLookup(nodes: NodeData[]): Map<string, NodeData> {
  const lookup = new Map<string, NodeData>()
  for (const node of nodes) {
    lookup.set(normalizeNodeRef(node.uuid), node)
    lookup.set(normalizeNodeRef(node.name), node)
    if (node.remark)
      lookup.set(normalizeNodeRef(node.remark), node)
    if (node.public_remark)
      lookup.set(normalizeNodeRef(node.public_remark), node)
  }
  return lookup
}

export function buildNodeUpstreamRelations(nodes: NodeData[]): NodeUpstreamRelation[] {
  const lookup = buildNodeLookup(nodes)
  return nodes.flatMap((child) => {
    const upstream = getNodeUpstreamRefs(child)
      .map(reference => lookup.get(normalizeNodeRef(reference)))
      .find((candidate): candidate is NodeData => Boolean(candidate && candidate.uuid !== child.uuid))
    return upstream ? [{ child, upstream }] : []
  })
}
