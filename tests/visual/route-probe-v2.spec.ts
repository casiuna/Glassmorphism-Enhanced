import type { Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { expect, test } from '@playwright/test'
import helperManifest from '../../companion/helper/helper-version.json' with { type: 'json' }
import themeManifest from '../../komari-theme.json' with { type: 'json' }
import { installKomariFixture } from './fixtures/komari'

const require = createRequire(import.meta.url)
const { fixtureV2 } = require('../companion/probe-v2-fixture.cjs')

const UUID = '00000000-0000-4000-8000-000000000001'
const AT = '2026-07-25T11:00:00.000Z'
const NOW = Date.parse('2026-07-25T12:00:00.000Z')
const VERSION = `${helperManifest.version}+git.${execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim()}`
const BASE = fixtureV2(AT)
async function fixture(page: Page, options: { guest?: boolean, single?: boolean, manual?: boolean, denied?: boolean, invalid?: boolean, narrow?: boolean } = {}) {
  if (options.narrow)
    await page.setViewportSize({ width: 320, height: 844 })
  const latest = structuredClone(BASE)
  if (options.single) {
    latest.protocols = ['tcp']
    for (const carrier of Object.keys(latest.carriers))
      latest.carriers[carrier] = { tcp: latest.carriers[carrier].tcp }
  }
  if (options.denied)
    Object.assign(latest.carriers.telecom.tcp, { status: 'permission-denied', hops: [], reachedTarget: false })
  if (options.invalid)
    latest.carriers.telecom.tcp.hops[0].ips = ['<img src=x onerror=window.__v2Pwned=1>']
  const state = { reads: 0, writes: [] as string[] }
  const settings = { returnRoutesVisible: true, returnRouteAutoEnabled: true, returnRouteCompanionEnabled: true, returnRouteTtlHours: 24, returnRouteConfig: options.manual ? JSON.stringify({ version: 1, nodes: { [UUID]: { manual: { telecom: { label: '我的 手动线路', updatedAt: AT } } } } }) : '{"version":1,"nodes":{}}' }
  await installKomariFixture(page, { themeShort: 'Enhanced', hideEarth: true, loggedIn: !options.guest, dark: options.narrow, nodeCardSize: options.narrow ? 'mini' : 'compact', themeSettings: settings })
  await page.route('**/api/admin/theme/list', route => route.fulfill({ json: { status: 'success', data: [{ short: 'Enhanced', version: themeManifest.version }] } }))
  await page.route('**/api/enhanced-route-probe/v1/*', (route) => {
    state.reads++
    if (route.request().url().endsWith('/health'))
      return route.fulfill({ json: { schema: 1, version: VERSION, storage: 'healthy' } })
    return route.fulfill({ json: { schema: 1, nodes: { [UUID]: { enabled: true, state: 'fixture-complete', seenAt: NOW, registeredAt: NOW - 1000, helperVersion: VERSION, latest } } } })
  })
  await page.route('**/api/rpc2', (route) => {
    const body = route.request().postDataJSON()
    const result = (value: unknown) => route.fulfill({ json: { jsonrpc: '2.0', id: body.id, result: value } })
    if (body.method === 'public:getPublicSettings')
      return result({ allow_cors: false, custom_body: '', custom_head: '', description: 'EXPLICIT LOCAL UI MOCK', disable_password_login: false, oauth_enable: false, oauth_provider: '', private_site: false, record_enabled: true, record_preserve_time: 720, ping_record_preserve_time: 720, sitename: 'Komari Visual Lab', theme: 'Enhanced', theme_settings: { hideEarth: true, visitorInfoEnabled: false, rpcTransportMode: 'http', disablePageAnimation: true, ...settings } })
    if (body.method === 'public:getVersion')
      return result({ version: '1.6.0', hash: 'LOCAL-UI-MOCK' })
    if (body.method === 'admin:listPlugins')
      return result([{ short: 'enhanced-route-probe', version: VERSION, enabled: true, running: true }])
    if (body.method === 'admin:getPluginConfiguration')
      return result({ data: { enabled: true, nodes: JSON.stringify({ [UUID]: { enabled: true, city: 'beijing', periodMinutes: 360 } }) } })
    if (body.method?.startsWith('admin:set'))
      state.writes.push(body.method)
    return route.fallback()
  })
  await page.goto('/')
  return state
}
const node = (page: Page) => page.locator(`[data-route-node="${UUID}"]`)
async function details(page: Page) {
  await page.getByRole('button', { name: 'Enhanced 管理', exact: true }).click()
  await page.locator('[data-optional-companion] > summary').click()
  return page.getByRole('dialog').locator('[data-protocol-evidence]')
}

test('TCP/UDP disagreement is compact and explicit; administrator expands independent real-parser fixture evidence', async ({ page }) => {
  const state = await fixture(page)
  // Fixture/disagreement is diagnostic evidence, never a front-card route.
  await expect(node(page)).toHaveCount(0)
  const proof = await details(page)
  const telecom = proof.locator('[data-protocol-carrier="telecom"]')
  await expect(telecom.locator('[data-protocol-comparison]')).toHaveAttribute('data-protocol-comparison', 'different')
  await expect(telecom.locator('[data-protocol-trace]')).toHaveCount(2)
  await telecom.locator('[data-protocol-trace="tcp"] summary').click()
  await expect(telecom).toContainText('模拟 fixture')
  await expect(telecom.locator('[data-protocol-trace="tcp"]')).toContainText('GIA 候选，未认证')
  await expect(telecom.locator('[data-protocol-trace="tcp"] table')).toContainText('59.43.2.1')
  await expect(telecom.locator('[data-protocol-trace="tcp"] [data-asn-lookup]')).toContainText('Team Cymru 未启用')
  await expect(node(page).getByLabel('手动精品标注，非自动认证')).toHaveCount(0)
  expect(state.writes).toEqual([])
})
test('Enhanced management exposes TCP/UDP source, collection time, hidden hops and path differences without scheduling', async ({ page }) => {
  const state = await fixture(page)
  await page.getByRole('button', { name: 'Enhanced 管理', exact: true }).click()
  await page.locator('[data-optional-companion] > summary').click()
  const proof = page.getByRole('dialog').locator('[data-protocol-evidence]')
  await expect(proof).toBeVisible()
  await expect(proof.locator('[data-protocol-trace]')).toHaveCount(6)
  await expect(proof.locator('[data-protocol-carrier="unicom"]')).toContainText('路径一致（非认证）')
  await expect(proof).toContainText('2026-07-25 11:00 UTC')
  const mobile = proof.locator('[data-protocol-carrier="mobile"] [data-protocol-trace="udp"]')
  await mobile.locator('summary').click()
  await expect(mobile.locator('table')).toContainText('* 隐藏跳')
  expect(state.writes).toEqual([])
})
test('TCP-only collection has no invented UDP result and GIA stays an unverified candidate', async ({ page }) => {
  await fixture(page, { single: true })
  const proof = await details(page)
  await expect(proof.locator('[data-protocol-trace="tcp"]')).toHaveCount(3)
  await expect(proof.locator('[data-protocol-trace="udp"]')).toHaveCount(0)
  await expect(node(page)).toHaveCount(0)
  await expect(proof.locator('[data-protocol-carrier="telecom"]')).toContainText('GIA 候选，未认证')
  await expect(proof.locator('[data-protocol-carrier="mobile"]')).toContainText('仅 IP 前缀，非 ASN')
})
test('TCP permission failure is retained separately instead of promoting successful UDP', async ({ page }) => {
  await fixture(page, { denied: true })
  await expect(node(page)).toHaveCount(0)
  const proof = await details(page)
  await expect(proof.locator('[data-protocol-carrier="telecom"] [data-protocol-trace="tcp"]')).toHaveAttribute('data-probe-status', 'permission-denied')
  await expect(proof.locator('[data-protocol-carrier="telecom"] [data-protocol-trace="udp"]')).toHaveAttribute('data-probe-status', 'ok')
})
test('UUID manual override survives reload despite disagreeing TCP/UDP evidence', async ({ page }) => {
  await fixture(page, { manual: true })
  const pill = node(page).locator('[data-return-carrier="telecom"]')
  await expect(pill).toHaveText('我的 手动线路')
  await expect(pill).toHaveAttribute('data-route-status', 'manual')
  await page.reload()
  await expect(pill).toHaveText('我的 手动线路')
  const proof = await details(page)
  await expect(proof.locator('[data-protocol-carrier="telecom"]')).toContainText('路径不同（未合并）')
})
test('guest never fetches or renders private protocol evidence', async ({ page }) => {
  const state = await fixture(page, { guest: true })
  await expect(node(page)).toHaveCount(0)
  await expect(page.locator('[data-protocol-evidence]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Enhanced 管理', exact: true })).toHaveCount(0)
  expect(state.reads).toBe(0)
  expect(state.writes).toEqual([])
  await expect(page.locator('body')).not.toContainText('59.43.2.1')
})
test('invalid raw protocol payload is rejected before DOM rendering', async ({ page }) => {
  await fixture(page, { invalid: true })
  await expect(node(page)).toHaveCount(0)
  await page.getByRole('button', { name: 'Enhanced 管理', exact: true }).click()
  await page.locator('[data-optional-companion] > summary').click()
  await expect(page.getByRole('dialog').locator('[data-enhanced-management]').getByRole('alert')).toContainText('协议异常')
  await expect(page.locator('[data-protocol-evidence]')).toHaveCount(0)
  expect(await page.evaluate(() => '__v2Pwned' in window)).toBe(false)
})
test('320px dark mini card keeps three simple pills and scroll-contained protocol details', async ({ page }, testInfo) => {
  await fixture(page, { narrow: true })
  // Historical title retained; simulated/unconfirmed results now stay off cards.
  await expect(node(page)).toHaveCount(0)
  const proof = await details(page)
  await proof.locator('[data-protocol-carrier="mobile"] [data-protocol-trace="tcp"] summary').click()
  await expect(page.locator('html')).toHaveJSProperty('scrollWidth', 320)
  const screenshot = testInfo.outputPath('v2-mini-dark-evidence.png')
  await page.screenshot({ path: screenshot })
  await testInfo.attach('v2-offline-evidence', { path: screenshot, contentType: 'image/png' })
})
