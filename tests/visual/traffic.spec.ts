import type { Page } from '@playwright/test'
import type { NodeData, TrafficLimitType } from '../../src/stores/nodes'
import type { MetricQueryResponse, StatusRecord } from '../../src/utils/rpc'
import { expect, test } from '@playwright/test'
import { hasMonthlyTrafficCycleChanged, MONTHLY_TRAFFIC_REFRESH_INTERVAL_MS } from '../../src/composables/useMonthlyTrafficUsage'
import { normalizeStatusRecord } from '../../src/services/history.service'
import { historyMonthlyTraffic, metricMonthlyTraffic, MONTHLY_TRAFFIC_CACHE_TTL_MS, unavailableMonthlyTraffic } from '../../src/services/traffic.service'
import * as financeHelper from '../../src/utils/financeHelper'
import { formatBytesSplit } from '../../src/utils/helper'
import { analyzeTrafficSeries, combineMonthlyTraffic } from '../../src/utils/monthlyTraffic'
import { isTrafficWarningNode } from '../../src/utils/nodeMetricsHelper'
import { getMonthlyTrafficCycle } from '../../src/utils/trafficCycle'
import { installKomariFixture } from './fixtures/komari'

const GIB = 1024 ** 3
const TIB = 1024 ** 4
const UUID = '00000000-0000-4000-8000-000000000001'
function node(overrides: Partial<NodeData> = {}): NodeData {
  return { uuid: UUID, billing_cycle: 365, expired_at: '2027-07-25T18:30:00Z', traffic_limit: 20 * TIB, traffic_limit_type: 'sum', net_total_up: 100 * TIB, net_total_down: 200 * TIB, ...overrides } as NodeData
}
const start = new Date('2026-07-25T00:00:00Z')
const end = new Date('2026-07-25T02:00:00Z')
function response(up = 10, down = 30): MetricQueryResponse {
  return { start: start.toISOString(), end: end.toISOString(), count: 2, series: ['traffic.up', 'traffic.down'].map((key, i) => ({
    metric_key: key,
    entity_id: UUID,
    downsampled: true,
    downsample_algorithm: 'sum',
    interval_seconds: 3600,
    count: 2,
    points: [0, 1].map(hour => ({ time: new Date(start.getTime() + hour * 3600_000).toISOString(), value: (i ? down : up) / 2, count: 1 })),
  })) }
}
function usage(r: MetricQueryResponse, mode: TrafficLimitType = 'sum') {
  const n = node({ traffic_limit_type: mode })
  return metricMonthlyTraffic(n, getMonthlyTrafficCycle(n, end)!, end, r)
}

test('currency normalization and user-selected metered estimate remain separate', () => {
  for (const [value, expected] of [['SGD', 'SGD'], ['S$', 'SGD'], ['C$', 'CAD'], ['$', 'USD']])
    expect(financeHelper.normalizeCurrency(value!)).toBe(expected)
  expect(financeHelper.normalizeCurrency('S$ per month')).toBe('CNY')
  const estimate = financeHelper.calculateMeteredEstimate(node(), { currency: 'USD', trafficMode: 'down', trafficRate: 1, timeRate: 0, manualHours: 0, oneTimeFee: 0 })
  expect(estimate.trafficBytes).toBe(200 * TIB)
})

