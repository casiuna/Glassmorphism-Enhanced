import type { Page } from '@playwright/test'
import type { VisualFixtureOptions } from './fixtures/komari'
import { expect, test } from '@playwright/test'
import { formatBytesSplit, formatBytesWithConfig } from '../../src/utils/helper'
import { combineMonthlyTraffic } from '../../src/utils/monthlyTraffic'
import { installKomariFixture } from './fixtures/komari'

const UUID = '00000000-0000-4000-8000-000000000001'
const GIB = 1024 ** 3
const TIB = 1024 ** 4
const TOTAL = combineMonthlyTraffic(45 * GIB, 62 * GIB, 'sum')!
const UP = formatBytesWithConfig(45 * GIB)
const DOWN = formatBytesWithConfig(62 * GIB)

async function install(page: Page, options: VisualFixtureOptions = {}) {
  await installKomariFixture(page, {
    hideEarth: true,
    largeLifetimeTraffic: true,
    detailMetricCardKeys: ['totalTraffic', 'trafficQuota'],
    ...options,
  })
}

function homeCard(page: Page) {
  return page.getByRole('button', { name: '查看节点 主控-洛杉矶 详情', exact: true })
}

async function openCompare(page: Page) {
  await page.getByRole('button', { name: '显示首页工具', exact: true }).click()
  await page.getByRole('button', { name: '对比：最多四台节点实时横向对比' }).click()
  await page.getByRole('button', { name: '主控-洛杉矶', exact: true }).click()
  return {
    traffic: page.locator(`[data-compare-metric="traffic"][data-node-uuid="${UUID}"]`),
    quota: page.locator(`[data-compare-metric="trafficQuota"][data-node-uuid="${UUID}"]`),
  }
}

for (const billingCycle of [30, 365]) {
  for (const quota of [0, null, 20 * TIB]) {
    test(`monthly views ready ${billingCycle}/${quota} match home deltas, not lifetime counters`, async ({ page }) => {
      const monthlyCalls: Array<Record<string, unknown>> = []
      page.on('request', (request) => {
        if (!request.url().endsWith('/rpc2'))
          return
        const payload = request.postDataJSON() as { method?: string, params?: Record<string, unknown> }
        if (payload.method === 'public:queryMetrics' && payload.params?.aggregation === 'sum')
          monthlyCalls.push(payload.params)
      })
      await install(page, { trafficFirstNode: { billing_cycle: billingCycle, traffic_limit: quota } })
      await page.goto('/')
      await expect(homeCard(page).locator('[data-monthly-direction="up"]')).toContainText(UP)
      await homeCard(page).click()
      const detail = page.locator('.instance-detail')
      await expect(detail.locator('[data-monthly-traffic]')).toContainText(formatBytesWithConfig(TOTAL))
      await expect(detail.locator('[data-monthly-direction="up"]')).toContainText(UP)
      await expect(detail.locator('[data-monthly-direction="down"]')).toContainText(DOWN)
      const totalCard = detail.locator('[data-detail-metric="totalTraffic"]')
      await expect(totalCard).toContainText('本月累计')
      await expect(totalCard).toContainText(formatBytesSplit(TOTAL).value)
      await expect(totalCard).not.toContainText('300.00')
      const quotaCard = detail.locator('[data-detail-metric="trafficQuota"]')
      if (quota === null || quota === 0) {
        await expect(detail.locator('[data-monthly-traffic]')).toContainText('∞')
        await expect(quotaCard).toContainText('∞')
        await expect(detail.locator('[data-monthly-progress]')).toHaveCount(0)
      }
      else {
        await expect(quotaCard).toContainText((TOTAL / quota * 100).toFixed(1))
        await expect(detail.locator('[data-monthly-progress]')).toHaveCount(1)
      }
      expect(monthlyCalls.every(params => params.start === '2026-07-25T00:00:00.000Z' || params.start === '2026-07-02T00:00:00.000Z')).toBe(true)
      await page.getByRole('button', { name: '返回首页', exact: true }).click()
      const compare = await openCompare(page)
      await expect(compare.traffic).toContainText(formatBytesWithConfig(TOTAL))
      await expect(compare.traffic).toContainText(UP)
      await expect(compare.traffic).toContainText(DOWN)
      await expect(compare.traffic).not.toContainText('100.00 TB')
      await expect(compare.traffic).not.toContainText('200.00 TB')
      await expect(compare.quota).toContainText(formatBytesWithConfig(TOTAL))
      if (quota === null || quota === 0) {
        await expect(compare.quota).toContainText('∞')
        await expect(compare.quota.locator('[data-monthly-progress]')).toHaveCount(0)
      }
      else {
        await expect(compare.quota).toContainText(formatBytesWithConfig(quota))
        await expect(compare.quota.locator('[data-monthly-progress]')).toHaveCount(1)
      }
    })
  }
}

