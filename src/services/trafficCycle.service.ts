import type { ShallowRef } from 'vue'
import type { TrafficCycleSnapshot } from '@/utils/trafficCycle'
import { shallowRef } from 'vue'
import { getAuthSession } from '@/services/auth.service'
import { requestManager } from '@/services/request.service'
import { getSharedRpc } from '@/utils/rpc'
import { isNodeUUID, resolveTrafficMetrics, TRAFFIC_METRICS, trafficPeriod, trafficSnapshot, validResetDay } from '@/utils/trafficCycle'

interface Entry { value: ShallowRef<TrafficCycleSnapshot>, refs: number, timer?: ReturnType<typeof setInterval>, requestKey?: string, refreshing: boolean }
const entries = new Map<string, Entry>()
const REFRESH_MS = 30000

export function subscribeTrafficCycle(uuid: string, resetDay: number): { snapshot: ShallowRef<TrafficCycleSnapshot>, release: () => void } {
  if (!isNodeUUID(uuid) || !validResetDay(resetDay))
    throw new Error('无效的节点或重置日')
  const admin = getAuthSession().authenticated
  const key = `${admin ? 'admin' : 'public'}:${uuid}:${resetDay}`
  let entry = entries.get(key)
  if (!entry) {
    const now = Date.now()
    entry = { value: shallowRef(trafficSnapshot('loading', trafficPeriod(resetDay, now), now, '正在读取周期历史')), refs: 0, refreshing: false }
    entries.set(key, entry)
  }
  const state = entry
  async function refresh() {
    if (!state.refs || state.refreshing || getAuthSession().authenticated !== admin)
      return
    state.refreshing = true
    const now = Date.now()
    const period = trafficPeriod(resetDay, now)
    // This key includes identity, permission scope, calendar boundary and query
    // end. No node can reuse another node's baseline or reset its ledger.
    const end = Math.min(now, period.end)
    const requestKey = `traffic-cycle:${key}:${period.start}:${end}`
    state.requestKey = requestKey
    if (state.value.value.period.start !== period.start)
      state.value.value = trafficSnapshot('loading', period, now, '正在读取新周期历史')
    try {
      const result = await requestManager.run(requestKey, signal => getSharedRpc().getClient().call('public:queryMetrics', {
        entity_id: uuid,
        metric_keys: [...TRAFFIC_METRICS],
        start: new Date(period.start - 3600000).toISOString(),
        // Native timestamp queries can include their end; exclude the endpoint
        // explicitly rather than counting the same boundary in both periods.
        end: new Date(end - 1).toISOString(),
        aggregation_by_metric: { 'traffic.up': 'sum', 'traffic.down': 'sum', 'net.total.up': 'last', 'net.total.down': 'last' },
        max_points: 4096,
        fill_empty: false,
      }, signal), { retryAttempts: 0, timeout: 20000 })
      if (state.refs && getAuthSession().authenticated === admin)
        state.value.value = resolveTrafficMetrics(result, uuid, period, end)
    }
    catch {
      if (state.refs && getAuthSession().authenticated === admin)
        state.value.value = trafficSnapshot('error', period, now, '无法读取原生流量历史；未用累计量冒充周期配额')
    }
    finally {
      state.refreshing = false
    }
  }
  state.refs++
  if (state.refs === 1) {
    void refresh()
    state.timer = setInterval(() => void refresh(), REFRESH_MS)
  }
  let released = false
  return {
    snapshot: state.value,
    release() {
      if (released)
        return
      released = true
      state.refs--
      if (!state.refs) {
        clearInterval(state.timer)
        if (state.requestKey)
          requestManager.abort(state.requestKey)
        entries.delete(key)
      }
    },
  }
}