for (const duration of [30, 90, 365]) {
  test(`billing duration ${duration} still uses a monthly UTC window`, () => {
    expect(getMonthlyTrafficCycle(node({ billing_cycle: duration }), new Date('2026-08-01T12:00:00Z'))).toMatchObject({ start: new Date('2026-07-25T00:00:00Z'), end: new Date('2026-08-25T00:00:00Z') })
  })
}
for (const day of [29, 30, 31]) {
  test(`renewal day ${day} clamps February and restores March`, () => {
    const n = node({ expired_at: `2027-01-${day}T18:30:00Z` })
    expect(getMonthlyTrafficCycle(n, new Date('2027-02-28T00:00:00Z'))).toMatchObject({ start: new Date('2027-02-28T00:00:00Z'), end: new Date(`2027-03-${day}T00:00:00Z`) })
    expect(getMonthlyTrafficCycle(n, new Date(`2027-03-${day}T00:00:00Z`))?.key).toBe(`2027-03-${day}`)
  })
}
test('leap February and year boundary remain deterministic', () => {
  expect(getMonthlyTrafficCycle(node({ expired_at: '2024-01-31' }), new Date('2024-02-29T12:00:00Z'))?.key).toBe('2024-02-29')
  expect(getMonthlyTrafficCycle(node({ expired_at: '2026-12-31' }), new Date('2027-01-01T00:00:00Z'))?.key).toBe('2026-12-31')
})
test('one-off/custom/missing renewal metadata never invents a month or legacy quota', () => {
  for (const partial of [{ billing_cycle: -1 }, { billing_cycle: 45 }, { billing_cycle: 0 }, { expired_at: '' }, { expired_at: 'invalid' }, { billing_cycle: -1, traffic_limit: 0 }, { billing_cycle: 45, traffic_limit: 0 }, { expired_at: '', traffic_limit: 0 }]) {
    const n = node(partial)
    const cycle = getMonthlyTrafficCycle(n, end)
    expect(cycle).toBeNull()
    expect(unavailableMonthlyTraffic(n, cycle)).toMatchObject({ status: 'not-applicable', used: null, percentage: null })
  }
})
test('clock detects boundaries but refresh/cache remain 5/10 minutes', () => {
  expect(MONTHLY_TRAFFIC_REFRESH_INTERVAL_MS).toBe(5 * 60_000)
  expect(MONTHLY_TRAFFIC_CACHE_TTL_MS).toBe(10 * 60_000)
  expect(hasMonthlyTrafficCycleChanged(undefined, 'same')).toBe(false)
  expect(hasMonthlyTrafficCycleChanged('same', 'same')).toBe(false)
  expect(hasMonthlyTrafficCycleChanged('old', 'new')).toBe(true)
})

