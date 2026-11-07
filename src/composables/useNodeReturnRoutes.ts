import type { MaybeRefOrGetter } from 'vue'
import { computed, toValue } from 'vue'
import { useAppStore } from '@/stores/app'
import { resolveReturnRoutes } from '@/utils/returnRoutes'

export function useNodeReturnRoutes(uuid: MaybeRefOrGetter<string>) {
  const app = useAppStore()
  const entries = computed(() => resolveReturnRoutes(
    app.returnRouteConfig.document,
    toValue(uuid),
    app.returnRouteAutoEnabled,
    app.returnRouteTtlHours,
    app.returnRouteNow,
  ))
  return { entries, visible: computed(() => app.returnRoutesVisible), configError: computed(() => app.returnRouteConfig.error) }
}
