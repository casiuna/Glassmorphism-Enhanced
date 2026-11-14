// Explicit local HTTP/RPC fixtures, not claims of real server or traffic data.
import type { Page } from '@playwright/test'
import type { VisualFixtureOptions } from './fixtures/komari'
import { expect, test } from '@playwright/test'
import { formatBytesSplit, formatBytesWithConfig } from '../../src/utils/helper'
import { trafficPeriod } from '../../src/utils/trafficCycle'
import { installKomariFixture } from './fixtures/komari'

const A = '00000000-0000-4000-8000-000000000001'
const B = '00000000-0000-4000-8000-000000000002'
const GIB = 1024 ** 3
const NOW = '2026-11-12T04:00:00.000Z'
async function fixture(page: Page, options: { configured?: boolean, dark?: boolean, size?: string, missing?: boolean, mode?: VisualFixtureOptions['trafficLimitType'], guest?: boolean, largeLifetime?: boolean } = {}) {
  const state = {
    settings: { themeMode: options.dark ? 'dark' : 'light', hideEarth: true, hideGeneralCard: true, visitorInfoEnabled: false, rpcTransportMode: 'http', disablePageAnimation: true, nodeCardSize: options.size ?? 'compact', transitCarrierPingRules: 'PRESERVE_RELAY', displayCurrency: 'SGD', unknownFuture: { untouched: true }, trafficCycleConfig: JSON.stringify({ version: 1, timeZone: 'Asia/Shanghai', nodes: options.configured === false ? {} : { [A]: { resetDay: 18 }, [B]: { resetDay: 5 } } }), returnRoutesVisible: true, returnRouteConfig: JSON.stringify({ version: 1, nodes: { [A]: { manual: { unicom: { label: '10099', updatedAt: NOW }, telecom: { label: 'CN2GIA', updatedAt: NOW }, mobile: { label: 'CMI2', updatedAt: NOW } }, auto: {} } } }) } as Record<string, unknown>,
    writes: [] as Record<string, unknown>[],
    queries: [] as Record<string, unknown>[],
    missing: options.missing ?? false,
    failAfterCommit: false,
    loggedIn: !options.guest,
  }
  await installKomariFixture(page, { themeShort: 'Enhanced', loggedIn: !options.guest, dark: options.dark, hideEarth: true, firstNodeName: 'Wendy', userTags: 'CN2GIA<blue>;10099<red>;长标签用于截断与悬停完整展示abcdefghijklmnopqrstuvwxyz', trafficNow: NOW, trafficLimitType: options.mode, themeSettings: state.settings, noPingTasks: true, largeLifetimeTraffic: options.largeLifetime, ...(options.largeLifetime ? { trafficFirstNode: { traffic_limit: 1024 * GIB }, detailMetricCardKeys: ['totalTraffic', 'trafficQuota'] } : {}) })
  const pub = () => ({ allow_cors: false, custom_body: '', custom_head: '', description: 'EXPLICIT LOCAL TRAFFIC CYCLE MOCK', disable_password_login: false, oauth_enable: false, oauth_provider: '', private_site: false, record_enabled: true, record_preserve_time: 1080, ping_record_preserve_time: 720, sitename: 'Komari Visual Lab', theme: 'Enhanced', theme_settings: state.settings })
  await page.route('**/api/me', route => route.fulfill({ json: { logged_in: state.loggedIn, username: state.loggedIn ? 'isolated-admin' : '' } }))
  await page.route('**/api/public', route => route.fulfill({ json: { status: 'success', data: pub() } }))
  await page.route('**/api/admin/theme/list', route => route.fulfill({ json: { status: 'success', data: [{ short: 'Enhanced', version: '1.2.1' }] } }))
  await page.route('**/api/admin/theme/settings?theme=Enhanced', async (route) => {
    expect(route.request().method()).toBe('POST')
    const next = route.request().postDataJSON()
    state.writes.push(next)
    state.settings = next
    if (state.failAfterCommit) {
      state.failAfterCommit = false
      return route.fulfill({ status: 503, json: { error: 'EXPLICIT AFTER-COMMIT FAILURE' } })
    }
    return route.fulfill({ json: { status: 'success', message: '' } })
  })
  await page.route('**/api/rpc2', async (route) => {
    const data = route.request().postDataJSON()
    const reply = (value: unknown) => route.fulfill({ json: { jsonrpc: '2.0', id: data.id, result: value } })
    if (data.method === 'public:getPublicSettings')
      return reply(pub())
    if (data.method === 'public:getVersion')
      return reply({ version: '1.6.0', hash: 'LOCAL MOCK' })
    if (data.method === 'public:getMe')
      return reply({ logged_in: state.loggedIn })
    if (data.method === 'admin:listPlugins')
      return reply([])
    if (data.method !== 'public:queryMetrics' || !data.params?.aggregation_by_metric?.['traffic.up'])
      return route.fallback()
    const params = data.params as Record<string, unknown>
    state.queries.push(structuredClone(params))
    expect(params.fill_empty).toBe(false)
    expect(params.aggregation_by_metric).toEqual({ 'traffic.up': 'sum', 'traffic.down': 'sum', 'net.total.up': 'last', 'net.total.down': 'last' })
    const uuid = String(params.entity_id)
    const day = JSON.parse(String(state.settings.trafficCycleConfig)).nodes[uuid]?.resetDay
    if (!day)
      return reply({ series: [] })
    const end = Date.parse(String(params.end)) + 1
    const period = trafficPeriod(day, end)
    expect(Date.parse(String(params.start))).toBe(period.start - 3600000)
    const timestamps = new Set([period.start, period.start + 1000, end - 2000, end - 1000])
    const history = new Set(timestamps)
    for (let time = period.start + 3600000; time < end; time += 3600000)
      history.add(time)
    return reply({ start: params.start, end: params.end, series: (params.metric_keys as string[]).map(key => ({ metric_key: key, entity_id: uuid, downsampled: false, points: key.startsWith('net.total.') ? [{ time: new Date(state.missing ? end - 1000 : period.start - 1000).toISOString(), value: 1000 * GIB, count: 1 }] : Array.from(history, time => ({ time: new Date(time).toISOString(), value: timestamps.has(time) ? (key === 'traffic.up' ? 30 : 50) * GIB : 0, count: 1 })) })) })
  })
  return state
}
async function openNodes(page: Page) {
  await page.getByRole('button', { name: 'Enhanced 管理', exact: true }).click()
  await page.getByRole('tab', { name: '节点与卡片', exact: true }).click()
  await expect(page.locator('[data-traffic-cycle-manager]')).toBeVisible()
}
function card(page: Page) {
  return page.getByRole('button', { name: '查看节点 Wendy 详情', exact: true })
}
for (const size of ['mini', 'compact', 'comfortable', 'large']) {
  for (const width of [390, 1440]) {
    for (const dark of [false, true]) {
      test(`centered tags / CU-CT-CM / cycle with no countdown ${size} ${width} ${dark ? 'dark' : 'light'}`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: 900 })
        await fixture(page, { dark, size })
        await page.goto('/')
        const node = card(page)
        await expect(node.locator('[data-machine-traffic]')).toContainText('320')
        await expect(node).not.toContainText(/距离重置|下次重置|重置倒计时|距重置/)
        await expect(node.locator('[data-machine-traffic]')).not.toContainText(/2026-11/)
        const tags = node.locator('[data-node-user-tag]')
        expect(await tags.count()).toBe(3)
        for (const tag of await tags.all()) {
          const layout = await tag.evaluate((el) => {
            const css = getComputedStyle(el)
            const box = el.getBoundingClientRect()
            const text = el.firstElementChild!.getBoundingClientRect()
            return { align: css.alignItems, justify: css.justifyContent, h: box.height, dx: Math.abs((text.left + text.right - box.left - box.right) / 2), dy: Math.abs((text.top + text.bottom - box.top - box.bottom) / 2), title: el.getAttribute('title') }
          })
          expect(layout).toMatchObject({ align: 'center', justify: 'center', h: 20 })
          expect(layout.dx).toBeLessThanOrEqual(1)
          expect(layout.dy).toBeLessThanOrEqual(1)
          expect(layout.title).toBeTruthy()
        }
        const routes = node.locator('[data-return-carrier]')
        expect(await routes.evaluateAll(els => els.map(el => el.getAttribute('data-return-carrier')))).toEqual(['unicom', 'telecom', 'mobile'])
        // New user-approved contract: color is confined to tiny markers,
        // not large pills or colored route text. Traffic assertions stay intact.
        await expect(routes.nth(0).locator('[data-carrier-marker]')).toHaveClass(/bg-red-/)
        await expect(routes.nth(1).locator('[data-carrier-marker]')).toHaveClass(/bg-blue-/)
        await expect(routes.nth(2).locator('[data-carrier-marker]')).toHaveClass(/bg-green-/)
        expect(await routes.evaluateAll(els => els.every((el) => {
          const css = getComputedStyle(el)
          return css.backgroundColor === 'rgba(0, 0, 0, 0)' && Number.parseFloat(css.borderTopWidth) === 0
        }))).toBe(true)
        const boxes = await routes.evaluateAll(els => els.map((el) => {
          const r = el.getBoundingClientRect()
          return { y: r.y, h: r.height, w: r.width }
        }))
        expect(new Set(boxes.map(b => b.y)).size).toBe(1)
        expect(boxes.every(b => b.h === 16 && b.w > 0)).toBeTruthy()
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
        const before = await node.boundingBox()
        await page.getByRole('button', { name: 'Enhanced 管理', exact: true }).click()
        await page.getByRole('tab', { name: '节点与卡片', exact: true }).click()
        const row = page.locator(`[data-traffic-cycle-node="${A}"]`)
        await row.locator('select').selectOption('25')
        await row.getByRole('button', { name: '保存 Wendy 流量周期' }).click()
        await expect(row.getByRole('status')).toContainText('已保存并读回')
        await page.getByRole('button', { name: '关闭', exact: true }).click()
        await expect(node.locator('[data-machine-traffic]')).toContainText('320')
        expect((await node.boundingBox())!.height).toBe(before!.height)
        await page.screenshot({ path: testInfo.outputPath('v121-cards.png'), fullPage: true })
      })
    }
  }
}
for (const [mode, expected] of [['up', '120'], ['down', '200'], ['min', '120'], ['max', '200'], ['sum', '320']] as const) {
  test(`cycle UI keeps original ${mode} quota definition`, async ({ page }) => {
    const state = await fixture(page, { mode, largeLifetime: true })
    const used = Number(expected) * GIB
    const remaining = 1024 * GIB - used
    const percentage = used / (1024 * GIB) * 100
    const assertQuota = async (locator: ReturnType<Page['locator']>) => {
      await expect(locator).toHaveAttribute('data-traffic-basis', 'billing-cycle')
      await expect(locator).toHaveAttribute('data-traffic-used', String(used))
      await expect(locator).toHaveAttribute('data-traffic-remaining', String(remaining))
      await expect(locator).toHaveAttribute('data-traffic-percentage', String(percentage))
      await expect(locator).toContainText(formatBytesWithConfig(used))
    }
    await page.goto('/')
    await assertQuota(card(page).locator('[data-machine-traffic]'))
    await expect(card(page).locator('[data-machine-direction="up"]')).toContainText(formatBytesWithConfig(120 * GIB))
    await expect(card(page).locator('[data-machine-direction="down"]')).toContainText(formatBytesWithConfig(200 * GIB))
    await expect(card(page)).not.toContainText(/距离重置|下次重置|重置倒计时|距重置/)
    await page.getByRole('button', { name: '列表视图', exact: true }).click()
    await assertQuota(card(page).locator('[data-machine-traffic]'))
    await expect(card(page).locator('[data-machine-traffic]')).toContainText(`${percentage.toFixed(1)}%`)
    expect(await card(page).locator('.traffic-progress__fill').count()).toBe(mode === 'sum' ? 2 : 1)
    await card(page).click()
    const detail = page.locator('.instance-detail')
    await assertQuota(detail.locator('[data-machine-traffic]'))
    await expect(detail.locator('[data-cycle-direction="up"]')).toContainText(formatBytesWithConfig(120 * GIB))
    await expect(detail.locator('[data-cycle-direction="down"]')).toContainText(formatBytesWithConfig(200 * GIB))
    await expect(detail.locator('[data-machine-direction="up"]')).toContainText(formatBytesWithConfig(100 * 1024 ** 4))
    await expect(detail.locator('[data-machine-direction="down"]')).toContainText(formatBytesWithConfig(200 * 1024 ** 4))
    await expect(detail.locator('[data-detail-metric="totalTraffic"]')).toContainText(formatBytesSplit(300 * 1024 ** 4).value)
    await expect(detail.locator('[data-detail-metric="trafficQuota"]')).toContainText(percentage.toFixed(1))
    await page.getByRole('button', { name: '返回首页', exact: true }).click()
    await openNodes(page)
    const row = page.locator(`[data-traffic-cycle-node="${A}"]`)
    await assertQuota(row.locator('[data-cycle-used]'))
    await expect(row.locator('[data-cycle-breakdown]')).toContainText(formatBytesWithConfig(120 * GIB))
    await expect(row.locator('[data-cycle-breakdown]')).toContainText(formatBytesWithConfig(200 * GIB))
    await expect(row.locator('[data-cycle-quota]')).toContainText(formatBytesWithConfig(remaining))
    await expect(row.locator('[data-cycle-quota]')).toContainText(`${percentage.toFixed(1)}%`)
    await page.getByRole('button', { name: '关闭', exact: true }).click()
    await page.getByRole('button', { name: '显示首页工具', exact: true }).click()
    await page.getByRole('button', { name: '对比：最多四台节点实时横向对比' }).click()
    await page.getByRole('button', { name: 'Wendy', exact: true }).click()
    await assertQuota(page.locator(`[data-compare-metric="trafficQuota"][data-node-uuid="${A}"]`))
    const cumulative = page.locator(`[data-compare-metric="traffic"][data-node-uuid="${A}"]`)
    await expect(cumulative).toContainText(formatBytesWithConfig(300 * 1024 ** 4))
    await expect(cumulative).toContainText(formatBytesWithConfig(100 * 1024 ** 4))
    await expect(cumulative).toContainText(formatBytesWithConfig(200 * 1024 ** 4))
    expect(state.writes).toEqual([])
  })
}
test('unset remains unset: raw totals allowed, no cycle/remaining/percentage fiction or requests', async ({ page }) => {
  const state = await fixture(page, { configured: false })
  await page.goto('/')
  await expect(card(page)).toContainText('累计流量')
  await expect(card(page).locator('[data-machine-traffic]')).toHaveAttribute('data-traffic-basis', 'machine-cumulative')
  expect(await card(page).locator('[data-machine-traffic]').getAttribute('data-traffic-remaining')).toBeNull()
  await expect(card(page).locator('[data-machine-traffic]')).toHaveAttribute('title', /累计参考.*不是周期配额/)
  await expect(card(page).locator('[data-machine-traffic]')).not.toContainText('320')
  expect(state.queries).toEqual([])
  await openNodes(page)
  const row = page.locator(`[data-traffic-cycle-node="${A}"]`)
  await expect(row.locator('select')).toHaveValue('')
  await expect(row.locator('[data-cycle-used]')).toHaveText('未设置')
  expect(state.writes).toEqual([])
})
test('missing start history is data-insufficient, not a made-up zero or lifetime quota', async ({ page }) => {
  await fixture(page, { missing: true })
  await page.goto('/')
  await expect(card(page).locator('[data-machine-traffic]')).toContainText('数据不足')
  await expect(card(page).locator('[data-machine-traffic]')).not.toContainText('0 GB')
  await openNodes(page)
  await expect(page.locator(`[data-traffic-cycle-node="${A}"] [data-cycle-used]`)).toHaveText('数据不足')
})
test('five tabs save/reload old settings and UUID dates, preserving other nodes and future fields', async ({ page }) => {
  const state = await fixture(page)
  await page.goto('/')
  await openNodes(page)
  const dialog = page.getByRole('dialog')
  expect(await dialog.getByRole('tab').allTextContents()).toEqual(['01 · 基础与首页', '02 · 节点与卡片', '03 · 线路与延迟', '04 · 外观与背景', '05 · 高级设置'])
  const b = page.locator(`[data-traffic-cycle-node="${B}"]`)
  await expect(b.locator('[data-cycle-used]')).toContainText('320')
  const oldB = JSON.parse(String(state.settings.trafficCycleConfig)).nodes[B]
  const a = page.locator(`[data-traffic-cycle-node="${A}"]`)
  await a.locator('select').selectOption('31')
  await a.getByRole('button', { name: '保存 Wendy 流量周期' }).click()
  await expect(a.getByRole('status')).toBeVisible()
  const newStart = new Date(trafficPeriod(31, Date.parse(NOW)).start - 3600000).toISOString()
  await expect.poll(() => state.queries.some(q => q.entity_id === A && q.start === newStart)).toBe(true)
  expect(JSON.parse(String(state.settings.trafficCycleConfig)).nodes[B]).toEqual(oldB)
  await expect(b.locator('[data-cycle-used]')).toContainText('320')
  for (const name of ['自定义重置日', '当前计费周期起止时间', '下次重置日期', '本周期已使用流量']) await expect(dialog).toContainText(name)
  await dialog.getByRole('tab', { name: '外观与背景', exact: true }).click()
  await dialog.getByRole('combobox', { name: '背景类型', exact: true }).selectOption('video')
  await dialog.getByRole('button', { name: '保存本分类设置' }).click()
  await expect(dialog.getByRole('status')).toContainText('已保存并读回')
  expect(state.settings.unknownFuture).toEqual({ untouched: true })
  expect(state.settings.displayCurrency).toBe('SGD')
  expect(state.settings.transitCarrierPingRules).toBe('PRESERVE_RELAY')
  expect(JSON.parse(String(state.settings.trafficCycleConfig)).nodes[A].resetDay).toBe(31)
  await page.reload()
  await openNodes(page)
  await expect(page.locator(`[data-traffic-cycle-node="${A}"] select`)).toHaveValue('31')
  await expect(page.locator(`[data-traffic-cycle-node="${B}"] select`)).toHaveValue('5')
  await dialog.getByRole('tab', { name: '外观与背景', exact: true }).click()
  await expect(dialog.getByRole('combobox', { name: '背景类型', exact: true })).toHaveValue('video')
})
test('native managed settings entry opens the same five-category node editor, not a JSON task', async ({ page }) => {
  await fixture(page)
  await page.goto('/admin/theme_managed')
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('tab', { name: '节点与卡片', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('[data-traffic-cycle-manager]')).toBeVisible()
  await expect(page.getByRole('textbox', { name: '流量周期（由逐节点管理界面保存）' })).toHaveCount(0)
})
test('expired admin cannot save per-node configuration', async ({ page }) => {
  const state = await fixture(page)
  await page.goto('/')
  await openNodes(page)
  const row = page.locator(`[data-traffic-cycle-node="${A}"]`)
  await row.locator('select').selectOption('25')
  state.loggedIn = false
  await row.getByRole('button', { name: '保存 Wendy 流量周期' }).click()
  await expect.poll(() => state.writes.length).toBe(0)
  expect(JSON.parse(String(state.settings.trafficCycleConfig)).nodes[A].resetDay).toBe(18)
})
test('transport failure after committed save is only accepted after exact readback', async ({ page }) => {
  const state = await fixture(page)
  await page.goto('/')
  await openNodes(page)
  state.failAfterCommit = true
  const row = page.locator(`[data-traffic-cycle-node="${A}"]`)
  await row.locator('select').selectOption('28')
  await row.getByRole('button', { name: '保存 Wendy 流量周期' }).click()
  await expect(row.getByRole('status')).toContainText('已保存并读回')
  expect(state.writes).toHaveLength(1)
})
