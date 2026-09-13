import type { ComputedRef, Ref } from 'vue'
import type { NodePingTaskStatsState } from '@/composables/useNodePingStats'
import type { ChinaCarrierKey } from '@/utils/carrierPing'
import type { TransitCarrierEstimate } from '@/utils/transitCarrierPing'
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
  noSampleText: string,
  tooltipLabel = carrierLabel,
  estimated = false,
): CarrierPingBar[] {
  return history.map((point, index) => {
    const value = point[metric]
    const valueText = value === null
      ? noSampleText
      : metric === 'latency'
        ? `${estimated ? '≈' : ''}${Math.round(value)} ms`
        : `${estimated ? '≈' : ''}${value.toFixed(1)}%`

    return {
      key: `${carrierKey}-${metric}-${point.time}-${index}`,
      className: value === null
        ? 'bg-muted-foreground/15'
        : metric === 'latency'
          ? getLatencyToneClass(value)
          : getLossToneClass(value),
      tooltip: `${tooltipLabel}\n${formatDateTime(point.time, 'HH:mm:ss')}\n${valueText}`,
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
  transit?: ComputedRef<{ relay: string, task: string, reason: string, carriers: TransitCarrierEstimate[] } | undefined>,
) {
  const appStore = useAppStore()
  const carrierStats = computed(() => transit?.value?.carriers ?? aggregateChinaCarrierPingStats(source.taskStats.value))

  const carrierDisplays = computed<CarrierPingDisplay[]>(() => carrierStats.value.map((carrier) => {
    const isZh = appStore.lang === 'zh-CN'
    const label = isZh ? carrier.labelZh : carrier.labelEn
    const loadingText = isZh ? '加载中' : 'Loading'
    const estimate = transit?.value
    const segment = estimate?.carriers.find(item => item.key === carrier.key)
    const transitLabel = isZh ? '中转估算' : 'Transit estimate'
    const transitHistoryLabel = `${label} · ${transitLabel}`
    const taskHint = carrier.taskNames.length
      ? carrier.taskNames.join(' / ')
      : isZh
        ? `未匹配${carrier.labelZh} Ping 任务`
        : `No ${carrier.labelEn} ping task matched`
    const emptyReason = source.loading.value
      ? loadingText
      : source.error.value
        ? (isZh ? '加载失败' : 'Load failed')
        : !pingStatsEnabled.value
            ? (isZh ? '未启用 Ping 记录' : 'Ping records disabled')
            : taskHint
    const latencyBars = carrier.stats.history.length
      ? buildHistoryBars(label, carrier.key, carrier.stats.history, 'latency', isZh ? '无采样数据' : 'No sample data', estimate ? transitHistoryLabel : label, Boolean(estimate))
      : buildEmptyBars(carrier.key, 'latency', estimate ? `${transitHistoryLabel}\n${emptyReason}` : emptyReason)
    const lossBars = carrier.stats.history.length
      ? buildHistoryBars(label, carrier.key, carrier.stats.history, 'loss', isZh ? '无采样数据' : 'No sample data', estimate ? transitHistoryLabel : label, Boolean(estimate))
      : buildEmptyBars(carrier.key, 'loss', estimate ? `${transitHistoryLabel}\n${emptyReason}` : emptyReason)
    const latencyDisplay = carrier.hasLatency
      ? `${Math.round(carrier.stats.avgLatency)} ms`
      : source.loading.value ? loadingText : '--'
    const lossDisplay = carrier.stats.hasData
      ? `${carrier.stats.avgLoss.toFixed(1)}%`
      : source.loading.value ? loadingText : '--'
    const latencyTooltip = carrier.hasLatency
      ? `${taskHint}\n${isZh ? '平均延迟' : 'Average latency'} ${Math.round(carrier.stats.avgLatency)} ms`
      : taskHint
    const volatility = carrier.stats.avgVolatility > 0
      ? `${isZh ? '，平均波动' : ', volatility'} ${carrier.stats.avgVolatility.toFixed(2)}`
      : ''
    const lossTooltip = carrier.stats.hasData
      ? `${taskHint}\n${isZh ? '平均丢包' : 'Average loss'} ${carrier.stats.avgLoss.toFixed(1)}%${volatility}`
      : taskHint

    const transitSummary = estimate ? `${transitHistoryLabel}\n${isZh ? '经' : 'Via'} ${estimate.relay}` : ''
    const transitReason = estimate?.reason ? `${transitSummary}\n${estimate.reason}` : ''
    const carrierLatencyText = segment?.carrierLatency == null ? '--' : `${Math.round(segment.carrierLatency)} ms`
    const linkLatencyText = segment?.linkLatency == null ? '--' : `${Math.round(segment.linkLatency)} ms`
    const estimatedLatencyText = carrier.hasLatency ? `≈${Math.round(carrier.stats.avgLatency)} ms` : '--'
    const transitLatencyTooltip = estimate
      ? transitReason || `${transitSummary}\n${carrierLatencyText} + ${linkLatencyText} = ${estimatedLatencyText}`
      : ''
    const transitLossTooltip = estimate
      ? transitReason || `${transitSummary}\n${isZh ? '估算丢包' : 'Estimated loss'}: ${carrier.stats.hasData ? `≈${carrier.stats.avgLoss.toFixed(1)}%` : '--'}`
      : ''

    return {
      key: carrier.key,
      label,
      dotClass: CARRIER_DOT_CLASSES[carrier.key],
      taskNames: carrier.taskNames,
      latencyDisplay: estimate ? (carrier.hasLatency ? `≈${latencyDisplay}` : '--') : latencyDisplay,
      lossDisplay: estimate ? (carrier.stats.hasData ? `≈${lossDisplay}` : '--') : lossDisplay,
      latencyBars,
      lossBars,
      latencyTooltip: estimate ? transitLatencyTooltip : latencyTooltip,
      lossTooltip: estimate ? transitLossTooltip : lossTooltip,
    }
  }))

  return { carrierDisplays }
}
