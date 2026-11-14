<script setup lang="ts">
import type { ReturnCarrier } from '@/utils/returnRouteClassification'
import { computed } from 'vue'
import { useNodeReturnRoutes } from '@/composables/useNodeReturnRoutes'
import { useAppStore } from '@/stores/app'
import { compactReturnRoute, summaryReturnRoutes } from '@/utils/returnRouteDisplay'

const props = defineProps<{ uuid: string, carrier: ReturnCarrier }>()
const app = useAppStore()
const { entries, visible } = useNodeReturnRoutes(() => props.uuid)
const entry = computed(() => summaryReturnRoutes(entries.value, app.privateFeaturesAllowed).find(value => value.carrier === props.carrier))
</script>

<template>
  <span v-if="visible && entry" :data-ping-route-carrier="carrier" class="inline-flex min-w-0 items-center gap-0.5 text-[9px] font-normal leading-none text-muted-foreground/80" :title="`${entry.label} · ${entry.source === 'manual' ? '管理员手动标注' : '当前观测'}，非商业认证`">
    <span aria-hidden="true" class="shrink-0 text-muted-foreground/40">·</span>
    <span class="max-w-9 truncate">{{ compactReturnRoute(entry) }}</span>
  </span>
</template>
