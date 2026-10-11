import type { NodeData, TrafficLimitType } from '@/stores/nodes'
import type { TrafficDataStatus } from '@/utils/monthlyTraffic'
import type { MetricQueryResponse, StatusRecord } from '@/utils/rpc'
import type { MonthlyTrafficCycle } from '@/utils/trafficCycle'
import { SharedCache } from '@/services/cache.service'
import { loadNodeLoadRecordsByRange } from '@/services/history.service'
import { queryMetrics } from '@/services/metrics.service'

import { analyzeTrafficSeries, combineMonthlyTraffic, trafficValue } from '@/utils/monthlyTraffic'
import { getMonthlyTrafficCycle } from '@/utils/trafficCycle'

export type MonthlyTrafficUsageSource = 'metric' | 'history' | 'unavailable'
export interface MonthlyTrafficUsageOptions {
  /** Enforced for one node only; never enabled by shared/home. */
  allowHistoryFallback?: boolean
}
export interface MonthlyTrafficUsage {
  uuid: string
  cycleKey: string | null
  cycleStart: string | null
  cycleEnd: string | null
  configKey: string
  sampledAt: string | null
  /** Observed deltas, nullable; partial values must not be presented as a quota. */
  up: number | null
  down: number | null
  observedUsed: number | null
  used: number | null
  percentage: number | null
  source: MonthlyTrafficUsageSource
  status: TrafficDataStatus
  basis: TrafficLimitType
}

export const MONTHLY_TRAFFIC_CACHE_TTL_MS = 10 * 60_000
const monthlyTrafficUsageCache = new SharedCache<MonthlyTrafficUsage>({
  maxSize: 2000,
  ttl: MONTHLY_TRAFFIC_CACHE_TTL_MS,
  cleanupInterval: 5 * 60_000,
})

export function monthlyTrafficConfigKey(node: NodeData, cycle: MonthlyTrafficCycle | null): string {
  return [node.uuid, cycle?.key, node.billing_cycle, node.expired_at, node.traffic_limit, node.traffic_limit_type].join(':')
}

function createUsage(node: NodeData, cycle: MonthlyTrafficCycle | null, up: number | null, down: number | null, source: MonthlyTrafficUsageSource, status: TrafficDataStatus, now: Date | null = null): MonthlyTrafficUsage {
  const observedUsed = combineMonthlyTraffic(up, down, node.traffic_limit_type)
  const used = status === 'ready' ? observedUsed : null
  const limit = trafficValue(node.traffic_limit)
  return {
    uuid: node.uuid,
    cycleKey: cycle?.key ?? null,
    cycleStart: cycle?.start.toISOString() ?? null,
    cycleEnd: cycle?.end.toISOString() ?? null,
    configKey: monthlyTrafficConfigKey(node, cycle),
    sampledAt: now?.toISOString() ?? null,
    up,
    down,
    observedUsed,
    used,
    percentage: used !== null && limit !== null && limit > 0 ? Math.min(used / limit * 100, 100) : null,
    source,
    status,
    basis: node.traffic_limit_type,
  }
}

export function unavailableMonthlyTraffic(node: NodeData, cycle: MonthlyTrafficCycle | null, status: TrafficDataStatus = cycle ? 'unknown' : 'not-applicable'): MonthlyTrafficUsage {
  return createUsage(node, cycle, null, null, 'unavailable', status)
}

/** Diagnostic helper only. Production quota values also require coverage evidence. */
export function sumTrafficMetricSeries(response: MetricQueryResponse, key: string, uuid: string): number | null {
  const points = (response.series ?? []).filter(s => s.metric_key === key && s.entity_id === uuid).flatMap(s => s.points ?? [])
  const values = points.map(p => trafficValue(p.value)).filter((v): v is number => v !== null)
  return values.length ? trafficValue(values.reduce((a, b) => a + b, 0)) : null
}

export function hasUsableTrafficMetricData(response: MetricQueryResponse, uuid: string, mode: TrafficLimitType): boolean {
  return combineMonthlyTraffic(sumTrafficMetricSeries(response, 'traffic.up', uuid), sumTrafficMetricSeries(response, 'traffic.down', uuid), mode) !== null
}

export function metricMonthlyTraffic(node: NodeData, cycle: MonthlyTrafficCycle, now: Date, response: MetricQueryResponse): MonthlyTrafficUsage {
  const up = analyzeTrafficSeries(response, 'traffic.up', node.uuid, cycle.start, now)
  const down = analyzeTrafficSeries(response, 'traffic.down', node.uuid, cycle.start, now)
  const validMode = ['up', 'down', 'min', 'max', 'sum'].includes(node.traffic_limit_type)
  const complete = validMode && (node.traffic_limit_type === 'up' ? up.complete : node.traffic_limit_type === 'down' ? down.complete : up.complete && down.complete)
  const hasObserved = up.total !== null || down.total !== null
  return createUsage(node, cycle, up.total, down.total, 'metric', complete ? 'ready' : hasObserved ? 'partial' : 'unknown', now)
}

