<script setup lang="ts">
import { computed } from 'vue'
import ProtocolRouteEvidence from '@/components/ProtocolRouteEvidence.vue'
import ReturnRouteSummary from '@/components/ReturnRouteSummary.vue'
import { useNodeReturnRoutes } from '@/composables/useNodeReturnRoutes'
import { useAppStore } from '@/stores/app'
import { RETURN_CARRIER_NAMES } from '@/utils/returnRouteClassification'
import { returnRouteTime, summaryReturnRoutes } from '@/utils/returnRouteDisplay'

const props = defineProps<{ uuid: string }>()
const app = useAppStore()
const { entries, visible, companionStatus, rawEvidence, protocolEvidence } = useNodeReturnRoutes(() => props.uuid)
const canInspect = computed(() => app.privateFeaturesAllowed)
const current = computed(() => summaryReturnRoutes(entries.value, canInspect.value))
const sourceNames = { manual: '手动', auto: '自动', fixture: '模拟', replay: '历史实测回放' }
</script>

<template>
  <section v-if="visible && current.length" data-return-routes :data-route-node="uuid" aria-label="线路信息" class="@container/route min-w-0" @click.stop @keydown.stop>
    <details v-if="canInspect" class="group/routes min-w-0">
      <summary aria-label="查看线路详情" class="block cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <ReturnRouteSummary :entries="current" />
      </summary>
      <div class="mt-2 space-y-2 rounded-md border border-border/50 bg-slate-500/5 p-2 text-[10px] text-muted-foreground" data-route-details>
        <p>线路观测 · 节点 → 国内三网；手动标注与观测均不是商业线路认证。未知、失败、过期与模拟仅在此处或管理后台显示。</p>
        <p v-if="companionStatus" data-companion-status>
          {{ companionStatus }}
        </p>
        <div v-for="entry in entries" :key="entry.carrier" class="space-y-1 break-words">
          <p>{{ RETURN_CARRIER_NAMES[entry.carrier] }} · {{ entry.label }} · {{ entry.source ? sourceNames[entry.source] : '无来源' }} · <time :datetime="entry.at ?? undefined">{{ returnRouteTime(entry.at) }}</time></p>
          <p>{{ entry.detail }}</p>
          <pre v-if="rawEvidence?.[entry.carrier] && !protocolEvidence?.[entry.carrier]" class="max-h-40 overflow-auto whitespace-pre-wrap break-all">{{ JSON.stringify(rawEvidence[entry.carrier], null, 2) }}</pre>
        </div>
        <ProtocolRouteEvidence :uuid="uuid" :routes="protocolEvidence" />
      </div>
    </details>
    <ReturnRouteSummary v-else :entries="current" />
  </section>
</template>
