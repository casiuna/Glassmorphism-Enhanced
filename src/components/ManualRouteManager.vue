<script setup lang="ts">
import type { NodeReturnRoutes } from '@/utils/returnRoutes'
import { computed, onMounted, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { loadManagedSettings, saveManualRoutes } from '@/services/themeSettings.service'
import { useAppStore } from '@/stores/app'
import { useNodesStore } from '@/stores/nodes'
import { stableValue } from '@/utils/enhancedManagement'
import { manualValues } from '@/utils/manualRouteSettings'

const app = useAppStore()
const nodes = useNodesStore()
const selected = ref('')
const labels = ref(manualValues(undefined))
const expected = ref<NodeReturnRoutes>()
const busy = ref(false)
const error = ref('')
const notice = ref('')
const choices = computed(() => {
  const all = new Map(nodes.nodes.map(n => [n.uuid, n.name]))
  for (const uuid of Object.keys(app.returnRouteConfig.document.nodes)) {
    if (!all.has(uuid))
      all.set(uuid, uuid)
  }
  return Array.from(all, ([uuid, name]) => ({ uuid, name }))
})
function hydrate() {
  const row = app.returnRouteConfig.document.nodes[selected.value]
  expected.value = row ? JSON.parse(JSON.stringify(row)) : undefined
  labels.value = manualValues(row)
}
async function reload() {
  busy.value = true
  error.value = ''
  notice.value = ''
  try {
    app.publicSettings = await loadManagedSettings()
    if (!choices.value.some(n => n.uuid === selected.value))
      selected.value = choices.value[0]?.uuid ?? ''
    hydrate()
  }
  catch (cause) {
    error.value = cause instanceof Error ? cause.message : '读取失败'
  }
  finally { busy.value = false }
}
async function save() {
  busy.value = true
  error.value = ''
  notice.value = ''
  try {
    app.publicSettings = await saveManualRoutes(selected.value, labels.value, expected.value)
    hydrate()
    notice.value = '手动线路已保存并读回；其他节点、自动结果和所有开关保持原样。'
  }
  catch (cause) {
    error.value = cause instanceof Error ? cause.message : '保存失败'
  }
  finally { busy.value = false }
}
watch(selected, () => {
  notice.value = ''
  hydrate()
})
watch(() => app.returnRouteConfig.document.nodes[selected.value], () => {
  if (stableValue(labels.value) === stableValue(manualValues(expected.value)))
    hydrate()
})
onMounted(() => void reload())
</script>

<template>
  <section aria-label="手动线路" data-manual-route-manager class="space-y-3 rounded-lg border border-border/60 p-4">
    <div>
      <h3 class="font-semibold">
        手动线路 · 无额外依赖
      </h3>
      <p class="mt-1 text-xs text-muted-foreground">
        只使用 Enhanced 托管主题配置。无需 Plugin、Helper、SSH 或远程执行；不会安装软件或自动开启采集。公开名称中不要填写 token、密码或私有 IP。
      </p>
    </div>
    <label class="block space-y-1 text-sm"><span>手动线路节点</span><select v-model="selected" aria-label="手动线路节点" :disabled="busy" class="h-10 w-full rounded-md border border-border bg-background px-2"><option v-for="node in choices" :key="node.uuid" :value="node.uuid">{{ node.name }} · {{ node.uuid }}</option></select></label>
    <p v-if="!choices.length" class="text-sm text-muted-foreground">
      暂无可管理节点。
    </p>
    <form v-else class="space-y-3" @submit.prevent="save">
      <div class="grid gap-3 sm:grid-cols-3">
        <label v-for="carrier in (['unicom', 'telecom', 'mobile'] as const)" :key="carrier" class="space-y-1 text-sm"><span>{{ { unicom: '联通', telecom: '电信', mobile: '移动' }[carrier] }}手动线路</span><input v-model="labels[carrier]" :aria-label="`${{ unicom: '联通', telecom: '电信', mobile: '移动' }[carrier]}手动线路`" :disabled="busy" maxlength="80" class="h-10 w-full rounded-md border border-border bg-background px-2"></label>
      </div>
      <p class="text-xs text-muted-foreground">
        留空只移除本节点对应手动覆盖；名称不推断商业线路。显示由下方「显示回程线路」开关控制，自动结果开关与手动线路互不绑定。
      </p>
      <div class="flex flex-wrap gap-2">
        <Button type="submit" :disabled="busy || !selected || Boolean(app.returnRouteConfig.error)">
          保存本节点手动线路
        </Button><Button type="button" variant="outline" :disabled="busy" @click="reload">
          重新加载手动线路
        </Button>
      </div>
    </form>
    <p v-if="app.returnRouteConfig.error" role="alert" data-route-config-error class="text-sm text-destructive">
      回程配置无效；{{ app.returnRouteConfig.error }}；未生成线路结果。
    </p>
    <p v-if="error" role="alert" class="text-sm text-destructive">
      {{ error }}
    </p>
    <p v-if="notice" role="status" class="text-sm text-success">
      {{ notice }}
    </p>
  </section>
</template>
