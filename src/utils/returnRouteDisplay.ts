import type { ReturnRouteDisplay } from '@/utils/returnRoutes'

const QUALIFICATION = /[（(]/
const ROUTE_NAME = /^(?:CN2(?:GT|GIA)?|CTG(?:NET)?GIA|163|10099(?:\/CUG)?|9929|4837|CMNET|CMI(?:N?2)?)$/
const PREMIUM = /^(?:CN2GIA|CTG(?:NET)?GIA|9929|CMIN?2)$/
const NO_CURRENT_ROUTE = /^(?:未知|未测|未检测|无数据|暂无数据|已过期|过期|失败|探测失败|超时|权限不足|待复核|协议分歧|unknown|none|n\/a|[-—–]+)$/i
const INVALID_ROUTE_STATE = /(?:^|[\s/])(?:unknown|expired|failed|timeout)(?:$|[\s/])/i

/** Card-safe current labels only. Raw protocol evidence never belongs here. */
export function summaryReturnRoutes(entries: ReturnRouteDisplay[], allowAutomatic: boolean): ReturnRouteDisplay[] {
  return (['unicom', 'telecom', 'mobile'] as const).flatMap((carrier) => {
    const entry = entries.find(value => value.carrier === carrier)
    if (!entry || !entry.label.trim() || NO_CURRENT_ROUTE.test(entry.label.trim()) || INVALID_ROUTE_STATE.test(entry.label.trim()) || entry.source === 'fixture')
      return []
    if (entry.status === 'manual' && entry.source === 'manual')
      return [entry]
    if (entry.protocolState === 'different' || entry.protocolState === 'partial')
      return []
    if (allowAutomatic && entry.status === 'fresh-auto' && entry.source === 'auto')
      return [entry]
    return []
  })
}

export function compactReturnRoute(entry: ReturnRouteDisplay): string {
  if (entry.status === 'not-detected')
    return '未测'
  if (entry.status === 'expired')
    return '过期'
  if (entry.status === 'failed')
    return entry.label.includes('超时') ? '超时' : '失败'
  if (entry.protocolState === 'different')
    return '协议分歧'
  if (entry.protocolState === 'partial')
    return '待复核'
  const label = entry.label.trim()
  const canonical = label.replaceAll(' ', '').replaceAll('-', '').toUpperCase()
  // Compact only known aliases, never arbitrary administrator text.
  if (entry.source === 'manual' && !ROUTE_NAME.test(canonical))
    return label
  if (entry.source === 'manual')
    return canonical.replace('CN2GT', 'CN2').replace('CTGNETGIA', 'CTGGIA').replace('CMIN2', 'CMI2').replace('10099/CUG', '10099')
  if (label.includes('CN2 GT') && label.includes('混合'))
    return 'CN2GT/163?'
  if (label.includes('GIA') && (label.includes('候选') || label.includes('未认证')))
    return 'CN2GIA?'
  if (entry.status === 'unknown')
    return label === '未知' ? '未知' : `${label.split(QUALIFICATION)[0]!.replaceAll(' ', '').replace('10099/CUG', '10099')}?`
  return label.replaceAll(' ', '').replaceAll('-', '').replace('CN2GT', 'CN2').replace('CTGNETGIA', 'CTGGIA').replace('CMIN2', 'CMI2').replace('10099/CUG', '10099')
}
export function premiumManualRoute(entry: ReturnRouteDisplay): boolean {
  return entry.source === 'manual' && PREMIUM.test(entry.label.replaceAll(' ', '').replaceAll('-', '').toUpperCase())
}
export function returnRouteTime(at: string | null): string {
  const time = at ? Date.parse(at) : Number.NaN
  return Number.isFinite(time) ? `${new Date(time).toISOString().slice(0, 16).replace('T', ' ')} UTC` : '时间未提供'
}