for (const [mode, expected] of [['up', 10], ['down', 30], ['min', 10], ['max', 30], ['sum', 40]] as const) {
  test(`configured ${mode} combines period totals, not per-bucket min/max`, () => {
    expect(combineMonthlyTraffic(10, 30, mode)).toBe(expected)
    expect(usage(response(), mode)).toMatchObject({ status: 'ready', used: expected, up: 10, down: 30 })
    const crossed = response(20, 20)
    crossed.series[0]!.points[0]!.value = 20
    crossed.series[0]!.points[1]!.value = 0
    crossed.series[1]!.points[0]!.value = 0
    crossed.series[1]!.points[1]!.value = 20
    if (mode === 'min' || mode === 'max')
      expect(usage(crossed, mode).used).toBe(20)
  })
}
for (const side of ['traffic.up', 'traffic.down']) {
  test(`missing ${side} cannot become zero; direction-only mode requires only its side`, () => {
    const r = response()
    r.series = r.series.filter(s => s.metric_key !== side)
    for (const mode of ['sum', 'max', 'min'] as const)
      expect(usage(r, mode)).toMatchObject({ status: 'partial', used: null, percentage: null })
    expect(usage(r, side === 'traffic.up' ? 'down' : 'up').status).toBe('ready')
  })
}
test('valid zero buckets with positive observation counts are genuine data', () => {
  expect(usage(response(0, 0))).toMatchObject({ status: 'ready', used: 0, percentage: 0 })
})
test('an invalid configured limit mode is not silently guessed as sum', () => {
  expect(usage(response(), 'unknown' as TrafficLimitType)).toMatchObject({ status: 'partial', used: null, percentage: null })
})
test('an empty window at the exact UTC boundary is unknown, not a fabricated zero', () => {
  const n = node()
  const cycle = getMonthlyTrafficCycle(n, start)!
  const r = { start: start.toISOString(), end: start.toISOString(), series: [], count: 0 }
  expect(metricMonthlyTraffic(n, cycle, start, r)).toMatchObject({ used: null, percentage: null, status: 'unknown' })
})
for (const fault of ['gap', 'null', 'filled-zero', 'wrong-entity', 'duplicate-series', 'duplicate-time', 'wrong-range', 'no-interval', 'not-sum', 'raw', 'negative', 'nonfinite', 'missing-count', 'tagged']) {
  test(`coverage ${fault} is never promoted to reliable monthly usage`, () => {
    const r = response()
    const s = r.series[0]!
    if (fault === 'gap')
      s.points.splice(0, 1)
    if (fault === 'null')
      s.points[0]!.value = null
    if (fault === 'filled-zero') {
      s.points[0]!.value = 0
      s.points[0]!.count = 0
    }
    if (fault === 'wrong-entity')
      s.entity_id = 'other'
    if (fault === 'duplicate-series')
      r.series.push({ ...s })
    if (fault === 'duplicate-time')
      s.points[1]!.time = s.points[0]!.time
    if (fault === 'wrong-range')
      r.start = '2026-07-24T00:00:00Z'
    if (fault === 'no-interval')
      delete s.interval_seconds
    if (fault === 'not-sum')
      s.downsample_algorithm = 'avg'
    if (fault === 'raw')
      s.downsampled = false
    if (fault === 'negative')
      s.points[0]!.value = -1
    if (fault === 'nonfinite')
      s.points[0]!.value = Number.NaN
    if (fault === 'missing-count')
      delete s.points[0]!.count
    if (fault === 'tagged')
      s.tags = { interface: 'unknown' }
    expect(usage(r).used).toBeNull()
    expect(usage(r).percentage).toBeNull()
  })
}
for (const fault of ['middle-gap', 'masked-middle-gap', 'adaptive-inflated-gap', 'invalid-time']) {
  test(`visible first/last buckets cannot certify ${fault}`, () => {
    const r = response()
    const finish = new Date('2026-07-25T06:00:00Z')
    r.end = finish.toISOString()
    for (const s of r.series) {
      s.points = Array.from({ length: 6 }, (_, hour) => ({ time: new Date(start.getTime() + hour * 3600_000).toISOString(), value: 5, count: 1 }))
      s.count = 6
    }
    const s = r.series[0]!
    if (fault === 'middle-gap')
      s.points.splice(2, 1)
    if (fault === 'masked-middle-gap')
      s.points[2]!.time = s.points[1]!.time
    if (fault === 'adaptive-inflated-gap') {
      s.points = s.points.filter((_, i) => i % 2 === 0)
      s.interval_seconds = 7200
      s.fill_empty = true
    }
    if (fault === 'invalid-time')
      s.points.push({ time: 'not-a-date', value: 999, count: 1 })
    s.count = s.points.length
    const n = node()
    const result = metricMonthlyTraffic(n, getMonthlyTrafficCycle(n, finish)!, finish, r)
    expect(result).toMatchObject({ status: 'partial', used: null, percentage: null })
    expect(result.up).not.toBeNull()
  })
}
test('unfilled continuous UTC buckets remain usable, including zero and an open last bucket', () => {
  const r = response(0, 0)
  r.end = '2026-07-25T01:30:00Z'
  for (const s of r.series)
    s.fill_empty = false
  const finish = new Date(r.end)
  const n = node()
  expect(metricMonthlyTraffic(n, getMonthlyTrafficCycle(n, finish)!, finish, r)).toMatchObject({ status: 'ready', used: 0, percentage: 0 })
})
test('UTC half-open window excludes previous/next boundary buckets without mixing entities', () => {
  const r = response()
  r.series[0]!.points.unshift({ time: '2026-07-24T23:00:00Z', value: 999, count: 1 })
  r.series[0]!.points.push({ time: end.toISOString(), value: 999, count: 1 })
  expect(analyzeTrafficSeries(r, 'traffic.up', UUID, start, end)).toEqual({ total: 10, complete: true })
})
test('history gaps, reconstructed zero and lifetime counters cannot certify a month', () => {
  const n = node()
  const records = [{ client: UUID, time: start.toISOString(), traffic_up: 10, traffic_down: 20 }, { client: UUID, time: '2026-07-25T01:50:00Z', traffic_up: 0, traffic_down: 0 }] as StatusRecord[]
  expect(historyMonthlyTraffic(records, n, getMonthlyTrafficCycle(n, end)!, end)).toMatchObject({ source: 'history', status: 'partial', observedUsed: 30, used: null, percentage: null })
  expect(historyMonthlyTraffic([{ client: UUID, time: start.toISOString(), net_total_up: 999, net_total_down: 999 } as StatusRecord], n, getMonthlyTrafficCycle(n, end)!, end).used).toBeNull()
  expect(isTrafficWarningNode(n, 80)).toBe(false)
  expect(isTrafficWarningNode(n, 80, null)).toBe(false)
})
test('record normalization preserves absent traffic fields instead of creating zero', () => {
  const base = { client: UUID, time: start.toISOString(), net_total_up: 100, net_total_down: 200 }
  expect(normalizeStatusRecord(base)?.traffic_up).toBeUndefined()
  expect(normalizeStatusRecord({ ...base, traffic_up: 0, traffic_down: 0 })?.traffic_up).toBe(0)
})

