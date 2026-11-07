import type { MaybeRefOrGetter } from 'vue'
import { computed, onScopeDispose, toValue, watch } from 'vue'
import { probeConnection, probeSnapshot, subscribeRouteProbe } from '@/services/routeProbe.service'
import { useAppStore } from '@/stores/app'
import { resolveReturnRoutes } from '@/utils/returnRoutes'
import { withProbeResults } from '@/utils/routeProbeSnapshot'

export function useNodeReturnRoutes(uuid: MaybeRefOrGetter<string>) {
  const app = useAppStore()
  let release: (() => void) | undefined
  const connected = computed(() => app.returnRouteCompanionEnabled && app.returnRouteAutoEnabled && app.returnRoutesVisible && app.privateFeaturesAllowed)
  watch(connected, (enabled) => {
    release?.()
    release = enabled ? subscribeRouteProbe() : undefined
  }, { immediate: true })
  onScopeDispose(() => release?.())
  const entries = computed(() => resolveReturnRoutes(
    connected.value ? withProbeResults(app.returnRouteConfig.document, toValue(uuid), probeSnapshot.value) : app.returnRouteConfig.document,
    toValue(uuid),
    app.returnRouteAutoEnabled,
    app.returnRouteTtlHours,
    app.returnRouteNow,
  ))
  const companionStatus = computed(() => !app.returnRouteCompanionEnabled ? '' : !app.privateFeaturesAllowed ? '自动结果仅管理员可见' : !app.returnRouteAutoEnabled ? '自动结果消费已关闭' : `${probeConnection.value} · ${probeSnapshot.value.nodes[toValue(uuid)]?.state ?? '等待助手'}`)
  return { entries, companionStatus, visible: computed(() => app.returnRoutesVisible), configError: computed(() => app.returnRouteConfig.error) }
}
