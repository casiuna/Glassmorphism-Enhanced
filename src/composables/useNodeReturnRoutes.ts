import type { MaybeRefOrGetter } from 'vue'
import type { ProtocolPaths } from '@/utils/routeProbeSnapshot'
import { computed, onScopeDispose, toValue, watch } from 'vue'
import { probeConnection, probeSnapshot, subscribeRouteProbe } from '@/services/routeProbe.service'
import { useAppStore } from '@/stores/app'
import { resolveReturnRoutes } from '@/utils/returnRoutes'
import { protocolRouteDisplay, withProbeResults } from '@/utils/routeProbeSnapshot'

export function useNodeReturnRoutes(uuid: MaybeRefOrGetter<string>) {
  const app = useAppStore()
  let release: (() => void) | undefined
  const connected = computed(() => app.returnRouteCompanionEnabled && app.returnRouteAutoEnabled && app.returnRoutesVisible && app.privateFeaturesAllowed)
  watch(connected, (enabled) => {
    release?.()
    release = enabled ? subscribeRouteProbe() : undefined
  }, { immediate: true })
  onScopeDispose(() => release?.())
  const document = computed(() => connected.value ? withProbeResults(app.returnRouteConfig.document, toValue(uuid), probeSnapshot.value) : app.returnRouteConfig.document)
  const rawEvidence = computed(() => app.privateFeaturesAllowed ? document.value.nodes[toValue(uuid)]?.auto : undefined)
  const protocolEvidence = computed(() => {
    const node = probeSnapshot.value.nodes[toValue(uuid)]
    if (!connected.value || !node?.enabled || !node.protocols)
      return undefined
    const paths: ProtocolPaths = {}
    for (const carrier of ['telecom', 'unicom', 'mobile'] as const) {
      const incoming = node.auto[carrier]
      const saved = app.returnRouteConfig.document.nodes[toValue(uuid)]?.auto[carrier]
      if (incoming && (!saved || Date.parse(incoming.collectedAt) >= Date.parse(saved.collectedAt)))
        paths[carrier] = node.protocols[carrier]
    }
    return paths
  })
  // Legacy inline auto data is not authorization to publish measurements.
  // Live automatic evidence comes only from the administrator-only snapshot.
  const entries = computed(() => resolveReturnRoutes(document.value, toValue(uuid), app.returnRouteAutoEnabled && app.privateFeaturesAllowed, app.returnRouteTtlHours, app.returnRouteNow).map((entry) => {
    const paths = protocolEvidence.value?.[entry.carrier]
    return paths ? protocolRouteDisplay(toValue(uuid), entry, paths, app.returnRouteTtlHours, app.returnRouteNow) : entry
  }))
  const companionStatus = computed(() => !app.returnRouteCompanionEnabled ? '' : !app.privateFeaturesAllowed ? '自动结果仅管理员可见' : !app.returnRouteAutoEnabled ? '自动结果消费已关闭' : `${probeConnection.value} · ${probeSnapshot.value.nodes[toValue(uuid)]?.state ?? '等待助手'}`)
  return { entries, rawEvidence, protocolEvidence, companionStatus, visible: computed(() => app.returnRoutesVisible), configError: computed(() => app.returnRouteConfig.error) }
}