for (const billingCycle of [30, 365]) {
  for (const quota of [0, null]) {
    test(`unlimited recurring ${billingCycle}/${quota} still has monthly UTC windows and metered usage`, () => {
      const metadata = { ...node({ billing_cycle: billingCycle }), traffic_limit: quota }
      const cycle = getMonthlyTrafficCycle(metadata, end)!
      expect(cycle?.start.toISOString()).toBe(start.toISOString())
      expect(cycle?.end.toISOString()).toBe('2026-08-25T00:00:00.000Z')
      const metered = metricMonthlyTraffic(node({ billing_cycle: billingCycle, traffic_limit: quota ?? 0 }), cycle, end, response())
      expect(metered).toMatchObject({ status: 'ready', up: 10, down: 30, percentage: null })

      const monthEnd = { ...metadata, expired_at: '2027-01-31T18:30:00Z' }
      expect(getMonthlyTrafficCycle(monthEnd, new Date('2027-02-27T23:59:59.999Z'))?.key).toBe('2027-01-31')
      expect(getMonthlyTrafficCycle(monthEnd, new Date('2027-02-28T00:00:00Z'))?.key).toBe('2027-02-28')
      expect(getMonthlyTrafficCycle(monthEnd, new Date('2027-02-28T00:00:00Z'))?.end.toISOString()).toBe('2027-03-31T00:00:00.000Z')
      expect(getMonthlyTrafficCycle(monthEnd, new Date('2027-03-31T00:00:00Z'))?.key).toBe('2027-03-31')
    })
  }
}

interface RpcRequest { method: string, params?: Record<string, unknown> }
function requests(page: Page) {
  const list: RpcRequest[] = []
  page.on('request', (r) => {
    if (r.url().endsWith('/rpc2'))
      list.push(r.postDataJSON() as RpcRequest)
  })
  return list
}
function card(page: Page) {
  return page.getByRole('button', { name: '查看节点 主控-洛杉矶 详情' })
}
const monthly = (r: RpcRequest) => r.method === 'public:queryMetrics' && r.params?.aggregation === 'sum'
const rangedHistory = (r: RpcRequest) => r.method === 'common:getRecords' && typeof r.params?.start === 'string'

