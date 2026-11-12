import type { Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { expect, test } from '@playwright/test'
import { installKomariFixture } from './fixtures/komari'

const UUID = '00000000-0000-4000-8000-000000000001'
const OTHER = '00000000-0000-4000-8000-000000000002'
const NOW = Date.parse('2026-07-25T12:00:00.000Z')
const HASH = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim()
const VERSION = `0.2.0+git.${HASH}`

async function fixture(page: Page, options: { installed?: boolean, loggedIn?: boolean, dark?: boolean, offline?: boolean, legacy?: boolean, corrupt?: boolean, corruptManual?: boolean } = {}) {
  const state = {
    settings: { themeMode: options.dark ? 'dark' : 'light', hideEarth: true, visitorInfoEnabled: false, rpcTransportMode: 'http', disablePageAnimation: true, transitCarrierPingRules: 'KEEP_RELAY', displayCurrency: 'SGD', unknownFuture: { preserve: true }, returnRouteConfig: options.corruptManual ? '{broken' : '{"version":1,"nodes":{}}' } as Record<string, unknown>,
    config: { enabled: false, nodes: options.corrupt ? '{broken' : JSON.stringify({ [OTHER]: { enabled: false, city: 'shanghai', periodMinutes: 720 } }) },
    writes: [] as string[],
    privateReads: 0,
    failAfterCommit: false,
    installed: options.installed ?? true,
    running: true,
  }
  await installKomariFixture(page, { hideEarth: true, themeShort: 'Enhanced', loggedIn: options.loggedIn ?? true, dark: options.dark, themeSettings: state.settings })
  const pub = () => ({ allow_cors: false, custom_body: '', custom_head: '', description: 'EXPLICIT LOCAL MOCK', disable_password_login: false, oauth_enable: false, oauth_provider: '', private_site: false, record_enabled: true, record_preserve_time: 720, ping_record_preserve_time: 720, sitename: 'Komari Visual Lab', theme: 'Enhanced', theme_settings: state.settings })
  await page.route('**/api/public', route => route.fulfill({ json: { status: 'success', data: pub() } }))
  await page.route('**/api/admin/theme/list', route => route.fulfill({ json: { status: 'success', data: [{ short: 'Enhanced', version: `1.2.0` }] } }))
  await page.route('**/api/admin/theme/settings?theme=Enhanced', async (route) => {
    state.writes.push('theme-settings')
    state.settings = route.request().postDataJSON()
    await route.fulfill({ json: { status: 'success', message: '' } })
  })
  await page.route('**/api/rpc2', async (route) => {
    const data = route.request().postDataJSON()
    const result = (value: unknown) => route.fulfill({ json: { jsonrpc: '2.0', id: data.id, result: value } })
    switch (data.method) {
      case 'public:getPublicSettings':
        return result(pub())
      case 'public:getVersion':
        return result({ version: '1.6.0', hash: 'LOCAL-MOCK' })
      case 'admin:listPlugins':
        state.privateReads++
        return result(state.installed ? [{ short: 'enhanced-route-probe', version: options.legacy ? '0.1.0' : VERSION, enabled: state.running, running: state.running }] : [])
      case 'admin:getPluginConfiguration':
        state.privateReads++
        return result({ data: state.config })
      case 'admin:setPluginConfiguration':
        state.writes.push('plugin-config')
        state.config = data.params.data
        if (state.failAfterCommit) {
          state.failAfterCommit = false
          return route.fulfill({ status: 503, json: { error: 'EXPLICIT RESPONSE FAILURE FIXTURE' } })
        }
        // Native void ACK intentionally omits result, as 1.6.0 actually does.
        return route.fulfill({ json: { jsonrpc: '2.0', id: data.id } })
      case 'admin:setPluginEnabled':
        state.writes.push('plugin-enabled')
        expect(data.params).toEqual({ short: 'enhanced-route-probe', enabled: true, approved: true })
        state.running = true
        return result(null)
      default:
        return route.fallback()
    }
  })
  await page.route('**/api/enhanced-route-probe/v1/*', async (route) => {
    state.privateReads++
    if (route.request().url().endsWith('/health'))
      return route.fulfill({ json: { schema: 1, version: options.legacy ? '0.1.0' : VERSION, storage: 'healthy' } })
    return route.fulfill({ json: { schema: 1, nodes: { [UUID]: { enabled: false, state: 'not-detected', registeredAt: NOW - 100000, seenAt: options.offline ? NOW - 200000 : null, helperVersion: options.legacy ? null : VERSION, latest: null } } } })
  })
  return state
}
async function open(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Enhanced 管理', exact: true }).click()
  await expect(page.locator('[data-enhanced-versions]')).toBeVisible()
}

test('guest has no manager entry and never requests private plugin data', async ({ page }) => {
  const state = await fixture(page, { loggedIn: false })
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Enhanced 管理', exact: true })).toHaveCount(0)
  expect(state.privateReads).toBe(0)
  expect(state.writes).toEqual([])
})
test('missing plugin offers the unified CLI, never an automatic install or privilege request', async ({ page }) => {
  const state = await fixture(page, { installed: false })
  await open(page)
  await expect(page.getByRole('dialog')).toContainText('插件未安装')
  await expect(page.getByRole('dialog')).toContainText('python3 manage.py install')
  expect(state.writes).toEqual([])
})
for (const scenario of [
  { name: 'desktop-light', width: 1440, dark: false },
  { name: 'desktop-dark', width: 1440, dark: true },
  { name: 'mobile-light', width: 390, dark: false },
  { name: 'mobile-dark', width: 320, dark: true },
]) {
  test(`unified manager fits ${scenario.name} with no auto writes or token command`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: scenario.width, height: 900 })
    const state = await fixture(page, { dark: scenario.dark })
    await open(page)
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('已登记，尚未轮询')
    await dialog.locator('summary').click()
    const command = page.locator('[data-node-bootstrap]')
    await expect(command).toContainText(UUID)
    await expect(command).not.toContainText('--token')
    await expect(command).not.toContainText('ssh ')
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    expect(state.writes).toEqual([])
    await dialog.screenshot({ path: testInfo.outputPath(`enhanced-${scenario.name}.png`) })
  })
}
test('stale helper and old plugin version are not mistaken for online or matching', async ({ page }) => {
  await fixture(page, { offline: true, legacy: true })
  await open(page)
  await expect(page.locator('[data-helper-status]')).toContainText('离线或心跳已过期')
  await expect(page.locator('[data-enhanced-upgrade]')).toBeVisible()
})
test('central form preserves another UUID, Relay/SGD/unknown fields and requires explicit confirmation', async ({ page }) => {
  const state = await fixture(page)
  const other = JSON.parse(state.config.nodes)[OTHER]
  await open(page)
  const save = page.getByRole('button', { name: '保存当前节点及显示设置', exact: true })
  await expect(save).toBeDisabled()
  await page.getByRole('checkbox', { name: '允许全局自动采集', exact: true }).check()
  await page.getByRole('checkbox', { name: '授权当前节点采集', exact: true }).check()
  await page.getByRole('textbox', { name: '电信手动覆盖', exact: true }).fill('<真实用户文本> & manual')
  await page.getByRole('checkbox', { name: '确认当前管理操作', exact: true }).check()
  await save.click()
  await expect(page.getByRole('status')).toContainText('已保存并读取确认')
  expect(JSON.parse(state.config.nodes)[OTHER]).toEqual(other)
  expect(state.settings).toMatchObject({ transitCarrierPingRules: 'KEEP_RELAY', displayCurrency: 'SGD', unknownFuture: { preserve: true } })
  expect(JSON.parse(state.settings.returnRouteConfig as string).nodes[UUID].manual.telecom.label).toBe('<真实用户文本> & manual')
})
test('detected concurrent policy change stops the form save before any write', async ({ page }) => {
  const state = await fixture(page)
  await open(page)
  state.config.nodes = JSON.stringify({ [OTHER]: { enabled: true, city: 'guangzhou', periodMinutes: 120 } })
  await page.getByRole('textbox', { name: '电信手动覆盖', exact: true }).fill('not-written')
  await page.getByRole('checkbox', { name: '确认当前管理操作', exact: true }).check()
  await page.getByRole('button', { name: '保存当前节点及显示设置', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('配置已被其他操作修改')
  expect(state.writes).toEqual([])
})
test('error after a committed plugin update compensates both maps and reports actual recovery', async ({ page }) => {
  const state = await fixture(page)
  const oldSettings = structuredClone(state.settings)
  const oldPolicy = structuredClone(state.config)
  await open(page)
  state.failAfterCommit = true
  await page.getByRole('checkbox', { name: '允许全局自动采集', exact: true }).check()
  await page.getByRole('textbox', { name: '电信手动覆盖', exact: true }).fill('must-be-rolled-back')
  await page.getByRole('checkbox', { name: '确认当前管理操作', exact: true }).check()
  await page.getByRole('button', { name: '保存当前节点及显示设置', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('已恢复原有主题与插件配置')
  expect(state.config).toEqual(oldPolicy)
  expect(state.settings).toEqual(oldSettings)
})
test('invalid existing plugin policy disables writes without deleting the source configuration', async ({ page }) => {
  const state = await fixture(page, { corrupt: true })
  await open(page)
  await expect(page.getByRole('alert')).toContainText('策略/存储/协议异常')
  await expect(page.getByRole('button', { name: '保存当前节点及显示设置', exact: true })).toBeDisabled()
  expect(state.config.nodes).toBe('{broken')
  expect(state.writes).toEqual([])
})
test('invalid manual document refuses a save instead of replacing it with an empty document', async ({ page }) => {
  const state = await fixture(page, { corruptManual: true })
  await open(page)
  await page.getByRole('checkbox', { name: '确认当前管理操作', exact: true }).check()
  await page.getByRole('button', { name: '保存当前节点及显示设置', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('不会覆盖')
  expect(state.settings.returnRouteConfig).toBe('{broken')
  expect(state.writes).toEqual([])
})
