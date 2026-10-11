import type { TrafficLimitType } from '@/stores/nodes'
import type { MetricQueryResponse, MetricSeries } from '@/utils/rpc'

export type TrafficDataStatus = 'ready' | 'partial' | 'unknown' | 'loading' | 'not-applicable'

export function trafficValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER ? value : null
}

/** The configured Komari mode, not an inferred provider billing policy. */
export function combineMonthlyTraffic(up: number | null, down: number | null, mode: TrafficLimitType): number | null {
  if (mode === 'up')
    return up
  if (mode === 'down')
    return down
  if (up === null || down === null)
    return null
  if (mode === 'min')
    return Math.min(up, down)
  if (mode === 'max')
    return Math.max(up, down)
  if (mode !== 'sum')
    return null
  return trafficValue(up + down)
}

export interface TrafficSeriesEvidence {
  total: number | null
  complete: boolean
}

/**
 * Only certify observable bucket coverage, never raw report completeness or a bill.
 * Count=0/null is missing, even if fill_empty supplies value=0. Exact entity and
 * one untagged series are required; duplicate dimensions cannot be safely added.
 */
export function analyzeTrafficSeries(response: MetricQueryResponse, key: string, uuid: string, start: Date, end: Date): TrafficSeriesEvidence {
  const matches = (response.series ?? []).filter(s => s.metric_key === key && s.entity_id === uuid)
  if (matches.length !== 1)
    return { total: null, complete: false }
  const series: MetricSeries = matches[0]!
  const startMs = start.getTime()
  const endMs = end.getTime()
  const unlocatable = (series.points ?? []).some(p => !Number.isFinite(Date.parse(p.time)))
  const points = (series.points ?? []).filter(p => Date.parse(p.time) >= startMs && Date.parse(p.time) < endMs)
  const valid = points.filter(p => trafficValue(p.value) !== null && (p.count === undefined || p.count > 0))
  const total = valid.length ? trafficValue(valid.reduce((sum, p) => sum + p.value!, 0)) : null
  const interval = (series.interval_seconds ?? 0) * 1000
  const tagged = [series.tags, series.tag].some(tags => tags && Object.keys(tags).length)
    || points.some(p => [p.tags, p.tag, p.labels].some(tags => tags && Object.keys(tags).length))
  const metadataValid = Date.parse(response.start) === startMs && Date.parse(response.end) === endMs
    && series.downsampled === true && series.downsample_algorithm === 'sum' && !tagged && !unlocatable
    // adaptiveFillPublicMetricSeries may rewrite interval_seconds according to
    // sparse observations; such metadata cannot prove aggregation coverage.
    && series.fill_empty !== true
    && interval > 0 && Number.isSafeInteger(interval) && 86_400_000 % interval === 0
    && startMs % interval === 0 && endMs > startMs
  if (!metadataValid || total === null)
    return { total, complete: false }
  const expected = Math.ceil((endMs - startMs) / interval)
  if (expected > 100_000 || points.length !== expected)
    return { total, complete: false }
  const ordered = [...points].sort((a, b) => Date.parse(a.time) - Date.parse(b.time))
  const complete = ordered.every((point, i) => Date.parse(point.time) === startMs + i * interval
    && trafficValue(point.value) !== null && Number.isInteger(point.count) && point.count! > 0)
  return { total, complete }
}

export function monthlyTrafficLabel(status: TrafficDataStatus): string {
  if (status === 'partial')
    return '月度数据不完整/待核对'
  if (status === 'not-applicable')
    return '无明确月度周期/待核对'
  if (status === 'loading')
    return '月度数据加载中/待核对'
  if (status === 'unknown')
    return '暂无可靠月度数据/待核对'
  return '采集月度用量（非账单）'
}

export function formatMonthlyTraffic(usage: { status: TrafficDataStatus, used: number | null }, format: (bytes: number) => string): string {
  return usage.used === null ? monthlyTrafficLabel(usage.status) : format(usage.used)
}

export function formatMonthlyPercentage(value: number | null): string {
  return value === null ? '待核对' : `${value.toFixed(1)}%`
}
