<script setup lang="ts">
import type { SettingsGroup } from '@/utils/themeSettings'
import { computed, onMounted, ref, watch } from 'vue'
import ManualRouteManager from '@/components/ManualRouteManager.vue'
import TrafficCycleManager from '@/components/TrafficCycleManager.vue'
import { Button } from '@/components/ui/button'
import { loadManagedSettings, saveManagedSettings } from '@/services/themeSettings.service'
import { useAppStore } from '@/stores/app'
import { stableValue } from '@/utils/enhancedManagement'
import { settingGroup, settingText, THEME_FIELDS } from '@/utils/themeSettings'

const props = defineProps<{ group: SettingsGroup }>()
const app = useAppStore()
const expected = ref<Record<string, unknown>>({})
const draft = ref<Record<string, unknown>>({})
const loaded = ref(false)
const busy = ref(false)
const error = ref('')
const notice = ref('')
const fields = computed(() => THEME_FIELDS.filter(field => field.key !== 'trafficCycleConfig' && settingGroup(field.key) === props.group))
const advancedKeys = new Set(['returnRouteConfig', 'returnRouteCompanionEnabled'])
const basicFields = computed(() => fields.value.filter(f => !advancedKeys.has(f.key)))
const advancedFields = computed(() => fields.value.filter(f => advancedKeys.has(f.key)))
const changes = computed(() => Object.fromEntries(fields.value.filter(f => stableValue(draft.value[f.key]) !== stableValue(expected.value[f.key] ?? f.default)).map(f => [f.key, draft.value[f.key]])))
async function reload() {
  busy.value = true
  error.value = ''
  try {
    const data = await loadManagedSettings()
    app.publicSettings = data
    expected.value = structuredClone(data.theme_settings)
    draft.value = Object.fromEntries(THEME_FIELDS.map(field => [field.key, data.theme_settings[field.key] ?? field.default]))
    loaded.value = true
  }
  catch (cause) {
    error.value = cause instanceof Error ? cause.message : '无法读取托管设置'
  }
  finally {
    busy.value = false
  }
}
async function save() {
  if (busy.value || !Object.keys(changes.value).length)
    return
  busy.value = true
  error.value = ''
  notice.value = ''
  try {
    const data = await saveManagedSettings(expected.value, changes.value)
    app.publicSettings = data
    expected.value = structuredClone(data.theme_settings)
    notice.value = '已保存并读回；其他分类、节点周期及未识别的旧字段保留。'
  }
  catch (cause) {
    error.value = cause instanceof Error ? cause.message : '保存失败'
  }
  finally {
    busy.value = false
  }
}
function setField(key: string, type: string, event: Event) {
  const input = event.target as HTMLInputElement
  draft.value[key] = type === 'switch' ? input.checked : type === 'number' ? input.value === '' ? Number.NaN : Number(input.value) : input.value
}
onMounted(() => void reload())
watch(() => app.publicSettings?.theme_settings, (settings) => {
  if (!loaded.value || !settings)
    return
  for (const field of THEME_FIELDS) {
    if (stableValue(draft.value[field.key]) === stableValue(expected.value[field.key] ?? field.default)) {
      draft.value[field.key] = settings[field.key] ?? field.default
      expected.value[field.key] = settings[field.key]
    }
  }
})
</script>

<template>
  <div class="space-y-4" data-theme-settings-panel>
    <p v-if="error" role="alert" class="text-sm text-destructive">
      {{ error }}
    </p>
    <p v-if="notice" role="status" class="text-sm text-success">
      {{ notice }}
    </p>
    <TrafficCycleManager v-if="loaded && group === 'nodes'" />
    <ManualRouteManager v-if="loaded && group === 'routes'" />
    <form v-if="loaded" class="space-y-3" @submit.prevent="save">
      <div class="grid gap-3 sm:grid-cols-2">
        <label v-for="field in basicFields" :key="field.key" class="min-w-0 space-y-1 rounded-md border border-border/50 p-3 text-sm" :class="field.type === 'richtext' && 'sm:col-span-2'">
          <span class="block font-medium">{{ settingText(field.name) }}</span>
          <input v-if="field.type === 'switch'" type="checkbox" :checked="draft[field.key] === true" :aria-label="settingText(field.name)" :disabled="busy" @change="setField(field.key, field.type, $event)">
          <select v-else-if="field.type === 'select'" :value="draft[field.key]" :aria-label="settingText(field.name)" :disabled="busy" class="h-9 w-full rounded-md border border-border bg-background px-2" @change="setField(field.key, field.type, $event)"><option v-for="option in field.options?.split(',').map(s => s.trim()).filter(Boolean)" :key="option" :value="option">{{ option }}</option></select>
          <textarea v-else-if="field.type === 'richtext'" :value="String(draft[field.key] ?? '')" :aria-label="settingText(field.name)" :disabled="busy" rows="3" class="w-full rounded-md border border-border bg-background p-2 font-mono text-xs" @input="setField(field.key, field.type, $event)" />
          <input v-else :type="field.type === 'number' ? 'number' : field.key === 'exportSecondaryPassword' ? 'password' : 'text'" :value="String(draft[field.key] ?? '')" :aria-label="settingText(field.name)" :disabled="busy" class="h-9 w-full rounded-md border border-border bg-background px-2" @input="setField(field.key, field.type, $event)">
          <span v-if="field.help" class="block text-xs text-muted-foreground">{{ settingText(field.help) }}</span>
        </label>
      </div>
      <div class="flex flex-wrap gap-2">
        <details v-if="advancedFields.length" class="w-full space-y-3 rounded-md border border-border/50 p-3" data-route-raw-settings>
          <summary class="cursor-pointer text-sm font-medium">
            高级选项 · 原始 JSON 与可选插件连接
          </summary>
          <p class="my-2 text-xs text-muted-foreground">
            与上方可视化编辑共用 returnRouteConfig；不是第二套配置。修改 JSON 后保存本分类，发生并发修改会拒绝覆盖。
          </p>
          <label v-for="field in advancedFields" :key="field.key" class="block space-y-1 text-sm">
            <span class="block font-medium">{{ settingText(field.name) }}</span>
            <input v-if="field.type === 'switch'" type="checkbox" :checked="draft[field.key] === true" :aria-label="settingText(field.name)" :disabled="busy" @change="setField(field.key, field.type, $event)">
            <textarea v-else :value="String(draft[field.key] ?? '')" :aria-label="settingText(field.name)" :disabled="busy" rows="5" class="w-full rounded-md border border-border bg-background p-2 font-mono text-xs" @input="setField(field.key, field.type, $event)" />
            <span class="block text-xs text-muted-foreground">{{ settingText(field.help) }}</span>
          </label>
        </details>
        <Button type="submit" :disabled="busy || !Object.keys(changes).length">
          保存本分类设置
        </Button><Button type="button" variant="outline" :disabled="busy" @click="reload">
          重新加载设置
        </Button>
      </div>
    </form>
    <p v-else-if="busy" role="status" class="text-sm text-muted-foreground">
      正在读取托管主题配置…
    </p>
  </div>
</template>
