<script setup lang="ts">
import type { ReturnRouteDisplay } from '@/utils/returnRoutes'
import { computed } from 'vue'
import { RETURN_CARRIER_NAMES } from '@/utils/returnRouteClassification'

// Presentation only: show the full label, never abbreviate, clamp or ellipsize.
const props = defineProps<{ entries: ReturnRouteDisplay[] }>()
const ordered = computed(() => (['unicom', 'telecom', 'mobile'] as const).flatMap(carrier => props.entries.filter(entry => entry.carrier === carrier)))
const markers = { unicom: 'bg-red-500/80', telecom: 'bg-blue-500/80', mobile: 'bg-green-500/80' }
const columns = { unicom: 1, telecom: 2, mobile: 3 }
</script>

<template>
  <span data-route-summary class="grid w-full min-w-0 grid-cols-3 gap-0 text-[11px] leading-4 text-muted-foreground tabular-nums @max-[240px]/route:text-[10px]">
    <span
      v-for="entry in ordered" :key="entry.carrier"
      :data-return-carrier="entry.carrier" :data-route-status="entry.status"
      :aria-label="`${RETURN_CARRIER_NAMES[entry.carrier]}线路 ${entry.label}`"
      :title="`${entry.label} · ${entry.source === 'manual' ? '管理员手动标注' : '管理员可见的当前观测'}，非商业线路认证`"
      :style="{ gridColumn: columns[entry.carrier] }"
      class="flex min-w-0 items-start justify-center text-center text-foreground/75"
    >
      <span data-route-group class="inline-flex min-w-0 max-w-full items-center gap-[3px]">
        <span aria-hidden="true" data-carrier-marker class="inline-block size-[5px] shrink-0 rounded-full" :class="markers[entry.carrier]" />
        <span data-route-label class="min-w-0 whitespace-pre-wrap [overflow-wrap:anywhere]">{{ entry.label }}</span>
      </span>
    </span>
  </span>
</template>
