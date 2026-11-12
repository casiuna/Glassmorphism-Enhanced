import type { ManagementDraft, ProbePolicy } from '@/utils/enhancedManagement'
import type { ProbeSnapshot } from '@/utils/routeProbeSnapshot'
import type { PublicInfo } from '@/utils/rpc'
import { requirePermission } from '@/services/auth.service'
import { requestManager } from '@/services/request.service'
import { getSharedApi } from '@/utils/api'
import { managementChanges, parseProbePolicy, PROBE_SHORT, stableValue, THEME_SHORT } from '@/utils/enhancedManagement'
import { parseProbeSnapshot } from '@/utils/routeProbeSnapshot'
import { getSharedRpc } from '@/utils/rpc'

interface NativePlugin { short: string, version: string, enabled: boolean, running: boolean }
interface PluginHealth { schema: number, version: string, storage: string }
export interface EnhancedManagementState {
  public: PublicInfo
  komariVersion: string
  themeVersion: string | null
  plugin: NativePlugin | null
  config: Record<string, unknown> | null
  policy: ProbePolicy | null
  snapshot: ProbeSnapshot
  health: PluginHealth | null
  error: string | null
}
const ROOT = '/api/enhanced-route-probe/v1'
let saving = false

async function authorize() {
  if (!(await requirePermission('advancedTools', { force: true })).granted)
    throw new Error('需要重新登录管理员账户；未发送配置修改')
}
async function resource(name: 'health' | 'snapshot', signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(`${ROOT}/${name}`, { credentials: 'same-origin', headers: { 'X-Enhanced-Route': '1' }, signal, redirect: 'error' })
  if (!response.ok)
    throw new Error('插件未运行、权限不足或协议不兼容')
  const text = await response.text()
  if (text.length > 4194304)
    throw new Error('插件响应超过限制')
  return JSON.parse(text)
}
async function fetchState(signal?: AbortSignal): Promise<EnhancedManagementState> {
  const rpc = getSharedRpc()
  const [publicInfo, version, plugins, themes] = await Promise.all([
    rpc.getPublicSettings(),
    rpc.getPublicVersion(),
    rpc.getClient().call<NativePlugin[]>('admin:listPlugins', {}, signal),
    getSharedApi().getThemes(signal),
  ])
  const plugin = (plugins ?? []).find(p => p.short === PROBE_SHORT) ?? null
  const state: EnhancedManagementState = { public: publicInfo, komariVersion: version.version, themeVersion: (themes ?? []).find(t => t.short === THEME_SHORT)?.version ?? null, plugin, config: null, policy: null, snapshot: { nodes: {} }, health: null, error: null }
  if (!plugin)
    return state
  const config = await rpc.getClient().call<{ data: Record<string, unknown> }>('admin:getPluginConfiguration', { short: PROBE_SHORT }, signal)
  state.config = config.data
  try {
    state.policy = parseProbePolicy(config.data)
    if (plugin.running) {
      const [health, raw] = await Promise.all([resource('health', signal), resource('snapshot', signal)])
      const h = health as PluginHealth
      if (h.schema !== 1 || h.version !== plugin.version || !['healthy', 'unavailable'].includes(h.storage))
        throw new Error('插件版本或健康协议不一致')
      state.health = h
      state.snapshot = parseProbeSnapshot(raw)
    }
  }
  catch {
    state.error = '插件策略/存储/协议异常；不会把不可用状态当作已检测。请检查版本或官方后台配置。'
  }
  return state
}
export async function loadEnhancedManagement(): Promise<EnhancedManagementState> {
  await authorize()
  return requestManager.run('enhanced:management:load', signal => fetchState(signal), { retryAttempts: 0 })
}
export function managementFingerprint(state: EnhancedManagementState): string {
  return stableValue({ theme: state.public.theme, settings: state.public.theme_settings, version: state.themeVersion, plugin: state.plugin, config: state.config })
}
async function putPlugin(data: Record<string, unknown>, signal?: AbortSignal) {
  await getSharedRpc().getClient().call('admin:setPluginConfiguration', { short: PROBE_SHORT, data }, signal)
}
async function compensate(before: EnhancedManagementState, next: ReturnType<typeof managementChanges>) {
  return requestManager.run('enhanced:management:compensate', async (signal) => {
    const current = await fetchState(signal)
    let conflicted = false
    if (stableValue(current.config) === stableValue(next.plugin))
      await putPlugin(before.config!, signal)
    else if (stableValue(current.config) !== stableValue(before.config))
      conflicted = true
    if (current.public.theme === before.public.theme && stableValue(current.public.theme_settings) === stableValue(next.theme))
      await getSharedApi().updateThemeSettings(THEME_SHORT, before.public.theme_settings, signal)
    else if (current.public.theme !== before.public.theme || stableValue(current.public.theme_settings) !== stableValue(before.public.theme_settings))
      conflicted = true
    const restored = await fetchState(signal)
    if (conflicted || managementFingerprint(restored) !== managementFingerprint(before))
      throw new Error('补偿遇到配置冲突或读取校验失败')
  }, { retryAttempts: 0 })
}
export async function saveEnhancedManagement(expected: EnhancedManagementState, draft: ManagementDraft): Promise<EnhancedManagementState> {
  if (saving)
    throw new Error('另一次保存尚未结束，请稍后刷新')
  saving = true
  try {
    await authorize()
    return await requestManager.run('enhanced:management:write', async (signal) => {
      const before = await fetchState(signal)
      if (managementFingerprint(before) !== managementFingerprint(expected))
        throw new Error('配置已被其他操作修改，请刷新后再确认；本次未写入')
      if (before.public.theme !== THEME_SHORT || before.komariVersion !== '1.6.0' || !before.plugin?.running || !before.config || !before.policy || !before.health || before.health.storage !== 'healthy')
        throw new Error('需要正在运行的兼容插件及当前 Enhanced 主题；未写入')
      const next = managementChanges(before.public.theme_settings, before.config, draft)
      try {
        if (stableValue(next.theme) !== stableValue(before.public.theme_settings))
          await getSharedApi().updateThemeSettings(THEME_SHORT, next.theme, signal)
        if (stableValue(next.plugin) !== stableValue(before.config))
          await putPlugin(next.plugin, signal)
        const after = await fetchState(signal)
        if (after.public.theme !== THEME_SHORT || stableValue(after.public.theme_settings) !== stableValue(next.theme) || stableValue(after.config) !== stableValue(next.plugin) || after.error)
          throw new Error('保存后读取校验失败')
        return after
      }
      catch {
        try {
          await compensate(before, next)
        }
        catch {
          throw new Error('保存失败，且无法完整补偿或检测到其他改动；未强行覆盖。请保留当前页面并到官方后台核对。')
        }
        throw new Error('保存失败；已恢复原有主题与插件配置并读取确认')
      }
    }, { retryAttempts: 0, timeout: 30000 })
  }
  finally {
    saving = false
  }
}
export async function enableEnhancedPlugin(): Promise<EnhancedManagementState> {
  await authorize()
  await requestManager.run('enhanced:management:enable', async (signal) => {
    const state = await fetchState(signal)
    if (!state.plugin || state.komariVersion !== '1.6.0' || state.public.theme !== THEME_SHORT)
      throw new Error('请先用统一 CLI 安装兼容的 Enhanced 主题与插件')
    await getSharedRpc().getClient().call('admin:setPluginEnabled', { short: PROBE_SHORT, enabled: true, approved: true }, signal)
  }, { retryAttempts: 0 })
  const result = await loadEnhancedManagement()
  if (!result.plugin?.running || !result.health)
    throw new Error('插件启用后仍未通过健康读取，请检查官方后台')
  return result
}
