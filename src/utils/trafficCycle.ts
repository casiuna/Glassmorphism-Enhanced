export const TRAFFIC_TIME_ZONE = 'Asia/Shanghai'
export const TRAFFIC_CONFIG_KEY = 'trafficCycleConfig'
export const TRAFFIC_METRICS = ['traffic.up', 'traffic.down', 'net.total.up', 'net.total.down'] as const
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const HOUR = 3600000
const OFFSET = 8 * HOUR
// Same reset-aware plausibility bound as Komari 1.6.0, per original sample,
// NOT per rollup bucket. Never clamp a real aggregate to a small quota.
const MAX_SAMPLE_BYTES = 64 * 1024 ** 3

export interface TrafficCycleConfig { version: 1, timeZone: typeof TRAFFIC_TIME_ZONE, nodes: Record<string, { resetDay: number }> }
export interface TrafficPeriod { start: number, end: number }
export type TrafficCycleStatus = 'loading' | 'ready' | 'insufficient' | 'unsupported' | 'error'
export interface TrafficCycleSnapshot {
  status: TrafficCycleStatus
  period: TrafficPeriod
  asOf: number
  up: number | null
  down: number | null
  reason: string
}
interface Point { time: number, value: number, count: number }

export function isNodeUUID(value: string): boolean {
  return UUID.test(value)
}
export function validResetDay(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 31
}
export function parseTrafficCycleConfig(raw: unknown): { document: TrafficCycleConfig, error: string | null } {
  const empty: TrafficCycleConfig = { version: 1, timeZone: TRAFFIC_TIME_ZONE, nodes: {} }
  if (raw === undefined || raw === null || raw === '')
    return { document: empty, error: null }
  try {
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!value || typeof value !== 'object' || Array.isArray(value) || value.version !== 1 || value.timeZone !== TRAFFIC_TIME_ZONE || !value.nodes || typeof value.nodes !== 'object' || Array.isArray(value.nodes) || Object.keys(value).some(k => !['version', 'timeZone', 'nodes'].includes(k)) || Object.keys(value.nodes).length > 5000)
      throw new Error('schema')
    for (const [uuid, node] of Object.entries(value.nodes)) {
      const row = node as Record<string, unknown>
      if (!UUID.test(uuid) || !row || Array.isArray(row) || !validResetDay(row.resetDay) || Object.keys(row).some(k => k !== 'resetDay'))
        throw new Error('node')
    }
    return { document: structuredClone(value) as TrafficCycleConfig, error: null }
  }
  catch {
    return { document: empty, error: '流量周期配置无效；不会按月初重置或覆盖原配置' }
  }
}
export function changeTrafficReset(raw: unknown, uuid: string, resetDay: number | null): string {
  const parsed = parseTrafficCycleConfig(raw)
  if (parsed.error || !UUID.test(uuid) || (resetDay !== null && !validResetDay(resetDay)))
    throw new Error('无效的 UUID、重置日或已有周期配置；未写入')
  if (resetDay === null)
    delete parsed.document.nodes[uuid]
  else
    parsed.document.nodes[uuid] = { resetDay }
  const serialized = JSON.stringify(parsed.document)
  if (parseTrafficCycleConfig(serialized).error)
    throw new Error('流量周期配置超过支持范围；未写入')
  return serialized
}
function boundary(year: number, month: number, day: number): number {
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  return Date.UTC(year, month, Math.min(day, lastDay)) - OFFSET
}
/** Shanghai midnight calendar boundaries, [start,end); never add 30 days. */
export function trafficPeriod(resetDay: number, now = Date.now()): TrafficPeriod {
  if (!validResetDay(resetDay) || !Number.isFinite(now))
    throw new Error('需要有效的重置日和时间')
  const local = new Date(now + OFFSET)
  const year = local.getUTCFullYear()
  const month = local.getUTCMonth()
  if (year < 2000 || year > 9998)
    throw new Error('不支持的计费日历年份')
  const current = boundary(year, month, resetDay)
  return now >= current
    ? { start: current, end: boundary(year, month + 1, resetDay) }
    : { start: boundary(year, month - 1, resetDay), end: current }
}
export function trafficByMode(up: number, down: number, mode: string | undefined): number {
  switch (mode) {
    case 'up': return up
    case 'down': return down
    case 'min': return Math.min(up, down)
    case 'max': return Math.max(up, down)
    default: return up + down
  }
}
export function trafficSnapshot(status: TrafficCycleStatus, period: TrafficPeriod, asOf: number, reason: string): TrafficCycleSnapshot {
  return { status, period, asOf, up: null, down: null, reason }
}
/**
 * Only native, summable, reset-aware deltas. Counter snapshots prove coverage;
 * subtracting counter endpoints or silently treating missing history as zero
 * would lose resets and is deliberately forbidden here.
 */