for (const day of [10, 14, 15, 16, 29, 30, 31]) {
  test(`renewal ${day} immediately queries actual cycle on October 10, deterministic across reload`, async ({ page }) => {
    const list = requests(page)
    await installKomariFixture(page, { hideEarth: true, latestStatusWithoutTraffic: true, trafficNow: '2026-10-10T12:00:00Z', trafficRenewalDay: day })
    await page.goto('/')
    await expect(card(page).locator('[data-monthly-traffic]')).toHaveAttribute('data-status', 'ready')
    const cycle = getMonthlyTrafficCycle(node({ expired_at: `2027-10-${String(day).padStart(2, '0')}T00:00:00Z` }), new Date('2026-10-10T12:00:00Z'))!
    expect(list.filter(monthly)).toHaveLength(1)
    expect(list.filter(monthly)[0]!.params?.start).toBe(cycle.start.toISOString())
    expect(list.filter(monthly)[0]!.params?.fill_empty).toBe(false)
    expect(list.some(rangedHistory)).toBe(false)
    await page.reload()
    await expect(card(page).locator('[data-monthly-traffic]')).toHaveAttribute('data-status', 'ready')
    expect(list.filter(monthly)).toHaveLength(2)
  })
}
for (const mode of ['up', 'down', 'min', 'max', 'sum'] as const) {
  test(`card, detail and list use the same ${mode} monthly scope`, async ({ page }) => {
    await installKomariFixture(page, { hideEarth: true, trafficLimitType: mode })
    await page.goto('/')
    const used = combineMonthlyTraffic(45 * GIB, 62 * GIB, mode)!
    const percentage = `${(used / (20 * TIB) * 100).toFixed(1)}%`
    await expect(card(page).locator('[data-monthly-traffic]')).toHaveAttribute('data-status', 'ready')
    await expect(card(page).getByText(percentage, { exact: true })).toBeVisible()
    await card(page).click()
    await expect(page.locator('.instance-detail [data-monthly-traffic]')).toHaveAttribute('data-status', 'ready')
    await expect(page.locator('.instance-detail [data-monthly-traffic]')).not.toContainText('待核对')
    await page.getByRole('button', { name: '返回首页', exact: true }).click()
    await page.getByRole('button', { name: '列表视图', exact: true }).click()
    const row = page.locator('[data-monthly-traffic]').first()
    await expect(row).toHaveAttribute('data-status', 'ready')
    await expect(row).toContainText(percentage)
    expect(await row.locator('.traffic-progress__fill').count()).toBe(mode === 'sum' ? 2 : 1)
  })
}
for (const fault of ['unavailable', 'missing-side', 'empty-entity', 'gap', 'periodic-gap', 'null'] as const) {
  test(`shared ${fault} shows unknown/partial, never legacy or fanout, ping stays available`, async ({ page }) => {
    const list = requests(page)
    await installKomariFixture(page, { hideEarth: true, generalCardKeys: ['trafficQuota', 'trafficWarnings'], trafficMetricUnavailable: fault === 'unavailable', trafficMetricMissingSide: fault === 'missing-side' ? 'traffic.down' : undefined, trafficMetricEmptyNode: fault === 'empty-entity' ? 0 : undefined, trafficMetricGapNode: fault === 'gap' ? 0 : undefined, trafficMetricPeriodicGapNode: fault === 'periodic-gap' ? 0 : undefined, trafficMetricNullNode: fault === 'null' ? 0 : undefined })
    await page.goto('/')
    const display = card(page).locator('[data-monthly-traffic]')
    await expect(display).toHaveAttribute('data-status', /unknown|partial/)
    await expect(display).toContainText('待核对')
    await expect(card(page).getByText('0.0%', { exact: true })).toHaveCount(0)
    expect(list.some(rangedHistory)).toBe(false)
    await expect.poll(() => list.some(r => r.method === 'public:getPingMetricStats' || (r.method === 'public:queryMetrics' && r.params?.aggregation !== 'sum'))).toBe(true)
  })
}
test('valid zero-valued monthly metrics display zero without history fallback', async ({ page }) => {
  const list = requests(page)
  await installKomariFixture(page, { hideEarth: true, trafficMetricZeroNode: 0 })
  await page.goto('/')
  await expect(card(page).locator('[data-monthly-traffic]')).toHaveAttribute('data-status', 'ready')
  await expect(card(page).getByText('0.0%', { exact: true })).toBeVisible()
  expect(list.some(rangedHistory)).toBe(false)
})
test('twelve different cycle groups do not deadlock nested request-pool slots or starve ping', async ({ page }) => {
  const list = requests(page)
  await installKomariFixture(page, { hideEarth: true, trafficDistinctRenewalDays: true })
  await page.goto('/')
  await expect.poll(() => page.locator('[data-monthly-traffic][data-status="ready"]').count()).toBe(12)
  expect(list.filter(monthly)).toHaveLength(12)
  expect(list.some(rangedHistory)).toBe(false)
  await expect.poll(() => list.some(r => r.method === 'public:getPingMetricStats' || (r.method === 'public:queryMetrics' && r.params?.aggregation !== 'sum'))).toBe(true)
})
test('loading never flashes lifetime traffic or a fake zero', async ({ page }) => {
  await installKomariFixture(page, { hideEarth: true, trafficMetricDelayMs: 1200 })
  await page.goto('/')
  await expect(card(page).locator('[data-monthly-traffic]')).toHaveAttribute('data-status', 'loading')
  await expect(card(page).locator('[data-monthly-traffic]')).toContainText('加载中')
  await expect(card(page).locator('[data-monthly-traffic]')).toHaveAttribute('data-status', 'ready')
})
for (const status of ['partial', 'unknown'] as const) {
  test(`compare/export/health preserve ${status} without fake zero or full-quota warnings`, async ({ page }) => {
    const list = requests(page)
    await installKomariFixture(page, { hideEarth: true, loggedIn: true, trafficMetricUnavailable: status === 'unknown', trafficMetricPeriodicGapNode: status === 'partial' ? 0 : undefined })
    await page.goto('/')
    await expect(card(page).locator('[data-monthly-traffic]')).toHaveAttribute('data-status', status)
    const monthlyBeforeTools = list.filter(monthly)
    expect(monthlyBeforeTools.map(r => r.params?.start).sort()).toEqual(['2026-07-02T00:00:00.000Z', '2026-07-25T00:00:00.000Z'])
    await page.getByRole('button', { name: '显示首页工具' }).click()
    await page.getByRole('button', { name: '对比：最多四台节点实时横向对比' }).click()
    await page.getByRole('button', { name: '主控-洛杉矶', exact: true }).click()
    const quotaCell = page.getByText('流量配额', { exact: true }).locator('xpath=following-sibling::*[1]')
    await expect(quotaCell).toContainText('待核对')
    await expect(quotaCell.locator('[class*="bg-selection/70"]')).toHaveCount(0)

    await page.getByRole('button', { name: '导出：CSV / JSON 数据快照' }).click()
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: '导出 JSON', exact: true }).click()
    const stream = await (await downloadPromise).createReadStream()
    expect(stream).not.toBeNull()
    stream!.setEncoding('utf8')
    let content = ''
    for await (const chunk of stream!)
      content += chunk
    const exported = JSON.parse(content)
    const first = exported.nodes.find((n: { id: string }) => n.id === UUID)
    expect(first.resources.traffic).toMatchObject({ status, basis: 'sum', scope: 'collected-monthly-not-provider-bill', usedBytes: null, usage: '待核对' })
    expect(list.some(rangedHistory)).toBe(false)

    // Health's history is explicitly user-triggered, not monthly fallback.
    await page.getByRole('button', { name: '健康：日周月历史健康概览' }).click()
    await page.getByRole('button', { name: '生成摘要', exact: true }).click()
    await expect(page.getByText(/台暂无可靠月度数据\/待核对，不作满额预警/)).toBeVisible()
    expect(list.filter(monthly)).toEqual(monthlyBeforeTools)
  })
}
test('home unknown cache cannot mask exactly one bounded detail history; history stays partial', async ({ page }) => {
  const list = requests(page)
  await installKomariFixture(page, { hideEarth: true, trafficMetricUnavailable: true, trafficHistoryNode: 0, legacyHistoryByHours: true })
  await page.goto('/')
  await expect(card(page).locator('[data-monthly-traffic]')).toHaveAttribute('data-status', 'unknown')
  expect(list.some(rangedHistory)).toBe(false)
  await card(page).click()
  const predicate = (r: RpcRequest) => rangedHistory(r) && r.params?.uuid === UUID && r.params?.load_type === 'network' && r.params?.maxCount === -1 && r.params?.start === '2026-07-25T00:00:00.000Z' && r.params?.end === '2026-07-25T12:00:00.000Z' && r.params?.hours === 13
  await expect.poll(() => list.filter(predicate).length).toBe(1)
  await expect(page.locator('.instance-detail [data-monthly-traffic]')).toHaveAttribute('data-status', 'partial')
  await page.getByRole('button', { name: '返回首页', exact: true }).click()
  await expect(card(page).locator('[data-monthly-traffic]')).toHaveAttribute('data-status', 'unknown')
  expect(list.filter(rangedHistory)).toHaveLength(1)
})
test('eleven minutes of shared clocks coalesce refreshes under ten-minute cache TTL', async ({ page }) => {
  const list = requests(page)
  await page.clock.install({ time: new Date('2026-07-25T12:00:00Z') })
  await installKomariFixture(page, { hideEarth: true, useNativeClock: true, trafficRenewalDay: 25, generalCardKeys: ['trafficQuota'] })
  await page.goto('/')
  await expect(card(page).locator('[data-monthly-traffic]')).toHaveAttribute('data-status', 'ready')
  expect(list.filter(monthly)).toHaveLength(1)
  await page.clock.runFor(11 * 60_000)
  expect(list.filter(monthly).length).toBeLessThanOrEqual(2)
  // TTL starts when the response is cached, slightly after the clock starts;
  // the next eligible five-minute tick may therefore be minute 15, not 10.
  await page.clock.runFor(5 * 60_000)
  await expect.poll(() => list.filter(monthly).length).toBe(2)
  expect(list.some(rangedHistory)).toBe(false)
})
test('UTC renewal boundary switches cycle once and does not manufacture a zero at empty window', async ({ page }) => {
  const list = requests(page)
  // The minute clock detects the boundary on the same tick as the bounded
  // five-minute refresh; both triggers must coalesce into one new-cycle query.
  await page.clock.install({ time: new Date('2026-10-14T23:55:30Z') })
  await installKomariFixture(page, { hideEarth: true, useNativeClock: true, trafficRenewalDay: 15 })
  await page.goto('/')
  await expect(card(page).locator('[data-monthly-traffic]')).toHaveAttribute('data-status', 'ready')
  await page.clock.runFor(5 * 60_000)
  await expect.poll(() => list.filter(r => monthly(r) && r.params?.start === '2026-10-15T00:00:00.000Z').length).toBe(1)
  await page.clock.runFor(2 * 60_000)
  expect(list.filter(r => monthly(r) && r.params?.start === '2026-10-15T00:00:00.000Z')).toHaveLength(1)
})

