import type { ReturnCarrier } from '@/utils/returnRouteClassification'
import type { NodeReturnRoutes } from '@/utils/returnRoutes'
import { RETURN_CARRIERS } from '@/utils/returnRouteClassification'
import { parseReturnRouteConfig, serializeReturnRoutes } from '@/utils/returnRoutes'

const UUID = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i
// Theme-only edit. Never touches Plugin configuration, dispatch or permissions.
export function manualRouteConfig(raw: unknown, uuid: string, values: Record<ReturnCarrier, string>, at = new Date().toISOString()): string {
  if (!UUID.test(uuid))
    throw new Error('请选择有效节点 UUID；未写入')
  const parsed = parseReturnRouteConfig(raw)
  if (parsed.error)
    throw new Error('原有线路 JSON 无效；未覆盖，请先在高级选项修复')
  // Validate with the shared parser, but do not use its normalized projection as
  // the storage document: it deliberately strips unrecognized extension fields.
  const original = raw == null || raw === '' ? {} : typeof raw === 'string' ? JSON.parse(raw) : JSON.parse(JSON.stringify(raw))
  const document = { ...original, version: 1, nodes: { ...original.nodes } }
  if (parsed.migrated) {
    for (const [key, row] of Object.entries(parsed.document.nodes))
      document.nodes[key] = { ...document.nodes[key], manual: row.manual, auto: document.nodes[key].auto ?? {} }
  }
  const node = { ...document.nodes[uuid], manual: { ...document.nodes[uuid]?.manual }, auto: document.nodes[uuid]?.auto ?? {} }
  for (const carrier of RETURN_CARRIERS) {
    const label = values[carrier].trim()
    if (!label)
      delete node.manual[carrier]
    else if (label !== node.manual[carrier]?.label)
      node.manual[carrier] = { ...node.manual[carrier], label, updatedAt: at }
  }
  document.nodes[uuid] = node
  serializeReturnRoutes(document) // Apply the same bounds and validation; no partial writes.
  return JSON.stringify(document, null, 2)
}
export function manualValues(node: NodeReturnRoutes | undefined): Record<ReturnCarrier, string> {
  return { unicom: node?.manual.unicom?.label ?? '', telecom: node?.manual.telecom?.label ?? '', mobile: node?.manual.mobile?.label ?? '' }
}
