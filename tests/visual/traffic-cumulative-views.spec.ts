import type { Download, Page } from '@playwright/test'
import type { VisualFixtureOptions } from './fixtures/komari'
import { expect, test } from '@playwright/test'
import { formatBytesSplit, formatBytesWithConfig } from '../../src/utils/helper'
import { installKomariFixture } from './fixtures/komari'

const UUID = '00000000-0000-4000-8000-000000000001'
const GIB = 1024 ** 3
const TIB = 1024 ** 4
const UP = 100 * TIB
const DOWN = 200 * TIB
const TOTAL = UP + DOWN
const modes = [['up', UP], ['down', DOWN], ['min', UP], ['max', DOWN], ['sum', TOTAL]] as const

function card(page: Page, name = '主控-洛杉矶') {
  return page.getByRole('button', { name: `查看节点 ${name} 详情`, exact: true })
}

function watchTrafficQueries(page: Page) {
  const calls: unknown[] = []
  page.on('request', (request) => {
    if (!request.url().endsWith('/rpc2'))
      return
    const payload = request.postDataJSON() as { method?: string, params?: { aggregation?: string, metric_keys?: string[] } }
    if (payload.method === 'public:queryMetrics' && payload.params?.aggregation === 'sum' && payload.params.metric_keys?.some(key => key === 'traffic.up' || key === 'traffic.down'))
      calls.push(payload)
  })
  return calls
}

async function install(page: Page, options: VisualFixtureOptions = {}) {
  await installKomariFixture(page, {
    hideEarth: true,
    largeLifetimeTraffic: true,
    generalCardKeys: ['totalTraffic'],
    detailMetricCardKeys: ['totalTraffic', 'trafficQuota'],
    ...options,
  })
}

async function openTools(page: Page) {
  await page.getByRole('button', { name: '显示首页工具', exact: true }).click()
}

async function downloadText(download: Download): Promise<string> {
  const stream = await download.createReadStream()
  expect(stream).not.toBeNull()
  stream!.setEncoding('utf8')
  let content = ''
  for await (const chunk of stream!)
    content += chunk
  return content
}

for (const [mode, used] of modes) {
  test(`cumulative ${mode}: cards, list, detail and comparison agree without monthly queries`, async ({ page }) => {
    const calls = watchTrafficQueries(page)
    await install(page, { trafficLimitType: mode, trafficFirstNode: { traffic_limit: 1000 * TIB } })
    await page.goto('/')
    await expect(card(page).locator('[data-machine-traffic]')).toContainText(formatBytesWithConfig(used))
    await expect(card(page).locator('[data-machine-direction="up"]')).toContainText(formatBytesWithConfig(UP))
    await expect(card(page).locator('[data-machine-direction="down"]')).toContainText(formatBytesWithConfig(DOWN))
    // A second card guards against first-node-only or shared-state substitutions.
    const secondUsed = mode === 'up' || mode === 'min' ? 90 * GIB : mode === 'sum' ? 214 * GIB : 124 * GIB
    await expect(card(page, '香港边缘节点-超长名称布局测试').locator('[data-machine-traffic]')).toContainText(formatBytesWithConfig(secondUsed))
    await page.getByRole('button', { name: '列表视图', exact: true }).click()
    const row = card(page).locator('[data-machine-traffic]')
    await expect(row).toContainText(formatBytesWithConfig(used))
    await expect(row).toContainText(`${(used / (1000 * TIB) * 100).toFixed(1)}%`)
    expect(await row.locator('.traffic-progress__fill').count()).toBe(mode === 'sum' ? 2 : 1)
    await card(page).click()
    const detail = page.locator('.instance-detail')
    await expect(detail.locator('[data-machine-traffic]')).toContainText(formatBytesWithConfig(used))
    await expect(detail.locator('[data-machine-direction="up"]')).toContainText(formatBytesWithConfig(UP))
    await expect(detail.locator('[data-machine-direction="down"]')).toContainText(formatBytesWithConfig(DOWN))
    await expect(detail.locator('[data-detail-metric="totalTraffic"]')).toContainText(formatBytesSplit(TOTAL).value)
    await expect(detail.locator('[data-detail-metric="trafficQuota"]')).toContainText((used / (1000 * TIB) * 100).toFixed(1))
    await page.getByRole('button', { name: '返回首页', exact: true }).click()
    await openTools(page)
    await page.getByRole('button', { name: '对比：最多四台节点实时横向对比' }).click()
    await page.getByRole('button', { name: '主控-洛杉矶', exact: true }).click()
    const comparison = page.locator(`[data-compare-metric="traffic"][data-node-uuid="${UUID}"]`)
    await expect(comparison).toContainText(formatBytesWithConfig(TOTAL))
    await expect(comparison).toContainText(formatBytesWithConfig(UP))
    await expect(comparison).toContainText(formatBytesWithConfig(DOWN))
    await expect(page.locator(`[data-compare-metric="trafficQuota"][data-node-uuid="${UUID}"]`)).toContainText(formatBytesWithConfig(used))
    expect(calls).toEqual([])
  })
}