for (const billingCycle of [30, 365]) {
  for (const quota of [0, null, 20 * TIB]) {
    test(`monthly directional card and home total use collected deltas for ${billingCycle}/${quota}`, async ({ page }) => {
      const list = requests(page)
      await installKomariFixture(page, {
        hideEarth: true,
        generalCardKeys: ['totalTraffic'],
        trafficFirstNode: { billing_cycle: billingCycle, traffic_limit: quota },
        largeLifetimeTraffic: true,
      })
      await page.goto('/')
      const up = card(page).locator('[data-monthly-direction="up"]')
      const down = card(page).locator('[data-monthly-direction="down"]')
      await expect(up).toContainText('45.0 GB')
      await expect(down).toContainText('62.0 GB')
      await expect(up).toContainText('本月上行')
      await expect(down).toContainText('本月下行')
      await expect(card(page)).not.toContainText('100.00 TB')
      await expect(card(page)).not.toContainText('200.00 TB')
      if (quota === null || quota === 0)
        await expect(card(page).locator('[data-monthly-traffic]')).toContainText('∞')

      const total = page.locator('[data-general-card-key="totalTraffic"]')
      const expected = formatBytesSplit(Array.from({ length: 12 }, (_, index) =>
        (index + 1) * 45 * GIB + (index === 6 ? 1.78 * TIB : (index + 1) * 62 * GIB)).reduce((sum, value) => sum + value, 0))
      await expect(total).toHaveAttribute('data-monthly-pending-count', '0')
      await expect(total).toContainText('本月累计')
      await expect(total).toContainText(expected.value)
      await expect(total).toContainText(expected.unit)
      await expect(total).not.toContainText('待核对')
      expect(list.some(rangedHistory)).toBe(false)
    })
  }
}

