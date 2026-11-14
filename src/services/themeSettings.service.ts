import type { ReturnCarrier } from '@/utils/returnRouteClassification'
import type { NodeReturnRoutes } from '@/utils/returnRoutes'
import type { PublicInfo } from '@/utils/rpc'
import { requirePermission } from '@/services/auth.service'
import { requestManager } from '@/services/request.service'
import { getSharedApi } from '@/utils/api'
import { stableValue } from '@/utils/enhancedManagement'
import { manualRouteConfig } from '@/utils/manualRouteSettings'
import { parseReturnRouteConfig } from '@/utils/returnRoutes'
import { getSharedRpc } from '@/utils/rpc'
import { validateThemePatch } from '@/utils/themeSettings'
import { changeTrafficReset, parseTrafficCycleConfig, TRAFFIC_CONFIG_KEY } from '@/utils/trafficCycle'

let saving = false
async function authorize() {
  if (!(await requirePermission('advancedTools', { force: true })).granted)
    throw new Error('需要管理员重新登录；未修改主题配置')
}
async function current(): Promise<PublicInfo> {
  const data = await getSharedRpc().getPublicSettings()
  if (data.theme !== 'Enhanced')
    throw new Error('当前主题不是 Enhanced；未写入')
  return data
}
export async function loadManagedSettings(): Promise<PublicInfo> {
  await authorize()
  return requestManager.run('enhanced:settings:read', current, { retryAttempts: 0 })
}
async function write(change: (before: Record<string, unknown>) => Record<string, unknown>): Promise<PublicInfo> {
  if (saving)
    throw new Error('另一次主题保存尚未结束，请稍后重试')
  saving = true
  try {
    await authorize()
    return await requestManager.run('enhanced:settings:write', async (signal) => {
      const before = await current()
      const next = change(before.theme_settings)
      const checked = await current()
      if (stableValue(checked.theme_settings) !== stableValue(before.theme_settings))
        throw new Error('设置已被其他管理员修改；本次未写入，请重新加载')
      try {
        await getSharedApi().updateThemeSettings('Enhanced', next, signal)
      }
      catch {
        // A transport error may follow a committed write. Only a readback of
        // exactly our intended map can establish success, never HTTP 200 alone.
        const after = await current()
        if (stableValue(after.theme_settings) === stableValue(next))
          return after
        throw new Error('保存未确认；未强行覆盖其他设置，请重新加载核对')
      }
      const after = await current()
      if (stableValue(after.theme_settings) !== stableValue(next))
        throw new Error('保存后读回不一致；未强行覆盖其他设置，请重新加载核对')
      return after
    }, { retryAttempts: 0, timeout: 30000 })
  }
  finally {
    saving = false
  }
}
export async function saveManagedSettings(expected: Record<string, unknown>, patch: Record<string, unknown>): Promise<PublicInfo> {
  validateThemePatch(patch)
  if ('returnRouteConfig' in patch && parseReturnRouteConfig(patch.returnRouteConfig).error)
    throw new Error('线路 JSON 无效；未覆盖，请修复后保存')
  return write((before) => {
    for (const key of Object.keys(patch)) {
      if (stableValue(before[key]) !== stableValue(expected[key]))
        throw new Error('该设置已被修改；本次未写入，请重新加载')
    }
    return { ...before, ...patch }
  })
}
export async function saveTrafficReset(uuid: string, resetDay: number | null, expectedResetDay: number | undefined): Promise<PublicInfo> {
  return write((before) => {
    const parsed = parseTrafficCycleConfig(before[TRAFFIC_CONFIG_KEY])
    if (parsed.error)
      throw new Error(parsed.error)
    if (parsed.document.nodes[uuid]?.resetDay !== expectedResetDay)
      throw new Error('该节点的重置日已被其他操作修改；本次未覆盖')
    return { ...before, [TRAFFIC_CONFIG_KEY]: changeTrafficReset(before[TRAFFIC_CONFIG_KEY], uuid, resetDay) }
  })
}

export async function saveManualRoutes(uuid: string, values: Record<ReturnCarrier, string>, expectedNode: NodeReturnRoutes | undefined): Promise<PublicInfo> {
  return write((before) => {
    const parsed = parseReturnRouteConfig(before.returnRouteConfig)
    if (parsed.error)
      throw new Error('原有线路 JSON 无效；未覆盖')
    if (stableValue(parsed.document.nodes[uuid]) !== stableValue(expectedNode))
      throw new Error('该节点线路已被其他管理员修改；请重新加载，本次未覆盖')
    return { ...before, returnRouteConfig: manualRouteConfig(before.returnRouteConfig, uuid, values) }
  })
}
