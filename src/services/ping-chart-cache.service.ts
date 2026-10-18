import type { PingRecord, PingTaskInfo } from '@/utils/rpc'
import { TIME_MS } from '@/constants/time'
import { SharedCache } from '@/services/cache.service'

export type PingChartRange = { hours: number } | { start: string, end: string }

export interface PingChartCacheParams {
  uuid: string
  range: PingChartRange
  maxCount: number
  preserveHours: number
}

export interface PingChartHistory {
  records: PingRecord[]
  tasks: PingTaskInfo[]
  legacyCustomRangeFallback: boolean
}

export const PING_CHART_CACHE_TTL_MS = TIME_MS.minute
export const PING_CHART_CACHE_MAX_SIZE = 128

function cacheKey(params: PingChartCacheParams): string {
  const range = 'hours' in params.range
    ? ['hours', params.range.hours]
    : ['custom', params.range.start, params.range.end]
  return JSON.stringify(['ping-chart:v1', params.uuid, range, params.maxCount, params.preserveHours])
}

function copyHistory(history: PingChartHistory): PingChartHistory {
  return {
    records: history.records.map(record => ({ ...record })),
    tasks: history.tasks.map(task => ({
      ...task,
      ...(task.clients ? { clients: [...task.clients] } : {}),
    })),
    legacyCustomRangeFallback: history.legacyCustomRangeFallback,
  }
}

function isComplete(params: PingChartCacheParams, history: PingChartHistory): boolean {
  if (!Array.isArray(history.records) || !history.records.length || !Array.isArray(history.tasks) || !history.tasks.length)
    return false

  const validTasks = history.tasks.every(task => task
    && Number.isFinite(task.id)
    && typeof task.name === 'string'
    && Number.isFinite(task.interval)
    && Number.isFinite(task.loss)
    && (task.clients === undefined || (Array.isArray(task.clients) && task.clients.every(client => typeof client === 'string'))))
  if (!validTasks)
    return false

  const taskIds = new Set(history.tasks.map(task => task.id))
  return taskIds.size === history.tasks.length && history.records.every(record => record
    && record.client === params.uuid
    && taskIds.has(record.task_id)
    && Number.isFinite(record.value)
    && Number.isFinite(Date.parse(record.time)))
}

export function createPingChartCache() {
  const cache = new SharedCache<PingChartHistory>({
    maxSize: PING_CHART_CACHE_MAX_SIZE,
    ttl: PING_CHART_CACHE_TTL_MS,
  })

  return {
    get(params: PingChartCacheParams): PingChartHistory | undefined {
      const cached = cache.get(cacheKey(params))
      return cached ? copyHistory(cached) : undefined
    },
    set(params: PingChartCacheParams, history: PingChartHistory): void {
      if (isComplete(params, history))
        cache.set(cacheKey(params), copyHistory(history))
    },
  }
}

export const pingChartCache = createPingChartCache()