for (const scenario of ['partial', 'unknown', 'missing-down', 'no-cycle'] as const) {
  test(`monthly directional card and home total do not disguise ${scenario} data as complete`, async ({ page }) => {
    await installKomariFixture(page, {
      hideEarth: true,
      generalCardKeys: ['totalTraffic'],
      largeLifetimeTraffic: true,
      trafficMetricPeriodicGapNode: scenario === 'partial' ? 0 : undefined,
      trafficMetricUnavailable: scenario === 'unknown',
      trafficMetricMissingSide: scenario === 'missing-down' ? 'traffic.down' : undefined,
      trafficLimitType: scenario === 'missing-down' ? 'up' : 'sum',
      trafficFirstNode: scenario === 'no-cycle' ? { billing_cycle: -1, traffic_limit: 0 } : undefined,
    })
    await page.goto('/')
    const up = card(page).locator('[data-monthly-direction="up"]')
    const down = card(page).locator('[data-monthly-direction="down"]')
    await expect(down).toContainText('待核对')
    if (scenario === 'missing-down')
      await expect(up).toContainText('45.0 GB')
    else
      await expect(up).toContainText('待核对')
    const pending = scenario === 'unknown' || scenario === 'missing-down' ? 12 : 1
    const total = page.locator('[data-general-card-key="totalTraffic"]')
    await expect(total).toHaveAttribute('data-monthly-pending-count', String(pending))
    await expect(total).toContainText('待核对')
    await expect(total).toContainText(`${pending} 台`)
    await expect(total).not.toContainText('TB')
    await expect(card(page)).not.toContainText('100.00 TB')
    await expect(card(page)).not.toContainText('200.00 TB')
  })
}

test('monthly directional card and home total distinguish loading from a verified zero', async ({ page }) => {
  await installKomariFixture(page, {
    hideEarth: true,
    generalCardKeys: ['totalTraffic'],
    largeLifetimeTraffic: true,
    trafficMetricDelayMs: 2000,
    trafficMetricZeroNode: 0,
  })
  await page.goto('/')
  const up = card(page).locator('[data-monthly-direction="up"]')
  const down = card(page).locator('[data-monthly-direction="down"]')
  const total = page.locator('[data-general-card-key="totalTraffic"]')
  await expect(up).toContainText('待核对')
  await expect(down).toContainText('待核对')
  await expect(total).toHaveAttribute('data-monthly-pending-count', '12')
  await expect(total).toContainText('待核对')
  await expect(up).toContainText('0 B')
  await expect(down).toContainText('0 B')
  await expect(total).toHaveAttribute('data-monthly-pending-count', '0')
  await expect(total).not.toContainText('待核对')
})
