import type { MaybeRefOrGetter } from 'vue'
import type { NodeData } from '@/stores/nodes'
import { computed, toValue } from 'vue'
import { useNodeCarrierPingDisplay } from '@/composables/useNodeCarrierPingDisplay'
import { useNodePingDisplay } from '@/composables/useNodePingDisplay'
import { useAppStore } from '@/stores/app'
import { useNodesStore } from '@/stores/nodes'
import { deriveTransitCarrierPing } from '@/utils/transitCarrierPing'

/** Select one source only; relay subscriptions use the same cache key as its own card. */
export function useNodeCarrierPingSource(node: MaybeRefOrGetter<NodeData>, enabled: MaybeRefOrGetter<boolean>) {
  const app = useAppStore()
  const nodes = useNodesStore()
  const rule = computed(() => app.transitCarrierPingEnabled
    ? app.transitCarrierPingRules.find(rule => rule.target === toValue(node).name)
    : undefined)
  const relay = computed(() => {
    const matches = nodes.visibleNodes.filter(node => node.name === rule.value?.relay)
    return matches.length === 1 ? matches[0] : undefined
  })
  const isTransit = computed(() => !!rule.value)
  const sourceUuid = computed(() => rule.value ? relay.value?.uuid ?? '' : toValue(node).uuid)
  const display = useNodePingDisplay(sourceUuid, {
    enabled: () => toValue(enabled) && (!isTransit.value || relay.value?.online === true),
  })
  const transit = computed(() => {
    if (!rule.value)
      return undefined
    const tasks = display.pingStats.taskStats.value
    const links = tasks.filter(task => task.name === rule.value?.task)
    const reason = !relay.value
      ? '未找到配置的中转节点（名称需唯一）'
      : !relay.value.online
          ? '中转节点离线'
          : !display.pingStatsEnabled.value
              ? '未启用 Ping 记录'
              : display.pingStats.loading.value
                ? '加载中'
                : display.pingStats.error.value
                  ? '中转数据加载失败'
                  : links.length > 1 || (links.length === 0 && !display.pingStats.knownTaskNames.value.includes(rule.value.task))
                    ? '未找到中转链路 Ping 任务（名称需唯一）'
                    : !links[0]?.stats.hasData
                        ? '中转链路没有数据'
                        : ''
    return {
      relay: rule.value.relay,
      task: rule.value.task,
      reason,
      carriers: deriveTransitCarrierPing(reason ? [] : tasks, rule.value.task),
    }
  })
  const { carrierDisplays } = useNodeCarrierPingDisplay(display.pingStats, display.pingStatsEnabled, transit)
  return { carrierDisplays, isTransit }
}
