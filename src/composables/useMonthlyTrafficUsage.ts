import type { InjectionKey, MaybeRefOrGetter, Ref } from 'vue'
import type { MonthlyTrafficUsage, MonthlyTrafficUsageOptions } from '@/services/traffic.service'
import type { NodeData } from '@/stores/nodes'
import { computed, inject, onScopeDispose, provide, ref, shallowRef, toValue, watch } from 'vue'
import { loadMonthlyTrafficUsage, monthlyTrafficConfigKey, unavailableMonthlyTraffic } from '@/services/traffic.service'
import { getMonthlyTrafficCycle } from '@/utils/trafficCycle'

export interface MonthlyTrafficUsageContext {
  now: Readonly<Ref<Date>>
  usageByUuid: Readonly<Ref<ReadonlyMap<string, MonthlyTrafficUsage>>>
  getUsage: (node: NodeData) => MonthlyTrafficUsage
  refresh: () => Promise<void>
}

const MONTHLY_TRAFFIC_USAGE_KEY: InjectionKey<MonthlyTrafficUsageContext> = Symbol('monthly-traffic-usage')
const TRAFFIC_CLOCK_INTERVAL_MS = 60_000
export const MONTHLY_TRAFFIC_REFRESH_INTERVAL_MS = 5 * 60_000

const sharedTrafficNow = ref(new Date())
const sharedTrafficRefreshTick = ref(0)
let sharedClockTimer: ReturnType<typeof setInterval> | null = null
let sharedClockUsers = 0
let sharedTrafficLastRefreshAt = 0

function acquireSharedTrafficClock(): () => void {
  sharedClockUsers += 1
  if (!sharedClockTimer) {
    const initialNow = new Date()
    sharedTrafficNow.value = initialNow
    sharedTrafficLastRefreshAt = initialNow.getTime()
    sharedClockTimer = setInterval(() => {
      const currentNow = new Date()
      sharedTrafficNow.value = currentNow
      if (currentNow.getTime() - sharedTrafficLastRefreshAt >= MONTHLY_TRAFFIC_REFRESH_INTERVAL_MS) {
        sharedTrafficLastRefreshAt = currentNow.getTime()
        sharedTrafficRefreshTick.value += 1
      }
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

export function hasMonthlyTrafficCycleChanged(previousKey: string | null | undefined, nextKey: string | null): boolean {
  return previousKey !== undefined && previousKey !== nextKey
}

function createMonthlyTrafficUsageContext(
  nodes: MaybeRefOrGetter<readonly NodeData[]>,
  options: MonthlyTrafficUsageOptions = {},
): MonthlyTrafficUsageContext {
  const usageByUuid = shallowRef<ReadonlyMap<string, MonthlyTrafficUsage>>(new Map())
  const nodeList = computed(() => toValue(nodes))
  let refreshSequence = 0
  let refreshPromise: Promise<void> | null = null
  let refreshQueued = false

  const refresh = (): Promise<void> => {
    if (refreshPromise) {
      refreshQueued = true
      return refreshPromise
    }

    const sequence = ++refreshSequence
    refreshPromise = loadMonthlyTrafficUsage(nodeList.value, sharedTrafficNow.value, options)
      .then((next) => {
        if (sequence === refreshSequence)
          usageByUuid.value = next
      })
      .catch((error) => {
        console.warn('月流量刷新失败，不使用机器累计值补月度数据:', error)
      })
      .finally(() => {
        refreshPromise = null
        if (refreshQueued) {
          refreshQueued = false
          void refresh()
        }
      })

    return refreshPromise
  }

  const nodeSignature = computed(() => nodeList.value.map(node => [
    node.uuid,
    node.billing_cycle,
    node.expired_at,
    node.traffic_limit,
    node.traffic_limit_type,
  ].join(':')).join('|'))
  const cycleSignature = computed(() => nodeList.value.map((node) => {
    const cycle = getMonthlyTrafficCycle(node, sharedTrafficNow.value)
    return `${node.uuid}:${cycle?.key ?? 'no-cycle'}`
  }).join('|'))

  const releaseClock = acquireSharedTrafficClock()
  const stopNodeWatch = watch(nodeSignature, () => void refresh(), { immediate: true })
  const stopCycleWatch = watch(cycleSignature, (next, previous) => {
    if (hasMonthlyTrafficCycleChanged(previous, next))
      void refresh()
  })
  const stopRefreshWatch = watch(sharedTrafficRefreshTick, () => void refresh())

  onScopeDispose(() => {
    stopNodeWatch()
    stopCycleWatch()
    stopRefreshWatch()
    refreshSequence += 1
    refreshQueued = false
    releaseClock()
  })

  return {
    now: sharedTrafficNow,
    usageByUuid,
    getUsage: (node) => {
      const cycle = getMonthlyTrafficCycle(node, sharedTrafficNow.value)
      if (!cycle)
        return unavailableMonthlyTraffic(node, null)

      const cached = usageByUuid.value.get(node.uuid)
      if (!cached || cached.configKey !== monthlyTrafficConfigKey(node, cycle))
        return unavailableMonthlyTraffic(node, cycle, 'loading')
      return cached
    },
    refresh,
  }
}

export function provideMonthlyTrafficUsage(
  nodes: MaybeRefOrGetter<readonly NodeData[]>,
  options: MonthlyTrafficUsageOptions = {},
): MonthlyTrafficUsageContext {
  const context = createMonthlyTrafficUsageContext(nodes, options)
  provide(MONTHLY_TRAFFIC_USAGE_KEY, context)
  return context
}

export function useMonthlyTrafficUsage(
  nodes: MaybeRefOrGetter<readonly NodeData[]>,
  options: MonthlyTrafficUsageOptions = {},
): MonthlyTrafficUsageContext {
  return inject(MONTHLY_TRAFFIC_USAGE_KEY) ?? createMonthlyTrafficUsageContext(nodes, options)
}
