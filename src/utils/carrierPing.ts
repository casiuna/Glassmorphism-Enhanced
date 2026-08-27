import type { NodePingHistoryPoint, NodePingStatsState, NodePingTaskStatsState } from '@/composables/useNodePingStats'

export type ChinaCarrierKey = 'unicom' | 'telecom' | 'mobile'

export interface ChinaCarrierDefinition {
  key: ChinaCarrierKey
  labelZh: string
  labelEn: string
  matchers: readonly RegExp[]
}

export interface NodeCarrierPingStatsState {
  key: ChinaCarrierKey
  labelZh: string
  labelEn: string
  taskNames: string[]
  stats: NodePingStatsState
  hasLatency: boolean
}

export const CHINA_CARRIER_DEFINITIONS: readonly ChinaCarrierDefinition[] = [
  {
    key: 'unicom',
    labelZh: '联通',
    labelEn: 'Unicom',
    matchers: [/联通/, /china\s*unicom/i, /\bunicom\b/i, /\bcucc\b/i],
  },
  {
    key: 'telecom',
    labelZh: '电信',
    labelEn: 'Telecom',
    matchers: [/电信/, /china\s*telecom/i, /\btelecom\b/i, /\bctcc\b/i, /\bchinanet\b/i, /\bcn2\b/i],
  },
  {
    key: 'mobile',
    labelZh: '移动',
    labelEn: 'Mobile',
    matchers: [/移动/, /china\s*mobile/i, /\bmobile\b/i, /\bcmcc\b/i, /\bcmi\b/i, /\bcmin2\b/i],
  },
] as const

function average(values: number[]): number {
  if (!values.length)
    return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function averageNullable(values: Array<number | null>): number | null {
  const finiteValues = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  return finiteValues.length ? average(finiteValues) : null
}

export function matchChinaCarrier(taskName: string): ChinaCarrierKey | null {
  for (const definition of CHINA_CARRIER_DEFINITIONS) {
    if (definition.matchers.some(matcher => matcher.test(taskName)))
      return definition.key
  }
  return null
}

function mergeTaskHistory(tasks: NodePingTaskStatsState[]): NodePingHistoryPoint[] {
  const historyLength = Math.max(0, ...tasks.map(task => task.stats.history.length))
  return Array.from({ length: historyLength }, (_, index) => {
    const points = tasks
      .map(task => task.stats.history[index])
      .filter((point): point is NodePingHistoryPoint => Boolean(point))
    return {
      time: points.map(point => point.time).sort().at(-1) ?? '',
      latency: averageNullable(points.map(point => point.latency)),
      loss: averageNullable(points.map(point => point.loss)),
    }
  })
}

function aggregateTaskStats(tasks: NodePingTaskStatsState[]): { stats: NodePingStatsState, hasLatency: boolean } {
  const tasksWithData = tasks.filter(task => task.stats.hasData)
  const tasksWithLatency = tasks.filter(task => task.hasLatency)
  return {
    stats: {
      avgLatency: average(tasksWithLatency.map(task => task.stats.avgLatency)),
      avgLoss: average(tasksWithData.map(task => task.stats.avgLoss)),
      avgVolatility: average(tasksWithData.map(task => task.stats.avgVolatility).filter(value => value > 0)),
      history: mergeTaskHistory(tasksWithData),
      hasData: tasksWithData.length > 0,
    },
    hasLatency: tasksWithLatency.length > 0,
  }
}

export function aggregateChinaCarrierPingStats(taskStats: NodePingTaskStatsState[]): NodeCarrierPingStatsState[] {
  return CHINA_CARRIER_DEFINITIONS.map((definition) => {
    const matchingTasks = taskStats.filter(task => matchChinaCarrier(task.name) === definition.key)
    const aggregated = aggregateTaskStats(matchingTasks)
    return {
      key: definition.key,
      labelZh: definition.labelZh,
      labelEn: definition.labelEn,
      taskNames: [...new Set(matchingTasks.map(task => task.name))],
      stats: aggregated.stats,
      hasLatency: aggregated.hasLatency,
    }
  })
}
