<script setup lang="ts">
import type { NodeData } from '@/stores/nodes'
import TrafficProgress from '@/components/TrafficProgress.vue'
import { useNodeTraffic } from '@/composables/useNodeTraffic'
import { useAppStore } from '@/stores/app'
import { formatBytesWithConfig } from '@/utils/helper'

const props = defineProps<{ node: NodeData }>()
const app = useAppStore()
const { up, down, used, percentage, remaining, label, available, basis } = useNodeTraffic(() => props.node)
const bytes = (value: number | null | undefined) => value === null ? '—' : formatBytesWithConfig(value ?? 0, app.byteDecimals)
</script>

<template>
  <div class="group min-w-0" :title="`${label}${basis === 'machine-cumulative' ? '（累计参考，非周期配额）' : ''} · ↑ ${bytes(up)} / ↓ ${bytes(down)}${remaining === null ? '' : ` · 剩余 ${bytes(remaining)}`}`" data-machine-traffic :data-traffic-basis="basis" :data-traffic-used="used" :data-traffic-percentage="percentage" :data-traffic-remaining="remaining">
    <div class="w-full space-y-1">
      <div class="truncate text-[11px] font-medium text-foreground/75">
        <span class="inline group-hover:hidden">{{ basis === 'machine-cumulative' ? '累计 ' : '' }}{{ percentage !== null ? `${percentage.toFixed(1)}%` : available && node.traffic_limit <= 0 ? '∞' : label }}</span>
        <span class="hidden group-hover:inline">{{ used === null ? label : bytes(used) }} / {{ node.traffic_limit > 0 ? bytes(node.traffic_limit) : '∞' }}</span>
      </div>
      <TrafficProgress v-if="node.traffic_limit > 0" :upload="up ?? 0" :download="down ?? 0" :traffic-limit="node.traffic_limit" :traffic-limit-type="node.traffic_limit_type || 'sum'" height="4px" :class="!available && 'opacity-30'" :aria-hidden="!available || undefined" />
    </div>
  </div>
</template>