const uncertain: Array<{ name: string, options: VisualFixtureOptions }> = [
  { name: 'partial', options: { trafficMetricPeriodicGapNode: 0 } },
  { name: 'unknown-unlimited', options: { trafficMetricUnavailable: true, trafficFirstNode: { traffic_limit: 0 } } },
  { name: 'missing-renewal', options: { trafficFirstNode: { expired_at: '', traffic_limit: 0 } } },
  { name: 'one-off', options: { trafficFirstNode: { billing_cycle: -1, traffic_limit: 0 } } },
  { name: 'custom-cycle', options: { trafficFirstNode: { billing_cycle: 45 } } },
]
for (const { name, options } of uncertain) {
  test(`monthly views ${name} keep totals, directions and quota progress unverified`, async ({ page }) => {
    await install(page, options)
    await page.goto('/')
    await expect(homeCard(page).locator('[data-monthly-traffic]')).not.toHaveAttribute('data-status', 'loading')
    await homeCard(page).click()
    const detail = page.locator('.instance-detail')
    await expect(detail.locator('[data-monthly-traffic]')).toContainText('待核对')
    await expect(detail.locator('[data-monthly-direction="up"]')).toContainText('待核对')
    await expect(detail.locator('[data-monthly-direction="down"]')).toContainText('待核对')
    await expect(detail.locator('[data-detail-metric="totalTraffic"]')).toContainText('待核对')
    await expect(detail.locator('[data-detail-metric="trafficQuota"]')).toContainText('待核对')
    await expect(detail.locator('[data-monthly-progress]')).toHaveCount(0)
    await page.getByRole('button', { name: '返回首页', exact: true }).click()
    const compare = await openCompare(page)
    await expect(compare.traffic).toContainText('待核对')
    await expect(compare.quota).toContainText('待核对')
    await expect(compare.traffic).not.toContainText(UP)
    await expect(compare.traffic).not.toContainText('100.00 TB')
    await expect(compare.quota.locator('[data-monthly-progress]')).toHaveCount(0)
  })
}

test('monthly views verified zero stays zero and is not confused with missing data', async ({ page }) => {
  await install(page, { trafficMetricZeroNode: 0 })
  await page.goto(`/instance/${UUID}`)
  const detail = page.locator('.instance-detail')
  await expect(detail.locator('[data-monthly-traffic]')).toHaveAttribute('data-status', 'ready')
  await expect(detail.locator('[data-monthly-direction="up"]')).toContainText('0 B')
  await expect(detail.locator('[data-monthly-direction="down"]')).toContainText('0 B')
  await expect(detail.locator('[data-detail-metric="totalTraffic"]')).toContainText('0')
  await expect(detail.locator('[data-detail-metric="totalTraffic"]')).not.toContainText('待核对')
  await expect(detail.locator('[data-monthly-progress]')).toHaveCount(1)
  await page.getByRole('button', { name: '返回首页', exact: true }).click()
  const compare = await openCompare(page)
  await expect(compare.traffic).toContainText('0 B')
  await expect(compare.traffic).not.toContainText('待核对')
  await expect(compare.quota).toContainText('0 B')
  await expect(compare.quota.locator('[data-monthly-progress]')).toHaveCount(1)
})

test('monthly views direction-only quota never promotes a missing opposite direction into total use', async ({ page }) => {
  await install(page, { trafficLimitType: 'up', trafficMetricMissingSide: 'traffic.down' })
  await page.goto(`/instance/${UUID}`)
  const detail = page.locator('.instance-detail')
  await expect(detail.locator('[data-monthly-traffic]')).toHaveAttribute('data-status', 'ready')
  await expect(detail.locator('[data-monthly-traffic]')).toContainText(UP)
  await expect(detail.locator('[data-monthly-direction="up"]')).toContainText(UP)
  await expect(detail.locator('[data-monthly-direction="down"]')).toContainText('待核对')
  await expect(detail.locator('[data-detail-metric="totalTraffic"]')).toContainText('待核对')
  await expect(detail.locator('[data-monthly-progress]')).toHaveCount(1)
  await page.getByRole('button', { name: '返回首页', exact: true }).click()
  const compare = await openCompare(page)
  await expect(compare.traffic).toContainText('待核对')
  await expect(compare.traffic).toContainText(UP)
  await expect(compare.quota).toContainText(UP)
  await expect(compare.quota.locator('[data-monthly-progress]')).toHaveCount(1)
})

test('monthly views loading cannot flash lifetime totals or a quota percentage', async ({ page }) => {
  await install(page)
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/rpc2', async (route) => {
    const payload = route.request().postDataJSON() as { method?: string, params?: Record<string, unknown> }
    if (payload.method === 'public:queryMetrics' && payload.params?.aggregation === 'sum')
      await gate
    await route.fallback()
  })
  try {
    await page.goto(`/instance/${UUID}`)
    const detail = page.locator('.instance-detail')
    await expect(detail.locator('[data-monthly-traffic]')).toHaveAttribute('data-status', 'loading')
    await expect(detail.locator('[data-monthly-direction="up"]')).toContainText('待核对')
    await expect(detail.locator('[data-monthly-direction="down"]')).toContainText('待核对')
    await expect(detail.locator('[data-detail-metric="totalTraffic"]')).toContainText('待核对')
    await expect(detail.locator('[data-detail-metric="trafficQuota"]')).toContainText('待核对')
    await expect(detail.locator('[data-monthly-progress]')).toHaveCount(0)
    await page.getByRole('button', { name: '返回首页', exact: true }).click()
    const compare = await openCompare(page)
    await expect(compare.traffic).toContainText('待核对')
    await expect(compare.quota).toContainText('待核对')
    await expect(compare.quota.locator('[data-monthly-progress]')).toHaveCount(0)
    release()
    await expect(compare.traffic).toContainText(formatBytesWithConfig(TOTAL))
    await expect(compare.quota.locator('[data-monthly-progress]')).toHaveCount(1)
  }
  finally {
    release()
  }
})
