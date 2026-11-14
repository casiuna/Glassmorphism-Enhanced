import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { installKomariFixture } from './fixtures/komari'

const A = '00000000-0000-4000-8000-000000000001'
const B = '00000000-0000-4000-8000-000000000002'
const OPTIONAL_OR_EXEC_METHOD = /^(?:admin|agent)[:.].*(?:[Pp]lugin|[Tt]ask|[Ee]xec)/
async function fixture(page: Page, guest = false) {
  const state = { settings: { hideEarth: true, visitorInfoEnabled: false, themeMode: 'light', disablePageAnimation: true, rpcTransportMode: 'http', returnRoutesVisible: true, returnRouteAutoEnabled: false, returnRouteCompanionEnabled: false, returnRouteConfig: '{"version":1,"nodes":{}}', unknownFuture: 'KEEP', transitCarrierPingRules: 'KEEP_RELAY' } as Record<string, unknown>, writes: 0, pluginCalls: 0 }
  await installKomariFixture(page, { themeShort: 'Enhanced', loggedIn: !guest, hideEarth: true, themeSettings: state.settings })
  const pub = () => ({ theme: 'Enhanced', theme_settings: state.settings, sitename: 'EXPLICIT SETTINGS MOCK', description: '', private_site: false, custom_head: '', custom_body: '' })
  await page.route('**/api/public', r => r.fulfill({ json: { status: 'success', data: pub() } }))
  await page.route('**/api/rpc2', async (r) => {
    const d = r.request().postDataJSON()
    if (d.method === 'public:getPublicSettings')
      return r.fulfill({ json: { jsonrpc: '2.0', id: d.id, result: pub() } })
    if (OPTIONAL_OR_EXEC_METHOD.test(d.method)) {
      state.pluginCalls++
      return r.fulfill({ json: { jsonrpc: '2.0', id: d.id, error: { code: -32601, message: 'NO OPTIONAL SOFTWARE INSTALLED' } } })
    }
    return r.fallback()
  })
  await page.route('**/api/enhanced-route-probe/**', async (r) => {
    state.pluginCalls++
    await r.fulfill({ status: 404, json: {} })
  })
  await page.route('**/api/admin/theme/settings?theme=Enhanced', async (r) => {
    state.writes++
    state.settings = r.request().postDataJSON()
    await r.fulfill({ json: { status: 'success', message: '' } })
  })
  return state
}
async function open(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Enhanced 管理', exact: true }).click()
  await expect(page.locator('[data-manual-route-manager]')).toBeVisible()
  await page.getByRole('combobox', { name: '手动线路节点', exact: true }).selectOption(A)
}
test('manual routes save with zero optional dependencies, persist, and share raw JSON', async ({ page }) => {
  const state = await fixture(page)
  await open(page)
  expect(await page.getByRole('tab').allTextContents()).toEqual(['01 · 基础与首页', '02 · 节点与卡片', '03 · 线路与延迟', '04 · 外观与背景', '05 · 高级设置'])
  for (const [carrier, label] of [['联通', '9929'], ['电信', 'CN2'], ['移动', 'CMI']])
    await page.getByRole('textbox', { name: `${carrier}手动线路`, exact: true }).fill(label)
  await page.getByRole('button', { name: '保存本节点手动线路', exact: true }).click()
  await expect(page.locator('[data-manual-route-manager] [role=status]')).toContainText('已保存并读回')
  expect(state.pluginCalls).toBe(0)
  expect(state.settings).toMatchObject({ unknownFuture: 'KEEP', transitCarrierPingRules: 'KEEP_RELAY', returnRouteAutoEnabled: false, returnRouteCompanionEnabled: false })
  await page.locator('[data-route-raw-settings] > summary').click()
  const raw = page.getByRole('textbox', { name: '按节点 UUID 配置三网回程 JSON', exact: true })
  await expect(raw).toHaveValue(String(state.settings.returnRouteConfig))
  const doc = JSON.parse(String(state.settings.returnRouteConfig))
  doc.nodes[A].manual.telecom.label = 'NATIVE_JSON_EDIT'
  await raw.fill(JSON.stringify(doc))
  await page.getByRole('button', { name: '保存本分类设置', exact: true }).click()
  await expect(page.getByRole('textbox', { name: '电信手动线路', exact: true })).toHaveValue('NATIVE_JSON_EDIT')
  await page.getByRole('button', { name: '关闭', exact: true }).click()
  await page.reload()
  await expect(page.locator(`[data-route-node="${A}"]`)).toContainText('NATIVE_JSON_EDIT')
  await page.getByRole('button', { name: 'Enhanced 管理', exact: true }).click()
  await page.getByRole('combobox', { name: '手动线路节点', exact: true }).selectOption(A)
  await expect(page.getByRole('textbox', { name: '电信手动线路', exact: true })).toHaveValue('NATIVE_JSON_EDIT')
  expect(state.pluginCalls).toBe(0)
})
test('same-node concurrent edit is rejected; other nodes and flags are not overwritten', async ({ page }) => {
  const state = await fixture(page)
  await open(page)
  await page.getByRole('textbox', { name: '电信手动线路', exact: true }).fill('MY_EDIT')
  state.settings.returnRouteConfig = JSON.stringify({ version: 1, nodes: { [A]: { manual: { telecom: { label: 'OTHER_ADMIN', updatedAt: null } }, auto: {} }, [B]: { manual: { mobile: { label: 'KEEP', updatedAt: null } }, auto: {} } } })
  await page.getByRole('button', { name: '保存本节点手动线路', exact: true }).click()
  await expect(page.locator('[data-manual-route-manager] [role=alert]')).toContainText('已被其他管理员修改')
  expect(state.writes).toBe(0)
  expect(String(state.settings.returnRouteConfig)).toContain('OTHER_ADMIN')
})
test('04 contains only appearance settings and no optional private reads; 03 retains Ping/Transit', async ({ page }) => {
  const state = await fixture(page)
  await open(page)
  await expect(page.getByRole('checkbox', { name: '启用中转三网延迟估算', exact: true })).toBeVisible()
  await page.getByRole('tab', { name: '外观与背景', exact: true }).click()
  await expect(page.getByRole('combobox', { name: '默认主题模式', exact: true })).toBeVisible()
  await expect(page.getByRole('checkbox', { name: '显示回程线路', exact: true })).toHaveCount(0)
  await expect(page.locator('[data-manual-route-manager]')).toHaveCount(0)
  expect(state.pluginCalls).toBe(0)
})
test('anonymous deep link cannot access administrator settings or dispatch anything', async ({ page }) => {
  const state = await fixture(page, true)
  await page.goto('/?enhanced_settings=routes')
  await expect(page.getByRole('button', { name: 'Enhanced 管理', exact: true })).toHaveCount(0)
  await expect(page.locator('[data-manual-route-manager]')).toHaveCount(0)
  expect(state.writes).toBe(0)
  expect(state.pluginCalls).toBe(0)
})
test('invalid raw JSON cannot overwrite saved routes', async ({ page }) => {
  const state = await fixture(page)
  await open(page)
  await page.locator('[data-route-raw-settings] > summary').click()
  await page.getByRole('textbox', { name: '按节点 UUID 配置三网回程 JSON', exact: true }).fill('{broken')
  await page.getByRole('button', { name: '保存本分类设置', exact: true }).click()
  await expect(page.locator('[data-theme-settings-panel] > [role=alert]')).toContainText('线路 JSON 无效；未覆盖')
  expect(state.writes).toBe(0)
  expect(state.settings.returnRouteConfig).toBe('{"version":1,"nodes":{}}')
  expect(state.pluginCalls).toBe(0)
})
test('manual save preserves local unsaved display settings without enabling automatic collection', async ({ page }) => {
  const state = await fixture(page)
  await open(page)
  await page.getByRole('checkbox', { name: '显示回程线路', exact: true }).uncheck()
  await page.getByRole('textbox', { name: '电信手动线路', exact: true }).fill('MANUAL')
  await page.getByRole('button', { name: '保存本节点手动线路', exact: true }).click()
  await expect(page.locator('[data-manual-route-manager] [role=status]')).toContainText('已保存并读回')
  await expect(page.getByRole('checkbox', { name: '显示回程线路', exact: true })).not.toBeChecked()
  expect(state.settings.returnRoutesVisible).toBe(true)
  await page.getByRole('button', { name: '保存本分类设置', exact: true }).click()
  await expect(page.locator('[data-theme-settings-panel] > [role=status]')).toContainText('已保存并读回')
  expect(state.settings.returnRoutesVisible).toBe(false)
  expect(state.settings.returnRouteAutoEnabled).toBe(false)
  expect(state.settings.returnRouteCompanionEnabled).toBe(false)
})
