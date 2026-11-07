<script setup lang="ts">
import { useNodeReturnRoutes } from '@/composables/useNodeReturnRoutes'
import { RETURN_CARRIER_NAMES } from '@/utils/returnRouteClassification'

const props = defineProps<{ uuid: string }>()
const { entries, visible, configError, companionStatus } = useNodeReturnRoutes(() => props.uuid)
const sourceNames = { manual: '手动', auto: '自动', fixture: '模拟' }
</script>

<template>
  <section v-if="visible" data-return-routes :data-route-node="uuid" aria-label="回程线路" class="min-w-0 space-y-1 rounded-md border border-border/40 bg-slate-500/5 p-2">
    <div class="text-[10px] text-muted-foreground">
      回程线路 · 节点 → 国内三网
    </div>
    <p v-if="companionStatus" data-companion-status class="text-[9px] text-muted-foreground">
      {{ companionStatus }}
    </p>
    <p v-if="configError" role="status" class="text-[10px] text-warning">
      回程配置无效，请管理员检查主题设置。
    </p>
    <div class="grid min-w-0 grid-cols-3 gap-1">
      <div v-for="entry in entries" :key="entry.carrier" :data-return-carrier="entry.carrier" :data-route-status="entry.status" class="min-w-0">
        <span class="block text-[10px] text-muted-foreground">{{ RETURN_CARRIER_NAMES[entry.carrier] }}</span>
        <span
          :title="`${entry.label} · ${entry.detail} · ${entry.source ? sourceNames[entry.source] : '无来源'} · ${entry.at ?? '时间未提供'}`"
          class="block max-w-full truncate rounded-full border border-border/70 bg-background/50 px-1.5 py-0.5 text-[10px]"
          :class="entry.status === 'expired' ? 'text-warning' : 'text-foreground'"
        >{{ entry.label }}</span>
        <span v-if="entry.source" :title="entry.at ?? '时间未提供'" class="block truncate text-[9px] text-muted-foreground">
          {{ sourceNames[entry.source] }} · {{ entry.at ? `${entry.at.slice(0, 16).replace('T', ' ')} UTC` : '时间未提供' }}
        </span>
      </div>
    </div>
  </section>
</template>
