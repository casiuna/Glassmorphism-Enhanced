import type { ComputedRef, Ref } from 'vue'
import type { NodePingTaskStatsState } from '@/composables/useNodePingStats'
import type { ChinaCarrierKey } from '@/utils/carrierPing'
import { computed } from 'vue'
import { useAppStore } from '@/stores/app'
import { aggregateChinaCarrierPingStats } from '@/utils/carrierPing'
import { formatDateTime } from '@/utils/helper'

export interface CarrierPingBar {
  key: string
  className: string
  tooltip: string
}

export interface CarrierPingDisplay {
  key: ChinaCarrierKey
  label: string
  dotClass: string
  taskNames: string[]
  latencyDisplay: string
  lossDisplay: string
  latencyBars: CarrierPingBar[]
  lossBars: CarrierPingBar[]
  latencyTooltip: string
  lossTooltip: string
}

interface NodePingTaskStatsSource {
  taskStats: ComputedRef<NodePingTaskStatsState[]>
  loading: Ref<boolean>
  error: Ref<string | null>
}

const EMPTY_PING_BAR_COUNT = 20

const CARRIER_DOT_CLASSES: Record<ChinaCarrierKey, string> = {
  unicom: 'bg-rose-500',
  telecom: 'bg-blue-500',
  mobile: 'bg-emerald-500',
}

function getLatencyToneClass(latency: number): string {
  if (latency <= 60)
    return 'bg-signal-1'
  if (latency <= 100)
    return 'bg-signal-2'
  if (latency <= 160)
    return 'bg-signal-3 ping-signal-pattern-2'
  if (latency <= 200)
    return 'bg-signal-4 ping-signal-pattern-3'
  return 'bg-signal-5 ping-signal-pattern-4'
}

function getLossToneClass(loss: number): string {
  if (loss <= 1)
    return 'bg-signal-1'
  if (loss <= 3)
    return 'bg-signal-2'
  if (loss <= 6)
    return 'bg-signal-3 ping-signal-pattern-2'
  if (loss <= 9)
    return 'bg-signal-4 ping-signal-pattern-3'
  return 'bg-signal-5 ping-signal-pattern-4'
}

function buildHistoryBars(
  carrierLabel: string,
  carrierKey: ChinaCarrierKey,
  history: Array<{ time: string, latency: number | null, loss: number | null }>,
  metric: 'latency' | 'loss',
): CarrierPingBar[] {
  return history.map((point, index) => {
    const value = point[metric]
    const valueText = value === null
      ? '无采样数据'
      : metric === 'latency'
        ? `${Math.round(value)} ms`
        : `${value.toFixed(1)}%`

    return {
      key: `${carrierKey}-${metric}-${point.time}-${index}`,
      className: value === null
        ? 'bg-muted-foreground/15'
        : metric === 'latency'
          ? getLatencyToneClass(value)
          : getLossToneClass(value),
      tooltip: `${carrierLabel}\n${formatDateTime(point.time, 'HH:mm:ss')}\n${valueText}`,
    }
  })
}

function buildEmptyBars(carrierKey: ChinaCarrierKey, metric: 'latency' | 'loss', tooltip: string): CarrierPingBar[] {
  return Array.from({ length: EMPTY_PING_BAR_COUNT }, (_, index) => ({
    key: `${carrierKey}-${metric}-empty-${index}`,
    className: 'bg-muted-foreground/10',
    tooltip,
  }))
}

export function useNodeCarrierPingDisplay(
  source: NodePingTaskStatsSource,
  pingStatsEnabled: ComputedRef<boolean>,
) {
  const appStore = useAppStore()
  const carrierStats = computed(() => aggregateChinaCarrierPingStats(source.taskStats.value))

  const carrierDisplays = computed<CarrierPingDisplay[]>(() => carrierStats.value.map((carrier) => {
    const label = appStore.lang === 'zh-CN' ? carrier.labelZh : carrier.labelEn
    const taskHint = carrier.taskNames.length
      ? carrier.taskNames.join(' / ')
      : appStore.lang === 'zh-CN'
        ? `未匹配${carrier.labelZh} Ping 任务`
        : `No ${carrier.labelEn} ping task matched`
    const emptyReason = source.loading.value
      ? (appStore.lang === 'zh-CN' ? '加载中' : 'Loading')
      : source.error.value
        ? (appStore.lang === 'zh-CN' ? '加载失败' : 'Load failed')
        : !pingStatsEnabled.value
            ? (appStore.lang === 'zh-CN' ? '未启用 Ping 记录' : 'Ping records disabled')
            : taskHint
    const latencyBars = carrier.stats.history.length
      ? buildHistoryBars(label, carrier.key, carrier.stats.history, 'latency')
      : buildEmptyBars(carrier.key, 'latency', emptyReason)
    const lossBars = carrier.stats.history.length
      ? buildHistoryBars(label, carrier.key, carrier.stats.history, 'loss')
      : buildEmptyBars(carrier.key, 'loss', emptyReason)
    const latencyDisplay = carrier.hasLatency
      ? `${Math.round(carrier.stats.avgLatency)} ms`
      : source.loading.value ? (appStore.lang === 'zh-CN' ? '加载中' : 'Loading') : '--'
    const lossDisplay = carrier.stats.hasData
      ? `${carrier.stats.avgLoss.toFixed(1)}%`
      : source.loading.value ? (appStore.lang === 'zh-CN' ? '加载中' : 'Loading') : '--'
    const latencyTooltip = carrier.hasLatency
      ? `${taskHint}\n${appStore.lang === 'zh-CN' ? '平均延迟' : 'Average latency'} ${Math.round(carrier.stats.avgLatency)} ms`
      : taskHint
    const volatility = carrier.stats.avgVolatility > 0
      ? `，${appStore.lang === 'zh-CN' ? '平均波动' : 'volatility'} ${carrier.stats.avgVolatility.toFixed(2)}`
      : ''
    const lossTooltip = carrier.stats.hasData
      ? `${taskHint}\n${appStore.lang === 'zh-CN' ? '平均丢包' : 'Average loss'} ${carrier.stats.avgLoss.toFixed(1)}%${volatility}`
      : taskHint

    return {
      key: carrier.key,
      label,
      dotClass: CARRIER_DOT_CLASSES[carrier.key],
      taskNames: carrier.taskNames,
      latencyDisplay,
      lossDisplay,
      latencyBars,
      lossBars,
      latencyTooltip,
      lossTooltip,
    }
  }))

  return { carrierDisplays }
}
