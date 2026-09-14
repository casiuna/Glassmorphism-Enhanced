import type { InjectionKey, MaybeRefOrGetter, Ref } from 'vue'
import type { MonthlyTrafficUsage } from '@/services/traffic.service'
import type { NodeData } from '@/stores/nodes'
import { computed, inject, onScopeDispose, provide, ref, shallowRef, toValue, watch } from 'vue'
import { loadMonthlyTrafficUsage } from '@/services/traffic.service'
import { getTrafficUsed } from '@/utils/nodeMetricsHelper'
import { getMonthlyTrafficCycle } from '@/utils/trafficCycle'

export interface MonthlyTrafficUsageContext {
  now: Readonly<Ref<Date>>
  usageByUuid: Readonly<Ref<ReadonlyMap<string, MonthlyTrafficUsage>>>
  getUsage: (node: NodeData) => MonthlyTrafficUsage
  refresh: () => Promise<void>
}

const MONTHLY_TRAFFIC_USAGE_KEY: InjectionKey<MonthlyTrafficUsageContext> = Symbol('monthly-traffic-usage')
const TRAFFIC_CLOCK_INTERVAL_MS = 60_000

const sharedTrafficNow = ref(new Date())
let sharedClockTimer: ReturnType<typeof setInterval> | null = null
let sharedClockUsers = 0

function acquireSharedTrafficClock(): () => void {
  sharedClockUsers += 1
  if (!sharedClockTimer) {
    sharedTrafficNow.value = new Date()
    sharedClockTimer = setInterval(() => {
      sharedTrafficNow.value = new Date()
    }, TRAFFIC_CLOCK_INTERVAL_MS)
  }

  let released = false
  return () => {
    if (released)
      return
    released = true
    sharedClockUsers = Math.max(0, sharedClockUsers - 1)
    if (sharedClockUsers === 0 && sharedClockTimer) {
      clearInterval(sharedClockTimer)
      sharedClockTimer = null
    }
  }
}

function legacyUsage(node: NodeData): MonthlyTrafficUsage {
  const up = Number.isFinite(node.net_total_up) && node.net_total_up >= 0 ? node.net_total_up : 0
  const down = Number.isFinite(node.net_total_down) && node.net_total_down >= 0 ? node.net_total_down : 0
  const used = getTrafficUsed(node)
  const limit = Number.isFinite(node.traffic_limit) && node.traffic_limit > 0 ? node.traffic_limit : 0
  const cycle = getMonthlyTrafficCycle(node, sharedTrafficNow.value)
  return {
    uuid: node.uuid,
    cycleKey: cycle?.key ?? null,
    cycleStart: cycle?.start.toISOString() ?? null,
    cycleEnd: cycle?.end.toISOString() ?? null,
    up,
    down,
    used,
    percentage: limit > 0 ? Math.min(Math.max(used / limit * 100, 0), 100) : 0,
    source: 'legacy',
  }
}

function loadingUsage(node: NodeData): MonthlyTrafficUsage {
  const cycle = getMonthlyTrafficCycle(node, sharedTrafficNow.value)
  return {
    uuid: node.uuid,
    cycleKey: cycle?.key ?? null,
    cycleStart: cycle?.start.toISOString() ?? null,
    cycleEnd: cycle?.end.toISOString() ?? null,
    up: 0,
    down: 0,
    used: 0,
    percentage: 0,
    source: 'legacy',
  }
}

function createMonthlyTrafficUsageContext(nodes: MaybeRefOrGetter<readonly NodeData[]>): MonthlyTrafficUsageContext {
  const usageByUuid = shallowRef<ReadonlyMap<string, MonthlyTrafficUsage>>(new Map())
  const nodeList = computed(() => toValue(nodes))
  let refreshSequence = 0

  const refresh = async (): Promise<void> => {
    const sequence = ++refreshSequence
    const next = await loadMonthlyTrafficUsage(nodeList.value, sharedTrafficNow.value)
    if (sequence === refreshSequence)
      usageByUuid.value = next
  }

  const nodeSignature = computed(() => nodeList.value.map(node => [
    node.uuid,
    node.billing_cycle,
    node.expired_at,
    node.traffic_limit,
    node.traffic_limit_type,
  ].join(':')).join('|'))
  const stopNodeWatch = watch(nodeSignature, () => void refresh(), { immediate: true })
  const stopClockWatch = watch(sharedTrafficNow, () => void refresh())
  const releaseClock = acquireSharedTrafficClock()

  onScopeDispose(() => {
    stopNodeWatch()
    stopClockWatch()
    refreshSequence += 1
    releaseClock()
  })

  return {
    now: sharedTrafficNow,
    usageByUuid,
    getUsage: (node) => {
      const cycle = getMonthlyTrafficCycle(node, sharedTrafficNow.value)
      if (!cycle)
        return legacyUsage(node)

      const cached = usageByUuid.value.get(node.uuid)
      if (!cached || cached.cycleKey !== cycle.key)
        return loadingUsage(node)
      if (cached.source === 'legacy')
        return legacyUsage(node)
      return cached
    },
    refresh,
  }
}

export function provideMonthlyTrafficUsage(nodes: MaybeRefOrGetter<readonly NodeData[]>): MonthlyTrafficUsageContext {
  const context = createMonthlyTrafficUsageContext(nodes)
  provide(MONTHLY_TRAFFIC_USAGE_KEY, context)
  return context
}

export function useMonthlyTrafficUsage(nodes: MaybeRefOrGetter<readonly NodeData[]>): MonthlyTrafficUsageContext {
  return inject(MONTHLY_TRAFFIC_USAGE_KEY) ?? createMonthlyTrafficUsageContext(nodes)
}
