import type { NodePingHistoryPoint, NodePingTaskStatsState } from '@/composables/useNodePingStats'
import type { NodeCarrierPingStatsState } from '@/utils/carrierPing'
import { aggregateChinaCarrierPingStats } from '@/utils/carrierPing'

export interface TransitCarrierPingRule {
  target: string
  relay: string
  task: string
}

/** Exact, case-sensitive names; last valid rule wins. Invalid input is inert. */
const RULE_NEWLINE = /\r?\n/
const TRANSIT_HISTORY_SLOT_COUNT = 20

export function parseTransitCarrierPingRules(value: unknown): TransitCarrierPingRule[] {
  if (typeof value !== 'string')
    return []
  const rules = new Map<string, TransitCarrierPingRule>()
  for (const raw of value.split(RULE_NEWLINE)) {
    const line = raw.trim()
    if (!line || line.startsWith('#'))
      continue
    const parts = line.split('|').map(part => part.trim())
    if (parts.length !== 3 || parts.some(part => !part))
      continue
    const [target, relay, task] = parts as [string, string, string]
    if (target === relay)
      continue
    rules.set(target, { target, relay, task })
  }
  return [...rules.values()]
}

export function mergeTransitLatency(a: number | null, b: number | null): number | null {
  return a === null || b === null || !Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b < 0 ? null : a + b
}

/** Both inputs and output are percentages, matching the existing Ping stats. */
export function mergeTransitLoss(a: number | null, b: number | null): number | null {
  if (a === null || b === null || !Number.isFinite(a) || !Number.isFinite(b) || a < 0 || a > 100 || b < 0 || b > 100)
    return null
  return 100 * (1 - (1 - a / 100) * (1 - b / 100))
}

interface NormalizedTransitHistory {
  start: number
  end: number
  slots: Array<NodePingHistoryPoint | undefined>
}

function averageHistoryMetric(points: NodePingHistoryPoint[], metric: 'latency' | 'loss'): number | null {
  const values = points
    .map(point => point[metric])
    .filter((value): value is number => value !== null && Number.isFinite(value))
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
}

/** Normalize each segment by its own slot order, while keeping disjoint windows separate. */
function normalizeTransitHistory(points: NodePingHistoryPoint[]): NormalizedTransitHistory | undefined {
  const timedPoints = points
    .map(point => ({ point, timestamp: Date.parse(point.time) }))
    .filter((entry): entry is { point: NodePingHistoryPoint, timestamp: number } => Number.isFinite(entry.timestamp))
    .sort((left, right) => left.timestamp - right.timestamp)
  if (!timedPoints.length)
    return undefined

  const slotPoints: NodePingHistoryPoint[][] = []
  for (let index = 0; index < TRANSIT_HISTORY_SLOT_COUNT; index++)
    slotPoints.push([])
  timedPoints.forEach(({ point }, index) => {
    const slot = timedPoints.length === 1
      ? 0
      : Math.round(index * (TRANSIT_HISTORY_SLOT_COUNT - 1) / (timedPoints.length - 1))
    slotPoints[slot]!.push(point)
  })

  return {
    start: timedPoints[0]!.timestamp,
    end: timedPoints.at(-1)!.timestamp,
    slots: slotPoints.map((slot) => {
      if (!slot.length)
        return undefined
      return {
        time: slot.at(-1)!.time,
        latency: averageHistoryMetric(slot, 'latency'),
        loss: averageHistoryMetric(slot, 'loss'),
      }
    }),
  }
}

/** Align both segments on one 20-slot timeline; an absent segment stays null. */
export function mergeTransitHistory(a: NodePingHistoryPoint[], b: NodePingHistoryPoint[]): NodePingHistoryPoint[] {
  const left = normalizeTransitHistory(a)
  const right = normalizeTransitHistory(b)
  if (!left && !right)
    return []

  const start = Math.min(left?.start ?? Number.POSITIVE_INFINITY, right?.start ?? Number.POSITIVE_INFINITY)
  const end = Math.max(left?.end ?? Number.NEGATIVE_INFINITY, right?.end ?? Number.NEGATIVE_INFINITY)
  const width = Math.max(1, (end - start) / (TRANSIT_HISTORY_SLOT_COUNT - 1))
  const windowsOverlap = left && right
    ? Math.max(left.start, right.start) <= Math.min(left.end, right.end)
    : false

  return Array.from({ length: TRANSIT_HISTORY_SLOT_COUNT }, (_, index) => {
    const leftPoint = left?.slots[index]
    const rightPoint = windowsOverlap ? right?.slots[index] : undefined
    return {
      time: new Date(start + index * width).toISOString(),
      latency: mergeTransitLatency(leftPoint?.latency ?? null, rightPoint?.latency ?? null),
      loss: mergeTransitLoss(leftPoint?.loss ?? null, rightPoint?.loss ?? null),
    }
  })
}

export interface TransitCarrierEstimate extends NodeCarrierPingStatsState {
  carrierLatency: number | null
  linkLatency: number | null
}

export function deriveTransitCarrierPing(tasks: NodePingTaskStatsState[], taskName: string): TransitCarrierEstimate[] {
  // Duplicate task names are ambiguous: fail closed rather than selecting a random link.
  const links = tasks.filter(task => task.name === taskName)
  const link = links.length === 1 ? links[0] : undefined
  return aggregateChinaCarrierPingStats(tasks.filter(task => task.name !== taskName)).map((carrier) => {
    const carrierLatency = carrier.hasLatency ? carrier.stats.avgLatency : null
    const linkLatency = link?.hasLatency ? link.stats.avgLatency : null
    const latency = mergeTransitLatency(carrierLatency, linkLatency)
    const loss = mergeTransitLoss(carrier.stats.hasData ? carrier.stats.avgLoss : null, link?.stats.hasData ? link.stats.avgLoss : null)
    return {
      ...carrier,
      carrierLatency,
      linkLatency,
      hasLatency: latency !== null,
      stats: {
        avgLatency: latency ?? 0,
        avgLoss: loss ?? 0,
        avgVolatility: 0,
        hasData: loss !== null,
        history: mergeTransitHistory(carrier.stats.history, link?.stats.history ?? []),
      },
    }
  })
}