/**
 * 1.5.x reconstructs missing traffic fields as default zeros and drops metric
 * counts/interval metadata. Even contiguous records cannot certify completeness.
 * Keep the bounded observed subtotal, but never promote it to a reliable quota.
 */
export function historyMonthlyTraffic(records: StatusRecord[], node: NodeData, cycle: MonthlyTrafficCycle, now: Date): MonthlyTrafficUsage {
  const selected = records.filter(r => r.client === node.uuid && Date.parse(String(r.time)) >= cycle.start.getTime() && Date.parse(String(r.time)) < now.getTime())
  const sum = (key: 'traffic_up' | 'traffic_down') => {
    const values = selected.map(r => trafficValue(r[key])).filter((v): v is number => v !== null)
    return values.length ? trafficValue(values.reduce((a, b) => a + b, 0)) : null
  }
  const up = sum('traffic_up')
  const down = sum('traffic_down')
  return createUsage(node, cycle, up, down, 'history', up !== null || down !== null ? 'partial' : 'unknown', now)
}

async function historyUsage(node: NodeData, cycle: MonthlyTrafficCycle, now: Date): Promise<MonthlyTrafficUsage> {
  // The history service owns range-keyed dedupe/concurrency, just like metrics.
  const records = await loadNodeLoadRecordsByRange(node.uuid, cycle.start, now, -1)
  return historyMonthlyTraffic(records, node, cycle, now)
}

async function metricGroup(nodes: NodeData[], cycle: MonthlyTrafficCycle, now: Date, historyAllowed: boolean): Promise<Map<string, MonthlyTrafficUsage>> {
  if (now.getTime() <= cycle.start.getTime())
    return new Map(nodes.map(n => [n.uuid, unavailableMonthlyTraffic(n, cycle)]))
  const uuids = nodes.map(n => n.uuid).sort()
  let response: MetricQueryResponse
  try {
    // queryMetrics already owns requestManager dedupe/concurrency. Do not hold
    // an outer pool slot while waiting for another slot in the same manager.
    response = await queryMetrics({
      metric_keys: ['traffic.up', 'traffic.down'],
      entity_ids: uuids,
      start: cycle.start.toISOString(),
      end: now.toISOString(),
      aggregation: 'sum',
      max_points: 2000,
      // Komari adaptive filling may inflate interval_seconds to the observed
      // sparse cadence. Keep the genuine aggregation interval to detect gaps.
      fill_empty: false,
    })
  }
  catch {
    if (historyAllowed)
      return new Map([[nodes[0]!.uuid, await historyUsage(nodes[0]!, cycle, now)]])
    return new Map(nodes.map(n => [n.uuid, unavailableMonthlyTraffic(n, cycle)]))
  }
  const result = new Map(nodes.map(n => [n.uuid, metricMonthlyTraffic(n, cycle, now, response)]))
  if (historyAllowed && result.get(nodes[0]!.uuid)?.status === 'unknown')
    result.set(nodes[0]!.uuid, await historyUsage(nodes[0]!, cycle, now))
  return result
}

/** Shared batched metrics; no legacy substitution, no per-node history fanout. */
export async function loadMonthlyTrafficUsage(nodes: readonly NodeData[], now = new Date(), options: MonthlyTrafficUsageOptions = {}): Promise<Map<string, MonthlyTrafficUsage>> {
  const result = new Map<string, MonthlyTrafficUsage>()
  const groups = new Map<string, { cycle: MonthlyTrafficCycle, nodes: NodeData[] }>()
  const historyAllowed = options.allowHistoryFallback === true && nodes.length === 1
  const mode = historyAllowed ? 'detail-history' : 'shared'
  for (const node of nodes) {
    const cycle = getMonthlyTrafficCycle(node, now)
    if (!cycle) {
      result.set(node.uuid, unavailableMonthlyTraffic(node, null))
      continue
    }
    const group = groups.get(cycle.key) ?? { cycle, nodes: [] }
    group.nodes.push(node)
    groups.set(cycle.key, group)
  }
  await Promise.all(Array.from(groups.values(), async ({ cycle, nodes: groupNodes }) => {
    const missing: NodeData[] = []
    const key = (node: NodeData) => `traffic:monthly:${mode}:${monthlyTrafficConfigKey(node, cycle)}`
    for (const node of groupNodes) {
      const cached = monthlyTrafficUsageCache.get(key(node))
      if (cached)
        result.set(node.uuid, cached)
      else
        missing.push(node)
    }
    if (!missing.length)
      return
    let fetched: Map<string, MonthlyTrafficUsage>
    try {
      fetched = await metricGroup(missing, cycle, now, historyAllowed)
    }
    catch {
      fetched = new Map(missing.map(n => [n.uuid, unavailableMonthlyTraffic(n, cycle)]))
    }
    for (const node of missing) {
      const usage = fetched.get(node.uuid) ?? unavailableMonthlyTraffic(node, cycle)
      monthlyTrafficUsageCache.set(key(node), usage)
      result.set(node.uuid, usage)
    }
  }))
  return result
}

export function getMonthlyTrafficUsageCacheSize(): number {
  return monthlyTrafficUsageCache.size
}
