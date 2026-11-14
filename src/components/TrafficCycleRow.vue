<script setup lang="ts">
import type { NodeData } from '@/stores/nodes'
import { ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { useNodeTraffic } from '@/composables/useNodeTraffic'
import { saveTrafficReset } from '@/services/themeSettings.service'
import { useAppStore } from '@/stores/app'
import { formatBytesWithConfig } from '@/utils/helper'

const props = defineProps<{ node: NodeData }>()
const app = useAppStore()
const traffic = useNodeTraffic(() => props.node)
const { resetDay, ready, snapshot, used, basis, up, down, percentage, remaining } = traffic
const selectedDay = ref('')
const busy = ref(false)
const error = ref('')
const notice = ref('')
watch(resetDay, value => selectedDay.value = value ? String(value) : '', { immediate: true })
const dateTime = (value: number | undefined) => value === undefined ? '未设置' : new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(value)
async function save() {
  if (busy.value)
    return
  busy.value = true
  error.value = ''
  notice.value = ''
  try {
    const data = await saveTrafficReset(props.node.uuid, selectedDay.value ? Number(selectedDay.value) : null, resetDay.value)
    app.publicSettings = data
    notice.value = '已保存并读回；仅重新计算本节点，不清零累计计数器。'
  }
  catch (cause) {
    error.value = cause instanceof Error ? cause.message : '保存失败，请重新加载'
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <tr :data-traffic-cycle-node="node.uuid" class="border-t border-border/50 align-top">
    <td class="max-w-44 px-2 py-3">
      <span class="block break-words font-medium">{{ node.name }}</span><code class="mt-1 block break-all text-[10px] text-muted-foreground">{{ node.uuid }}</code>
    </td>
    <td class="px-2 py-3">
      <label class="sr-only" :for="`reset-${node.uuid}`">{{ node.name }} 流量重置日</label>
      <select :id="`reset-${node.uuid}`" v-model="selectedDay" class="h-8 rounded-md border border-border bg-background px-2" :disabled="busy || !!app.trafficCycleConfig.error">
        <option value="">
          未设置
        </option><option v-for="day in 31" :key="day" :value="String(day)">
          每月 {{ day }} 日
        </option>
      </select>
    </td>
    <td class="whitespace-nowrap px-2 py-3 text-xs">
      <span class="block">{{ dateTime(snapshot?.period.start) }}</span><span class="block text-muted-foreground">至 {{ dateTime(snapshot?.period.end) }}（不含）</span>
    </td>
    <td class="whitespace-nowrap px-2 py-3 text-xs">
      {{ dateTime(snapshot?.period.end) }}
    </td>
    <td class="px-2 py-3">
      <span data-cycle-used :data-traffic-basis="basis" :data-traffic-used="ready ? used : null" :data-traffic-percentage="ready ? percentage : null" :data-traffic-remaining="remaining">{{ ready && used !== null ? formatBytesWithConfig(used, app.byteDecimals) : resetDay ? snapshot?.status === 'loading' || !snapshot ? '读取中' : '数据不足' : '未设置' }}</span>
      <span v-if="ready" data-cycle-breakdown class="mt-1 block text-[10px] text-muted-foreground">↑ {{ formatBytesWithConfig(up ?? 0, app.byteDecimals) }} / ↓ {{ formatBytesWithConfig(down ?? 0, app.byteDecimals) }}</span>
      <span v-if="remaining !== null && percentage !== null" data-cycle-quota class="mt-1 block text-[10px] text-muted-foreground">剩余 {{ formatBytesWithConfig(remaining, app.byteDecimals) }} · {{ percentage.toFixed(1) }}%</span>
      <span class="mt-1 block max-w-52 text-[10px] text-muted-foreground">{{ snapshot?.reason ?? '仅保留原始累计流量，不假定每月 1 日' }}</span>
    </td>
    <td class="min-w-32 px-2 py-3">
      <Button size="sm" :disabled="busy || !!app.trafficCycleConfig.error || selectedDay === (resetDay ? String(resetDay) : '')" :aria-label="`保存 ${node.name} 流量周期`" @click="save">
        {{ busy ? '保存中' : '保存' }}
      </Button><p v-if="error" role="alert" class="mt-1 max-w-52 text-xs text-destructive">
        {{ error }}
      </p><p v-if="notice" role="status" class="mt-1 max-w-52 text-xs text-success">
        {{ notice }}
      </p>
    </td>
  </tr>
</template>
