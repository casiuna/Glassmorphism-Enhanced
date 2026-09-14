import type { NodeData, TrafficLimitType } from '@/stores/nodes'
import type { MetricQueryResponse, StatusRecord } from '@/utils/rpc'
import type { MonthlyTrafficCycle } from '@/utils/trafficCycle'
import { SharedCache } from '@/services/cache.service'
import { loadNodeLoadRecordsByRange } from '@/services/history.service'
import { queryMetrics } from '@/services/metrics.service'
import { requestManager } from '@/services/request.service'
import { RpcError } from '@/utils/rpc'
import { getMonthlyTrafficCycle } from '@/utils/trafficCycle'

export type MonthlyTrafficUsageSource = 'metric' | 'history' | 'legacy'

export interface MonthlyTrafficUsage {
  uuid: string
  cycleKey: string | null
  cycleStart: string | null
  cycleEnd: string | null
  up: number
  down: number
  used: number
  percentage: number
  source: MonthlyTrafficUsageSource
}

const TRAFFIC_METRIC_KEYS = ['traffic.up', 'traffic.down'] as const
const TRAFFIC_HISTORY_MAX_COUNT = -1
const TRAFFIC_CACHE_TTL_MS = 30_000
const TRAFFIC_CACHE_CLEANUP_MS = 5 * 60_000

const monthlyTrafficUsageCache = new SharedCache<MonthlyTrafficUsage>({
  maxSize: 2_000,
  ttl: TRAFFIC_CACHE_TTL_MS,
  cleanupInterval: TRAFFIC_CACHE_CLEANUP_MS,
})

function finiteNonNegative(value: unknown): number | null {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue) || numericValue < 0)
    return null
  return Math.min(numericValue, Number.MAX_SAFE_INTEGER)
}

function combineTraffic(up: number, down: number, trafficLimitType: TrafficLimitType): number {
  switch (trafficLimitType) {
    case 'up': return up
    case 'down': return down
    case 'min': return Math.min(up, down)
    case 'max': return Math.max(up, down)
    case 'sum':
    default: return up + down
  }
}

function createUsage(
  node: NodeData,
  cycle: MonthlyTrafficCycle | null,
  up: number,
  down: number,
  source: MonthlyTrafficUsageSource,
): MonthlyTrafficUsage {
  const safeUp = finiteNonNegative(up) ?? 0
  const safeDown = finiteNonNegative(down) ?? 0
  const used = combineTraffic(safeUp, safeDown, node.traffic_limit_type)
  const limit = finiteNonNegative(node.traffic_limit) ?? 0

  return {
    uuid: node.uuid,
    cycleKey: cycle?.key ?? null,
    cycleStart: cycle?.start.toISOString() ?? null,
    cycleEnd: cycle?.end.toISOString() ?? null,
    up: safeUp,
    down: safeDown,
    used,
    percentage: limit > 0 ? Math.min(Math.max(used / limit * 100, 0), 100) : 0,
    source,
  }
}

function getLegacyUsage(node: NodeData, cycle: MonthlyTrafficCycle | null = null): MonthlyTrafficUsage {
  const up = finiteNonNegative(node.net_total_up) ?? 0
  const down = finiteNonNegative(node.net_total_down) ?? 0
  return createUsage(node, cycle, up, down, 'legacy')
}

function usageCacheKey(uuid: string, cycleKey: string): string {
  return `traffic:monthly:${uuid}:${cycleKey}`
}

function metricBatchRequestKey(cycle: MonthlyTrafficCycle, now: Date, uuids: string[]): string {
  return `traffic:metric:${cycle.key}:${now.toISOString()}:${[...uuids].sort().join(',')}`
}

function historyBatchRequestKey(cycle: MonthlyTrafficCycle, now: Date, uuids: string[]): string {
  return `traffic:history:${cycle.key}:${now.toISOString()}:${[...uuids].sort().join(',')}`
}

/** Sum every returned bucket for one metric/entity pair; never use only the latest point. */
export function sumTrafficMetricSeries(response: MetricQueryResponse, metricKey: string, entityId: string): number {
  let total = 0
  for (const series of response.series ?? []) {
    if (series.metric_key !== metricKey || series.entity_id !== entityId)
      continue
    for (const point of series.points ?? []) {
      const value = finiteNonNegative(point.value)
      if (value !== null)
        total += value
    }
  }
  return Math.min(total, Number.MAX_SAFE_INTEGER)
}

function hasMetricMethodUnavailable(error: unknown): boolean {
  return error instanceof RpcError && error.code === -32601
}

