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

export interface MonthlyTrafficUsageOptions {
  /** Only an explicitly opened single-node detail context may use history fallback. */
  allowHistoryFallback?: boolean
}

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
export const MONTHLY_TRAFFIC_CACHE_TTL_MS = 10 * 60_000
const TRAFFIC_CACHE_CLEANUP_MS = 5 * 60_000

const monthlyTrafficUsageCache = new SharedCache<MonthlyTrafficUsage>({
  maxSize: 2_000,
  ttl: MONTHLY_TRAFFIC_CACHE_TTL_MS,
  cleanupInterval: TRAFFIC_CACHE_CLEANUP_MS,
})

function finiteNonNegative(value: unknown): number | null {
  if (value === null || value === undefined || value === '')
    return null
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

type MonthlyTrafficCacheMode = 'shared' | 'detail-history'

function usageCacheKey(node: NodeData, cycleKey: string, mode: MonthlyTrafficCacheMode): string {
  return `traffic:monthly:${mode}:${node.uuid}:${cycleKey}:${node.traffic_limit}:${node.traffic_limit_type}`
}

function metricBatchRequestKey(cycle: MonthlyTrafficCycle, now: Date, uuids: string[]): string {
  return `traffic:metric:${cycle.key}:${now.toISOString()}:${[...uuids].sort().join(',')}`
}

function historyRequestKey(cycle: MonthlyTrafficCycle, now: Date, uuid: string): string {
  return `traffic:history:${cycle.key}:${now.toISOString()}:${uuid}`
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

function hasUsableTrafficMetricSeries(response: MetricQueryResponse, metricKey: string, entityId: string): boolean {
  return (response.series ?? []).some(series => series.metric_key === metricKey
    && series.entity_id === entityId
    && (series.points ?? []).some(point => finiteNonNegative(point.value) !== null))
}

export function hasUsableTrafficMetricData(
  response: MetricQueryResponse,
  entityId: string,
  trafficLimitType: TrafficLimitType,
): boolean {
  const hasUp = hasUsableTrafficMetricSeries(response, 'traffic.up', entityId)
  const hasDown = hasUsableTrafficMetricSeries(response, 'traffic.down', entityId)

  if (trafficLimitType === 'up')
    return hasUp
  if (trafficLimitType === 'down')
    return hasDown
  return hasUp && hasDown
}

function hasMetricMethodUnavailable(error: unknown): boolean {
  return error instanceof RpcError && error.code === -32601
}

async function loadMetricUsageForGroup(
  nodes: NodeData[],
  cycle: MonthlyTrafficCycle,
  now: Date,
  options: MonthlyTrafficUsageOptions,
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

  const metricUsages = new Map<string, MonthlyTrafficUsage>()
  const nodesMissingMetricData: NodeData[] = []

  for (const node of nodes) {
    if (!hasUsableTrafficMetricData(response, node.uuid, node.traffic_limit_type)) {
      nodesMissingMetricData.push(node)
      continue
    }

    metricUsages.set(node.uuid, createUsage(
      node,
      cycle,
      sumTrafficMetricSeries(response, 'traffic.up', node.uuid),
      sumTrafficMetricSeries(response, 'traffic.down', node.uuid),
      'metric',
    ))
  }

  if (nodesMissingMetricData.length === 0)
    return metricUsages

  if (!options.allowHistoryFallback || nodesMissingMetricData.length !== 1) {
    for (const node of nodesMissingMetricData)
      metricUsages.set(node.uuid, getLegacyUsage(node, cycle))
    return metricUsages
  }

  try {
    const node = nodesMissingMetricData[0]!
    metricUsages.set(node.uuid, await loadHistoryUsageForNode(node, cycle, now))
  }
  catch (error) {
    console.warn('月流量节点 metric 数据缺失，单节点历史兼容链不可用，保留 legacy 显示:', error)
    const node = nodesMissingMetricData[0]!
    metricUsages.set(node.uuid, getLegacyUsage(node, cycle))
  }

  return metricUsages
}

function sumHistoryTraffic(records: StatusRecord[], node: NodeData, cycle: MonthlyTrafficCycle, now: Date): MonthlyTrafficUsage {
  let up = 0
  let down = 0
  let hasUpDelta = false
  let hasDownDelta = false
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
      hasUpDelta = true
    }
    if (recordDown !== null) {
      down += recordDown
      hasDownDelta = true
    }
  }

  const hasRequiredDelta = node.traffic_limit_type === 'up'
    ? hasUpDelta
    : node.traffic_limit_type === 'down'
      ? hasDownDelta
      : hasUpDelta && hasDownDelta
  return hasRequiredDelta ? createUsage(node, cycle, up, down, 'history') : getLegacyUsage(node, cycle)
}

async function loadHistoryUsageForNode(
  node: NodeData,
  cycle: MonthlyTrafficCycle,
  now: Date,
): Promise<MonthlyTrafficUsage> {
  return requestManager.run(
    historyRequestKey(cycle, now, node.uuid),
    async () => {
      const records = await loadNodeLoadRecordsByRange(node.uuid, cycle.start, now, TRAFFIC_HISTORY_MAX_COUNT)
      return sumHistoryTraffic(records, node, cycle, now)
    },
  )
}

/**
 * Load one shared monthly usage map. Home/shared contexts use the Komari 1.5.0
 * metric path and fall straight back to the v1.0.1 cumulative display when the
 * metric is unavailable. History is opt-in for one explicitly opened detail node.
 */
export async function loadMonthlyTrafficUsage(
  nodes: readonly NodeData[],
  now = new Date(),
  options: MonthlyTrafficUsageOptions = {},
): Promise<Map<string, MonthlyTrafficUsage>> {
  const result = new Map<string, MonthlyTrafficUsage>()
  const groups = new Map<string, { cycle: MonthlyTrafficCycle, nodes: NodeData[] }>()
  const cacheMode: MonthlyTrafficCacheMode = options.allowHistoryFallback ? 'detail-history' : 'shared'

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
      const cached = monthlyTrafficUsageCache.get(usageCacheKey(node, cycle.key, cacheMode))
      if (cached)
        result.set(node.uuid, cached)
      else
        missingNodes.push(node)
    }

    if (missingNodes.length === 0)
      return

    let fetched: Map<string, MonthlyTrafficUsage>
    try {
      fetched = await loadMetricUsageForGroup(missingNodes, cycle, now, options)
    }
    catch (error) {
      if (!options.allowHistoryFallback || missingNodes.length !== 1) {
        if (!hasMetricMethodUnavailable(error))
          console.warn('月流量 metric 查询失败，shared context 使用 legacy 显示:', error)
        fetched = new Map(missingNodes.map(node => [node.uuid, getLegacyUsage(node, cycle)]))
      }
      else {
        try {
          const node = missingNodes[0]!
          fetched = new Map([[node.uuid, await loadHistoryUsageForNode(node, cycle, now)]])
        }
        catch (historyError) {
          console.warn('月流量历史兼容查询失败，保留 v1.0.1 累计显示:', historyError)
          fetched = new Map(missingNodes.map(node => [node.uuid, getLegacyUsage(node, cycle)]))
        }
      }
    }

    for (const node of missingNodes) {
      const usage = fetched.get(node.uuid) ?? getLegacyUsage(node, cycle)
      monthlyTrafficUsageCache.set(usageCacheKey(node, cycle.key, cacheMode), usage)
      result.set(node.uuid, usage)
    }
  }))

  return result
}

export function getMonthlyTrafficUsageCacheSize(): number {
  return monthlyTrafficUsageCache.size
}
