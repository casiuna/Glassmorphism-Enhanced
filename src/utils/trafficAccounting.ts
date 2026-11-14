import type { TrafficCycleSnapshot } from '@/utils/trafficCycle'
import { trafficByMode } from '@/utils/trafficCycle'

interface TrafficCounters {
  net_total_up?: number
  net_total_down?: number
  traffic_limit?: number
  traffic_limit_type?: string
}

/**
 * Shared view accounting; raw counters remain untouched. An unset cycle may
 * show its explicitly cumulative quota reference, never a cycle remainder.
 */
export function trafficAccounting(node: TrafficCounters | undefined, resetDay: number | undefined, snapshot: TrafficCycleSnapshot | null, configError: string | null = null) {
  const configured = Boolean(resetDay)
  const valid = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0
  const ready = Boolean(node && configured && !configError && snapshot?.status === 'ready' && valid(snapshot.up) && valid(snapshot.down))
  const up = ready ? snapshot!.up : node && !configured && !configError ? node.net_total_up ?? 0 : null
  const down = ready ? snapshot!.down : node && !configured && !configError ? node.net_total_down ?? 0 : null
  const available = valid(up) && valid(down)
  const used = available ? trafficByMode(up, down, node?.traffic_limit_type) : null
  const limit = node?.traffic_limit ?? 0
  const limited = Number.isFinite(limit) && limit > 0
  const percentage = available && used !== null && limited ? Math.min(100, Math.max(0, used / limit * 100)) : null
  const remaining = ready && used !== null && limited ? Math.max(0, limit - used) : null
  const basis = ready ? 'billing-cycle' : available && !configured ? 'machine-cumulative' : 'unavailable'
  const label = configError ? '数据不足' : !node ? '读取中' : !configured ? available ? '累计流量' : '数据不足' : snapshot?.status === 'loading' || !snapshot ? '读取中' : ready ? '本周期已用' : '数据不足'
  return { configured, ready, available, basis, up: available ? up : null, down: available ? down : null, used, percentage, remaining, label }
}