async function loadMetricUsageForGroup(
  nodes: NodeData[],
  cycle: MonthlyTrafficCycle,
  now: Date,
): Promise<Map<string, MonthlyTrafficUsage>> {
  const uuids = nodes.map(node => node.uuid).sort()
  if (now.getTime() <= cycle.start.getTime())
    return new Map(nodes.map(node => [node.uuid, createUsage(node, cycle, 0, 0, 'metric')]))

  const response = await requestManager.run(
    metricBatchRequestKey(cycle, now, uuids),
    async () => queryMetrics({
      metric_keys: [...TRAFFIC_METRIC_KEYS],
      entity_ids: uuids,
      start: cycle.start.toISOString(),
      end: now.toISOString(),
      aggregation: 'sum',
      max_points: 2_000,
    }),
  )

  return new Map(nodes.map(node => [node.uuid, createUsage(
    node,
    cycle,
    sumTrafficMetricSeries(response, 'traffic.up', node.uuid),
    sumTrafficMetricSeries(response, 'traffic.down', node.uuid),
    'metric',
  )]))
}

function sumHistoryTraffic(records: StatusRecord[], node: NodeData, cycle: MonthlyTrafficCycle, now: Date): MonthlyTrafficUsage {
  let up = 0
  let down = 0
  let hasTrafficDelta = false
  const startTime = cycle.start.getTime()
  const endTime = now.getTime()

  for (const record of records) {
    const recordTime = Date.parse(String(record.time))
    if (!Number.isFinite(recordTime) || recordTime < startTime || recordTime > endTime)
      continue

    const recordUp = finiteNonNegative(record.traffic_up)
    const recordDown = finiteNonNegative(record.traffic_down)
    if (recordUp !== null) {
      up += recordUp
      hasTrafficDelta = true
    }
    if (recordDown !== null) {
      down += recordDown
      hasTrafficDelta = true
    }
  }

  return hasTrafficDelta ? createUsage(node, cycle, up, down, 'history') : getLegacyUsage(node, cycle)
}

async function loadHistoryUsageForGroup(
  nodes: NodeData[],
  cycle: MonthlyTrafficCycle,
  now: Date,
): Promise<Map<string, MonthlyTrafficUsage>> {
  const uuids = nodes.map(node => node.uuid).sort()
  return requestManager.run(
    historyBatchRequestKey(cycle, now, uuids),
    async () => {
      const results = await Promise.all(nodes.map(async (node) => {
        const records = await loadNodeLoadRecordsByRange(node.uuid, cycle.start, now, TRAFFIC_HISTORY_MAX_COUNT)
        return [node.uuid, sumHistoryTraffic(records, node, cycle, now)] as const
      }))
      return new Map(results)
    },
  )
}

/**
 * Load one shared monthly usage map. The metric path is the Komari 1.5.0 path;
 * history is only used when the metric method is unavailable or fails.
 */
export async function loadMonthlyTrafficUsage(nodes: readonly NodeData[], now = new Date()): Promise<Map<string, MonthlyTrafficUsage>> {
  const result = new Map<string, MonthlyTrafficUsage>()
  const groups = new Map<string, { cycle: MonthlyTrafficCycle, nodes: NodeData[] }>()

  for (const node of nodes) {
    const cycle = getMonthlyTrafficCycle(node, now)
    if (!cycle) {
      result.set(node.uuid, getLegacyUsage(node))
      continue
    }

    const group = groups.get(cycle.key) ?? { cycle, nodes: [] }
    group.nodes.push(node)
    groups.set(cycle.key, group)
  }

  await Promise.all(Array.from(groups.values()).map(async ({ cycle, nodes: groupNodes }) => {
    const missingNodes: NodeData[] = []
    for (const node of groupNodes) {
      const cached = monthlyTrafficUsageCache.get(usageCacheKey(node.uuid, cycle.key))
      if (cached)
        result.set(node.uuid, cached)
      else
        missingNodes.push(node)
    }

    if (missingNodes.length === 0)
      return

    let fetched: Map<string, MonthlyTrafficUsage>
    try {
      fetched = await loadMetricUsageForGroup(missingNodes, cycle, now)
    }
    catch (error) {
      if (!hasMetricMethodUnavailable(error))
        console.warn('月流量 metric 查询失败，尝试历史兼容链:', error)
      try {
        fetched = await loadHistoryUsageForGroup(missingNodes, cycle, now)
      }
      catch (historyError) {
        console.warn('月流量历史兼容查询失败，保留 v1.0.1 累计显示:', historyError)
        fetched = new Map(missingNodes.map(node => [node.uuid, getLegacyUsage(node, cycle)]))
      }
    }

    for (const node of missingNodes) {
      const usage = fetched.get(node.uuid) ?? getLegacyUsage(node, cycle)
      monthlyTrafficUsageCache.set(usageCacheKey(node.uuid, cycle.key), usage)
      result.set(node.uuid, usage)
    }
  }))

  return result
}

export function getMonthlyTrafficUsageCacheSize(): number {
  return monthlyTrafficUsageCache.size
}
