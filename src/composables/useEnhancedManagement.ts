import type { EnhancedManagementState } from '@/services/enhancedManagement.service'
import type { ManagementDraft } from '@/utils/enhancedManagement'
import { computed, onMounted, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { enableEnhancedPlugin, loadEnhancedManagement, saveEnhancedManagement } from '@/services/enhancedManagement.service'
import { useAppStore } from '@/stores/app'
import { useNodesStore } from '@/stores/nodes'
import { helperPresence, nodeBootstrapCommand } from '@/utils/enhancedManagement'

export function useEnhancedManagement() {
  const app = useAppStore()
  const nodes = useNodesStore()
  const state = shallowRef<EnhancedManagementState | null>(null)
  const selected = ref('')
  const draft = ref<ManagementDraft | null>(null)
  const busy = ref(false)
  const dirty = ref(false)
  const confirmed = ref(false)
  const error = ref('')
  const notice = ref('')
  const now = ref(Date.now())
  let timer: ReturnType<typeof setInterval> | undefined
  let disposed = false
  let hydrating = false
  const choices = computed(() => {
    const all = new Map(nodes.nodes.map(n => [n.uuid, n.name]))
    for (const uuid of [...Object.keys(state.value?.policy?.nodes ?? {}), ...Object.keys(state.value?.snapshot.nodes ?? {})]) {
      if (!all.has(uuid))
        all.set(uuid, uuid)
    }
    return Array.from(all, ([uuid, name]) => ({ uuid, name }))
  })
  function hydrate() {
    const data = state.value
    if (!data || !selected.value)
      return
    hydrating = true
    const policy = data.policy?.nodes[selected.value]
    const manual = app.returnRouteConfig.document.nodes[selected.value]?.manual
    draft.value = {
      uuid: selected.value,
      globalEnabled: data.policy?.enabled ?? false,
      nodeEnabled: policy?.enabled ?? false,
      city: policy?.city ?? 'beijing',
      periodMinutes: policy?.periodMinutes ?? 360,
      ttlHours: app.returnRouteTtlHours,
      displayEnabled: app.returnRoutesVisible && app.returnRouteAutoEnabled && app.returnRouteCompanionEnabled,
      manual: { telecom: manual?.telecom?.label ?? '', unicom: manual?.unicom?.label ?? '', mobile: manual?.mobile?.label ?? '' },
    }
    dirty.value = false
    confirmed.value = false
    hydrating = false
  }
  function adopt(data: EnhancedManagementState) {
    if (disposed)
      return
    state.value = data
    app.publicSettings = data.public
    if (!choices.value.some(n => n.uuid === selected.value))
      selected.value = choices.value[0]?.uuid ?? ''
    hydrate()
  }
  async function refresh() {
    if (busy.value)
      return
    busy.value = true
    error.value = ''
    try {
      adopt(await loadEnhancedManagement())
    }
    catch {
      state.value = null
      error.value = '无法读取集中管理；请确认管理员登录、Komari 1.6.0 和插件安装状态。'
    }
    finally {
      busy.value = false
    }
  }
  async function save() {
    if (!state.value || !draft.value || !confirmed.value || busy.value)
      return
    busy.value = true
    error.value = ''
    notice.value = ''
    try {
      adopt(await saveEnhancedManagement(state.value, draft.value))
      notice.value = '已保存并读取确认；其他节点策略及原有主题设置保留。'
    }
    catch (cause) {
      error.value = cause instanceof Error ? cause.message : '保存失败，请刷新核对'
    }
    finally {
      busy.value = false
    }
  }
  async function enable() {
    if (!confirmed.value || busy.value)
      return
    busy.value = true
    error.value = ''
    try {
      adopt(await enableEnhancedPlugin())
      notice.value = '插件服务已启用；采集仍遵循现有全局/节点开关。'
    }
    catch {
      error.value = '插件未能启用，请查看官方后台；没有绕过权限审批。'
    }
    finally {
      busy.value = false
    }
  }
  watch(selected, hydrate)
  watch(draft, () => {
    if (!hydrating) {
      dirty.value = true
      confirmed.value = false
    }
  }, { deep: true, flush: 'sync' })
  watch(() => app.privateFeaturesAllowed, (allowed) => {
    if (!allowed) {
      state.value = null
      draft.value = null
    }
  })
  onMounted(() => {
    void refresh()
    timer = setInterval(() => {
      now.value = Date.now()
      if (!dirty.value)
        void refresh()
    }, 30000)
  })
  onScopeDispose(() => {
    disposed = true
    clearInterval(timer)
  })
  const selectedProbe = computed(() => state.value?.snapshot.nodes[selected.value])
  const presence = computed(() => helperPresence(selectedProbe.value, now.value))
  const command = computed(() => nodeBootstrapCommand(window.location.origin, selected.value))
  const lastResult = computed(() => Object.values(selectedProbe.value?.auto ?? {}).map(v => v.collectedAt).sort().at(-1) ?? '尚无回报')
  return { state, selected, draft, busy, dirty, confirmed, error, notice, choices, selectedProbe, presence, command, lastResult, refresh, save, enable }
}
