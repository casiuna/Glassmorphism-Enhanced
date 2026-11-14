import type { MaybeRefOrGetter } from 'vue'
import type { NodeData } from '@/stores/nodes'
import type { TrafficCycleSnapshot } from '@/utils/trafficCycle'
import { computed, onScopeDispose, shallowRef, toValue, watch } from 'vue'
import { subscribeTrafficCycle } from '@/services/trafficCycle.service'
import { useAppStore } from '@/stores/app'
import { trafficAccounting } from '@/utils/trafficAccounting'

export function useNodeTraffic(node: MaybeRefOrGetter<NodeData | undefined>) {
  const app = useAppStore()
  const snapshot = shallowRef<TrafficCycleSnapshot | null>(null)
  let release: (() => void) | undefined
  const resetDay = computed(() => app.trafficCycleConfig.document.nodes[toValue(node)?.uuid ?? '']?.resetDay)
  watch([() => toValue(node)?.uuid, resetDay, () => app.privateFeaturesAllowed], ([uuid, day]) => {
    release?.()
    snapshot.value = null
    if (uuid && day && !app.trafficCycleConfig.error) {
      const subscription = subscribeTrafficCycle(uuid, day)
      release = subscription.release
      snapshot.value = subscription.snapshot.value
      const stop = watch(subscription.snapshot, value => snapshot.value = value)
      release = () => {
        stop()
        subscription.release()
      }
    }
    else {
      release = undefined
    }
  }, { immediate: true })
  onScopeDispose(() => release?.())
  const accounting = computed(() => trafficAccounting(toValue(node), resetDay.value, snapshot.value, app.trafficCycleConfig.error))
  return {
    resetDay,
    snapshot,
    configured: computed(() => accounting.value.configured),
    ready: computed(() => accounting.value.ready),
    available: computed(() => accounting.value.available),
    basis: computed(() => accounting.value.basis),
    up: computed(() => accounting.value.up),
    down: computed(() => accounting.value.down),
    used: computed(() => accounting.value.used),
    percentage: computed(() => accounting.value.percentage),
    remaining: computed(() => accounting.value.remaining),
    label: computed(() => accounting.value.label),
  }
}
