import manifest from '../../komari-theme.json' with { type: 'json' }

export const ENHANCED_SETTINGS_GROUPS = [
  { id: 'home', label: '基础与首页', title: '01 · 基础与首页' },
  { id: 'nodes', label: '节点与卡片', title: '02 · 节点与卡片' },
  { id: 'routes', label: '线路与延迟', title: '03 · 线路与延迟' },
  { id: 'appearance', label: '外观与背景', title: '04 · 外观与背景' },
  { id: 'advanced', label: '高级设置', title: '05 · 高级设置' },
] as const
export type SettingsGroup = typeof ENHANCED_SETTINGS_GROUPS[number]['id']
export interface ThemeField { key: string, name: string | Record<string, string>, type: string, help?: string | Record<string, string>, default?: unknown, options?: string }
export const THEME_FIELDS = manifest.configuration.data.filter(f => 'key' in f) as ThemeField[]
const FIELD_GROUPS = new Map<string, SettingsGroup>()
let group: SettingsGroup = 'home'
for (const field of manifest.configuration.data) {
  if (field.type === 'title')
    group = ENHANCED_SETTINGS_GROUPS.find(g => g.title === field.name)?.id ?? 'home'
  else if ('key' in field && typeof field.key === 'string')
    FIELD_GROUPS.set(field.key, group)
}
export function settingGroup(key: string): SettingsGroup {
  return FIELD_GROUPS.get(key) ?? 'home'
}
export function settingText(value: string | Record<string, string> | undefined): string {
  return typeof value === 'string' ? value : value?.['zh-CN'] ?? value?.en ?? ''
}
export function validateThemePatch(patch: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(patch)) {
    const field = THEME_FIELDS.find(f => f.key === key)
    if (!field || key === 'trafficCycleConfig')
      throw new Error('不支持的设置字段；未写入')
    if ((field.type === 'switch' && typeof value !== 'boolean') || (field.type === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) || (['string', 'richtext', 'select'].includes(field.type) && typeof value !== 'string'))
      throw new Error('设置类型无效；未写入')
    if (field.type === 'select' && !field.options?.split(',').map(s => s.trim()).includes(value as string))
      throw new Error('请选择声明的设置选项；未写入')
  }
}