export function resolveTrafficMetrics(raw: unknown, uuid: string, period: TrafficPeriod, asOf: number): TrafficCycleSnapshot {
  const missing = (reason: string) => trafficSnapshot('insufficient', period, asOf, reason)
  try {
    if (!isNodeUUID(uuid) || !Number.isFinite(asOf) || asOf < period.start || asOf > period.end)
      return missing('计费区间无效')
    const data = raw as { series?: unknown[], start?: string, end?: string }
    if (!data || !Array.isArray(data.series) || data.series.length > 16)
      return missing('流量历史协议不兼容')
    const points = new Map<string, Point[]>()
    let interval = 1000
    for (const metric of data.series) {
      const row = metric as { metric_key: string, entity_id: string, points: Array<{ time: string, value: unknown, count?: number }>, downsampled?: boolean, downsample_algorithm?: string, interval_seconds?: number }
      if (row.entity_id !== uuid || !TRAFFIC_METRICS.includes(row.metric_key as typeof TRAFFIC_METRICS[number]) || points.has(row.metric_key) || !Array.isArray(row.points) || row.points.length > 200000)
        return missing('历史节点身份或指标不一致')
      const step = row.downsampled ? Number(row.interval_seconds) * 1000 : 1000
      if (!Number.isFinite(step) || step <= 0 || step > HOUR || HOUR % step !== 0)
        return missing('历史聚合精度不足以按重置边界计费')
      if (row.downsampled && row.downsample_algorithm !== (row.metric_key.startsWith('traffic.') ? 'sum' : 'last'))
        return missing('流量历史没有使用可求和的原生增量')
      interval = Math.max(interval, step)
      const seen = new Set<number>()
      const normalized: Point[] = []
      for (const point of row.points) {
        const time = Date.parse(point.time)
        const count = point.count ?? 1
        if (!Number.isFinite(time) || typeof point.value !== 'number' || !Number.isSafeInteger(point.value) || point.value < 0 || !Number.isSafeInteger(count) || count < 1 || seen.has(time))
          return missing('历史包含缺失、重复或异常流量样本')
        if (row.metric_key.startsWith('traffic.') && point.value / count > MAX_SAMPLE_BYTES)
          return missing('历史流量增量异常，未计入配额')
        seen.add(time)
        normalized.push({ time, value: point.value, count })
      }
      points.set(row.metric_key, normalized.sort((a, b) => a.time - b.time))
    }
    if (points.size !== TRAFFIC_METRICS.length)
      return missing('缺少可靠的上传、下载或周期起点历史')
    for (const key of ['net.total.up', 'net.total.down']) {
      if (!points.get(key)!.some(p => p.time <= period.start && p.time >= period.start - HOUR))
        return missing('周期起点缺少可靠历史；未假设起点为零')
    }
    if (asOf === period.start)
      return { status: 'ready', period, asOf, up: 0, down: 0, reason: '有可靠起点的新周期空区间' }
    const totals: number[] = []
    for (const key of ['traffic.up', 'traffic.down']) {
      const records = points.get(key)!.filter(p => p.time >= period.start && p.time < asOf)
      if (!records.length || records[0]!.time > period.start + HOUR || asOf - records.at(-1)!.time > interval + 90000)
        return missing('当前周期历史缺失或采样已过期')
      if (records.some((point, index) => index > 0 && point.time - records[index - 1]!.time > HOUR + 90000))
        return missing('当前周期历史存在中断；未将缺失时段当作零流量')
      const sum = records.reduce((value, p) => value + p.value, 0)
      if (!Number.isSafeInteger(sum))
        return missing('累计增量超出安全精度')
      totals.push(sum)
    }
    if (!Number.isSafeInteger(totals[0]! + totals[1]!))
      return missing('累计增量超出安全精度')
    return { status: 'ready', period, asOf, up: totals[0]!, down: totals[1]!, reason: 'Komari 原生流量增量（保留重启/回绕处理）' }
  }
  catch {
    return missing('流量历史无效；未更改累计计数器')
  }
}