test('home aggregate sums all machine counters, including unlimited and offline nodes', async ({ page }) => {
  const calls = watchTrafficQueries(page)
  await install(page, { trafficFirstNode: { traffic_limit: 0, billing_cycle: -1, expired_at: '' } })
  await page.goto('/')
  await expect(card(page).locator('[data-machine-traffic]')).toContainText(formatBytesWithConfig(TOTAL))
  await expect(card(page).locator('[data-machine-traffic]')).toContainText('∞')
  const otherNodes = Array.from({ length: 11 }, (_, offset) => {
    const index = offset + 1
    return (index + 1) * 45 * GIB + (index === 6 ? 1.78 * TIB : (index + 1) * 62 * GIB)
  }).reduce((sum, value) => sum + value, 0)
  const expected = formatBytesSplit(TOTAL + otherNodes)
  const aggregate = page.locator('[data-general-card-key="totalTraffic"]')
  await expect(aggregate).toContainText('总流量')
  await expect(aggregate).toContainText(expected.value)
  await expect(aggregate).toContainText(expected.unit)
  await expect(aggregate).not.toContainText('待核对')
  expect(calls).toEqual([])
})

for (const quota of [0, 1000 * TIB]) {
  test(`JSON and CSV preserve cumulative counters and non-billing scope, quota=${quota}`, async ({ page }) => {
    const calls = watchTrafficQueries(page)
    await install(page, { loggedIn: true, trafficFirstNode: { traffic_limit: quota } })
    await page.goto('/')
    await expect(card(page).locator('[data-machine-traffic]')).toContainText(formatBytesWithConfig(TOTAL))
    await openTools(page)
    await page.getByRole('button', { name: '导出：CSV / JSON 数据快照' }).click()
    let pending = page.waitForEvent('download')
    await page.getByRole('button', { name: '导出 JSON', exact: true }).click()
    const exported = JSON.parse(await downloadText(await pending))
    const first = exported.nodes.find((item: { id: string }) => item.id === UUID)
    expect(first.resources.traffic).toMatchObject({
      status: 'machine-cumulative',
      scope: 'machine-cumulative-not-provider-bill',
      basis: 'sum',
      usedBytes: TOTAL,
      usage: quota > 0 ? '30.0%' : '无限制',
    })
    pending = page.waitForEvent('download')
    await page.getByRole('button', { name: '导出 CSV', exact: true }).click()
    const csv = await downloadText(await pending)
    expect(csv).toContain('流量')
    expect(csv).toContain('machine-cumulative')
    expect(csv).toContain(formatBytesWithConfig(TOTAL))
    expect(csv).not.toContain('collected-monthly')
    expect(csv).not.toContain('待核对')
    expect(calls).toEqual([])
  })
}
