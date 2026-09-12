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

/** Align both segments on one 20-slot timeline; an absent segment stays null. */
export function mergeTransitHistory(a: NodePingHistoryPoint[], b: NodePingHistoryPoint[]): NodePingHistoryPoint[] {
  const times = [...a, ...b].map(point => Date.parse(point.time)).filter(Number.isFinite)
  if (!times.length)
    return []
  const start = Math.min(...times)
  const end = Math.max(...times)
  const width = Math.max(1, (end - start) / 19)
  const bucket = (points: NodePingHistoryPoint[]) => {
    const slots = new Map<number, NodePingHistoryPoint[]>()
    for (const point of points) {
      const time = Date.parse(point.time)
      if (!Number.isFinite(time))
        continue
      const index = Math.min(19, Math.floor((time - start) / width))
      slots.set(index, [...(slots.get(index) ?? []), point])
    }
    return slots
  }
  const left = bucket(a)
  const right = bucket(b)
  const average = (points: NodePingHistoryPoint[] | undefined, metric: 'latency' | 'loss') => {
    const values = points?.map(point => point[metric]).filter((value): value is number => value !== null && Number.isFinite(value)) ?? []
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
  }
  return Array.from({ length: 20 }, (_, index) => ({
    time: new Date(start + index * width).toISOString(),
    latency: mergeTransitLatency(average(left.get(index), 'latency'), average(right.get(index), 'latency')),
    loss: mergeTransitLoss(average(left.get(index), 'loss'), average(right.get(index), 'loss')),
  }))
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
