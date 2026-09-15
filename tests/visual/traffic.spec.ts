import type { NodeData } from '../../src/stores/nodes'
import type { MetricQueryResponse } from '../../src/utils/rpc'
import { expect, test } from '@playwright/test'
import { hasMonthlyTrafficCycleChanged, MONTHLY_TRAFFIC_REFRESH_INTERVAL_MS } from '../../src/composables/useMonthlyTrafficUsage'
import { normalizeStatusRecord } from '../../src/services/history.service'
import { hasUsableTrafficMetricData, MONTHLY_TRAFFIC_CACHE_TTL_MS, sumTrafficMetricSeries } from '../../src/services/traffic.service'
import * as financeHelper from '../../src/utils/financeHelper'
import { getMonthlyTrafficCycle } from '../../src/utils/trafficCycle'
import { installKomariFixture } from './fixtures/komari'

function cycleNode(overrides: Partial<NodeData> = {}): NodeData {
  return {
    billing_cycle: 365,
    expired_at: '2027-07-25T18:30:00.000Z',
    traffic_limit: 20 * 1024 ** 4,
    ...overrides,
  } as NodeData
}

test.describe('monthly traffic cycle and compatibility helpers', () => {
  test('normalizes SGD and S$ without regressing CAD or USD prefix matching', () => {
    expect(financeHelper.normalizeCurrency('SGD')).toBe('SGD')
    expect(financeHelper.normalizeCurrency('S$')).toBe('SGD')
    expect(financeHelper.normalizeCurrency('C$')).toBe('CAD')
    expect(financeHelper.normalizeCurrency('$')).toBe('USD')
    expect(financeHelper.normalizeCurrency('S$ per month')).toBe('CNY')
    expect(financeHelper.SUPPORTED_CURRENCIES).toContain('SGD')
    expect(financeHelper.CURRENCY_SYMBOLS.SGD).toBe('S$')
    expect(financeHelper.formatFinanceAmount(12.5, 'SGD')).toMatchObject({ currency: 'SGD', symbol: 'S$' })
  })

  test('uses the same renewal day for monthly traffic even on annual billing', () => {
    const cycle = getMonthlyTrafficCycle(cycleNode(), new Date('2026-08-01T12:00:00.000Z'))

    expect(cycle).not.toBeNull()
    expect(cycle?.start.toISOString()).toBe('2026-07-25T00:00:00.000Z')
    expect(cycle?.end.toISOString()).toBe('2026-08-25T00:00:00.000Z')
    expect(cycle?.renewalDay).toBe(25)
  })

  test('uses a bounded refresh policy and only invalidates when the monthly cycle changes', () => {
    expect(MONTHLY_TRAFFIC_REFRESH_INTERVAL_MS).toBe(5 * 60_000)
    expect(MONTHLY_TRAFFIC_CACHE_TTL_MS).toBe(10 * 60_000)
    expect(hasMonthlyTrafficCycleChanged(undefined, '2026-07-25')).toBe(false)
    expect(hasMonthlyTrafficCycleChanged('2026-07-25', '2026-07-25')).toBe(false)
    expect(hasMonthlyTrafficCycleChanged('2026-07-25', '2026-07-26')).toBe(true)
  })

  test('clamps day 31 in short months and restores it in the next long month', () => {
    const beforeFebruaryBoundary = getMonthlyTrafficCycle(
      cycleNode({ expired_at: '2027-01-31T00:00:00.000Z' }),
      new Date('2027-02-27T23:59:59.000Z'),
    )
    const FebruaryBoundary = getMonthlyTrafficCycle(
      cycleNode({ expired_at: '2027-01-31T00:00:00.000Z' }),
      new Date('2027-02-28T00:00:00.000Z'),
    )
    const MarchBoundary = getMonthlyTrafficCycle(
      cycleNode({ expired_at: '2027-01-31T00:00:00.000Z' }),
      new Date('2027-03-31T00:00:00.000Z'),
    )

    expect(beforeFebruaryBoundary?.start.toISOString()).toBe('2027-01-31T00:00:00.000Z')
    expect(beforeFebruaryBoundary?.end.toISOString()).toBe('2027-02-28T00:00:00.000Z')
    expect(FebruaryBoundary?.start.toISOString()).toBe('2027-02-28T00:00:00.000Z')
    expect(FebruaryBoundary?.end.toISOString()).toBe('2027-03-31T00:00:00.000Z')
    expect(MarchBoundary?.start.toISOString()).toBe('2027-03-31T00:00:00.000Z')
    expect(MarchBoundary?.end.toISOString()).toBe('2027-04-30T00:00:00.000Z')
  })

  test('handles leap February and a year boundary deterministically', () => {
    const leapFebruary = getMonthlyTrafficCycle(
      cycleNode({ expired_at: '2024-01-31T00:00:00.000Z' }),
      new Date('2024-02-29T12:00:00.000Z'),
    )
    const newYear = getMonthlyTrafficCycle(
      cycleNode({ expired_at: '2026-12-31T00:00:00.000Z' }),
      new Date('2027-01-01T00:00:00.000Z'),
    )

    expect(leapFebruary?.start.toISOString()).toBe('2024-02-29T00:00:00.000Z')
    expect(leapFebruary?.end.toISOString()).toBe('2024-03-31T00:00:00.000Z')
    expect(newYear?.start.toISOString()).toBe('2026-12-31T00:00:00.000Z')
    expect(newYear?.end.toISOString()).toBe('2027-01-31T00:00:00.000Z')
  })

  test('falls back for unlimited, one-off, and incomplete renewal metadata', () => {
    expect(getMonthlyTrafficCycle(cycleNode({ traffic_limit: 0 }), new Date('2026-08-01T00:00:00.000Z'))).toBeNull()
    expect(getMonthlyTrafficCycle(cycleNode({ billing_cycle: -1 }), new Date('2026-08-01T00:00:00.000Z'))).toBeNull()
    expect(getMonthlyTrafficCycle(cycleNode({ expired_at: '' }), new Date('2026-08-01T00:00:00.000Z'))).toBeNull()
  })

  test('sums every traffic delta bucket for one entity and metric', () => {
    const response: MetricQueryResponse = {
      start: '2026-07-25T00:00:00.000Z',
      end: '2026-08-01T00:00:00.000Z',
      series: [
        {
          metric_key: 'traffic.up',
          entity_id: 'node-a',
          downsampled: true,
          count: 3,
          points: [
            { time: '2026-07-25T00:00:00.000Z', value: 10 },
            { time: '2026-07-26T00:00:00.000Z', value: null },
            { time: '2026-07-27T00:00:00.000Z', value: 7 },
          ],
        },
        {
          metric_key: 'traffic.up',
          entity_id: 'node-a',
          downsampled: true,
          count: 1,
          points: [{ time: '2026-07-28T00:00:00.000Z', value: 3 }],
        },
        {
          metric_key: 'traffic.up',
          entity_id: 'node-b',
          downsampled: true,
          count: 1,
          points: [{ time: '2026-07-25T00:00:00.000Z', value: 99 }],
        },
      ],
      count: 3,
    }

    expect(sumTrafficMetricSeries(response, 'traffic.up', 'node-a')).toBe(20)
    expect(sumTrafficMetricSeries(response, 'traffic.down', 'node-a')).toBe(0)
    expect(sumTrafficMetricSeries(response, 'traffic.up', 'node-b')).toBe(99)
  })

  test('requires the metric sides needed by the quota mode while accepting zero points', () => {
    const response: MetricQueryResponse = {
      start: '2026-07-25T00:00:00.000Z',
      end: '2026-07-25T01:00:00.000Z',
      series: [
        { metric_key: 'traffic.up', entity_id: 'node-zero', downsampled: false, count: 1, points: [{ time: '2026-07-25T00:00:00.000Z', value: 0 }] },
        { metric_key: 'traffic.down', entity_id: 'node-zero', downsampled: false, count: 1, points: [{ time: '2026-07-25T00:00:00.000Z', value: 0 }] },
        { metric_key: 'traffic.up', entity_id: 'node-null', downsampled: false, count: 1, points: [{ time: '2026-07-25T00:00:00.000Z', value: null }] },
      ],
      count: 3,
    }

    expect(hasUsableTrafficMetricData(response, 'node-zero', 'sum')).toBe(true)
    expect(hasUsableTrafficMetricData(response, 'node-zero', 'min')).toBe(true)
    expect(hasUsableTrafficMetricData(response, 'node-zero', 'max')).toBe(true)
    expect(hasUsableTrafficMetricData(response, 'node-zero', 'up')).toBe(true)
    expect(hasUsableTrafficMetricData(response, 'node-zero', 'down')).toBe(true)
    expect(hasUsableTrafficMetricData(response, 'node-null', 'up')).toBe(false)
    expect(hasUsableTrafficMetricData(response, 'node-null', 'sum')).toBe(false)
  })

  test('preserves missing history delta fields instead of converting them to zero', () => {
    const base = {
      client: 'node-a',
      time: '2026-07-25T01:00:00.000Z',
      net_total_up: 100,
      net_total_down: 200,
    }
    const missing = normalizeStatusRecord(base)
    const zero = normalizeStatusRecord({ ...base, traffic_up: 0, traffic_down: 0 })

    expect(missing?.traffic_up).toBeUndefined()
    expect(missing?.traffic_down).toBeUndefined()
    expect(zero?.traffic_up).toBe(0)
    expect(zero?.traffic_down).toBe(0)
  })
})

test('Komari 1.5 latest status without traffic fields uses batched metric SUM', async ({ page }) => {
  const rpcRequests: Array<{ method: string, params?: Record<string, unknown> }> = []
  page.on('request', (request) => {
    if (!request.url().endsWith('/rpc2'))
      return
    const payload = request.postDataJSON() as { method: string, params?: Record<string, unknown> }
    rpcRequests.push(payload)
  })

  await installKomariFixture(page, {
    hideEarth: true,
    latestStatusWithoutTraffic: true,
    generalCardKeys: ['trafficQuota'],
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Komari Visual Lab' })).toBeVisible()

  await expect.poll(() => rpcRequests.filter(request => request.method === 'public:queryMetrics' && request.params?.aggregation === 'sum').length).toBeGreaterThan(0)
  const metricRequests = rpcRequests.filter(request => request.method === 'public:queryMetrics' && request.params?.aggregation === 'sum')
  const metricRequest = metricRequests.find(request => request.params?.start === '2026-07-25T00:00:00.000Z')
  expect(metricRequests.filter(request => request.params?.start === '2026-07-25T00:00:00.000Z')).toHaveLength(1)
  expect(metricRequest?.params?.metric_keys).toEqual(['traffic.up', 'traffic.down'])
  const entityIds = metricRequest?.params?.entity_ids
  expect(entityIds).toEqual(expect.arrayContaining([
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002',
  ]))
  expect(Array.isArray(entityIds) ? entityIds.length : 0).toBeGreaterThan(1)
  expect(metricRequest?.params?.start).toBe('2026-07-25T00:00:00.000Z')
  expect(metricRequest?.params?.end).toBe('2026-07-25T12:00:00.000Z')
  await expect(page.getByRole('button', { name: '查看节点 主控-洛杉矶 详情' }).getByText('0.5%', { exact: true })).toBeVisible()
})

test('a missing entity series uses legacy only on the shared home context', async ({ page }) => {
  const rpcRequests: Array<{ method: string, params?: Record<string, unknown> }> = []
  page.on('request', (request) => {
    if (!request.url().endsWith('/rpc2'))
      return
    const payload = request.postDataJSON() as { method: string, params?: Record<string, unknown> }
    rpcRequests.push(payload)
  })

  await installKomariFixture(page, {
    hideEarth: true,
    latestStatusWithoutTraffic: true,
    trafficMetricEmptyNode: 1,
    generalCardKeys: ['trafficQuota'],
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Komari Visual Lab' })).toBeVisible()

  const nodeA = '00000000-0000-4000-8000-000000000001'
  const nodeB = '00000000-0000-4000-8000-000000000002'
  await expect.poll(() => rpcRequests.filter(request => request.method === 'public:queryMetrics' && request.params?.aggregation === 'sum').length).toBeGreaterThan(0)
  const metricRequest = rpcRequests.find(request => request.method === 'public:queryMetrics' && request.params?.start === '2026-07-25T00:00:00.000Z')
  const trafficHistoryRequests = rpcRequests.filter(request => request.method === 'common:getRecords' && request.params?.type === 'load' && request.params?.start === '2026-07-25T00:00:00.000Z')
  expect(metricRequest?.params?.entity_ids).toEqual(expect.arrayContaining([nodeA, nodeB]))
  expect(trafficHistoryRequests).toHaveLength(0)
  await expect(page.getByRole('button', { name: '查看节点 香港边缘节点-超长名称布局测试 详情' }).getByText('1.0%', { exact: true })).toBeVisible()
})

test('a zero-valued metric point remains metric data and does not trigger history', async ({ page }) => {
  const rpcRequests: Array<{ method: string, params?: Record<string, unknown> }> = []
  page.on('request', (request) => {
    if (!request.url().endsWith('/rpc2'))
      return
    const payload = request.postDataJSON() as { method: string, params?: Record<string, unknown> }
    rpcRequests.push(payload)
  })

  await installKomariFixture(page, {
    hideEarth: true,
    latestStatusWithoutTraffic: true,
    trafficMetricZeroNode: 2,
    generalCardKeys: ['trafficQuota'],
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Komari Visual Lab' })).toBeVisible()

  await expect.poll(() => rpcRequests.filter(request => request.method === 'public:queryMetrics' && request.params?.aggregation === 'sum').length).toBeGreaterThan(0)
  await expect(page.getByRole('button', { name: '查看节点 东京-高负载 详情' }).getByText('0.0%', { exact: true })).toBeVisible()
  expect(rpcRequests.some(request => request.method === 'common:getRecords' && request.params?.type === 'load' && request.params?.uuid === '00000000-0000-4000-8000-000000000003')).toBe(false)
})

test('metric method unavailable uses legacy without a shared home history fan-out', async ({ page }) => {
  const rpcRequests: Array<{ method: string, params?: Record<string, unknown> }> = []
  page.on('request', (request) => {
    if (!request.url().endsWith('/rpc2'))
      return
    const payload = request.postDataJSON() as { method: string, params?: Record<string, unknown> }
    rpcRequests.push(payload)
  })

  await installKomariFixture(page, {
    hideEarth: true,
    latestStatusWithoutTraffic: true,
    trafficMetricUnavailable: true,
    generalCardKeys: ['trafficQuota'],
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Komari Visual Lab' })).toBeVisible()

  await expect.poll(() => rpcRequests.filter(request => request.method === 'public:queryMetrics' && request.params?.aggregation === 'sum').length).toBeGreaterThan(0)
  const metricRequest = rpcRequests.find(request => request.method === 'public:queryMetrics' && request.params?.aggregation === 'sum')
  const trafficHistoryRequests = rpcRequests.filter(request => request.method === 'common:getRecords' && request.params?.type === 'load' && request.params?.start === '2026-07-25T00:00:00.000Z')
  expect(metricRequest).toBeTruthy()
  expect(trafficHistoryRequests).toHaveLength(0)
  await expect(page.getByRole('button', { name: '查看节点 主控-洛杉矶 详情' }).getByText('0.5%', { exact: true })).toBeVisible()
})

test('legacy common:getRecords receives safe hours when it ignores start and end', async ({ page }) => {
  const rpcRequests: Array<{ method: string, params?: Record<string, unknown> }> = []
  page.on('request', (request) => {
    if (!request.url().endsWith('/rpc2'))
      return
    const payload = request.postDataJSON() as { method: string, params?: Record<string, unknown> }
    rpcRequests.push(payload)
  })

  const targetUuid = '00000000-0000-4000-8000-000000000003'
  await installKomariFixture(page, {
    hideEarth: true,
    latestStatusWithoutTraffic: true,
    trafficMetricUnavailable: true,
    trafficHistoryNode: 2,
    legacyHistoryByHours: true,
    generalCardKeys: ['trafficQuota'],
  })
  await page.goto(`/instance/${targetUuid}`)
  await expect(page.getByText('东京-高负载').first()).toBeVisible()

  const isTargetRangeRequest = (request: { method: string, params?: Record<string, unknown> }) => request.method === 'common:getRecords'
    && request.params?.uuid === targetUuid
    && request.params?.start === '2026-07-25T00:00:00.000Z'
    && request.params?.end === '2026-07-25T12:00:00.000Z'
    && request.params?.hours === 13
  await expect.poll(() => rpcRequests.some(isTargetRangeRequest)).toBe(true)
  const targetRangeRequests = rpcRequests.filter(isTargetRangeRequest)
  expect(targetRangeRequests).toHaveLength(1)
  const targetRequest = targetRangeRequests[0]
  expect(targetRequest?.params?.hours).toBe(13)
  expect(targetRequest?.params?.start).toBe('2026-07-25T00:00:00.000Z')
  expect(targetRequest?.params?.end).toBe('2026-07-25T12:00:00.000Z')
  expect(targetRequest?.params?.load_type).toBe('network')
  expect(targetRequest?.params?.maxCount).toBe(-1)
  expect(targetRequest?.params?.max_count).toBe(-1)
  await expect(page.getByText('10.0%', { exact: true }).first()).toBeVisible()
})

test('home legacy cache does not mask single-node detail history fallback', async ({ page }) => {
  const rpcRequests: Array<{ method: string, params?: Record<string, unknown> }> = []
  page.on('request', (request) => {
    if (!request.url().endsWith('/rpc2'))
      return
    rpcRequests.push(request.postDataJSON() as { method: string, params?: Record<string, unknown> })
  })

  const nodeB = '00000000-0000-4000-8000-000000000002'
  await installKomariFixture(page, {
    hideEarth: true,
    latestStatusWithoutTraffic: true,
    trafficMetricUnavailable: true,
    trafficHistoryNode: 1,
    legacyHistoryByHours: true,
    generalCardKeys: ['trafficQuota'],
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Komari Visual Lab' })).toBeVisible()
  await expect.poll(() => rpcRequests.some(request => request.method === 'public:queryMetrics' && request.params?.aggregation === 'sum')).toBe(true)
  const homeRangeRequests = () => rpcRequests.filter(request => request.method === 'common:getRecords'
    && request.params?.type === 'load'
    && request.params?.start === '2026-07-25T00:00:00.000Z')
  expect(homeRangeRequests()).toHaveLength(0)
  await expect(page.getByRole('button', { name: '查看节点 香港边缘节点-超长名称布局测试 详情' }).getByText('1.0%', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: '查看节点 香港边缘节点-超长名称布局测试 详情' }).click()
  await expect(page).toHaveURL(`/instance/${nodeB}`)
  await expect(page.getByText('香港边缘节点-超长名称布局测试').first()).toBeVisible()
  const isTargetRangeRequest = (request: { method: string, params?: Record<string, unknown> }) => request.method === 'common:getRecords'
    && request.params?.uuid === nodeB
    && request.params?.start === '2026-07-25T00:00:00.000Z'
    && request.params?.end === '2026-07-25T12:00:00.000Z'
    && request.params?.hours === 13
  await expect.poll(() => rpcRequests.some(isTargetRangeRequest)).toBe(true)
  expect(rpcRequests.filter(isTargetRangeRequest)).toHaveLength(1)
  await expect(page.getByText('10.0%', { exact: true }).first()).toBeVisible()

  await page.getByRole('button', { name: '返回首页' }).click()
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('button', { name: '查看节点 香港边缘节点-超长名称布局测试 详情' }).getByText('1.0%', { exact: true })).toBeVisible()
  expect(homeRangeRequests()).toHaveLength(1)
  expect(rpcRequests.filter(isTargetRangeRequest)).toHaveLength(1)
})

test('shared clock ticks for eleven minutes without a monthly request storm', async ({ page }) => {
  const rpcRequests: Array<{ method: string, params?: Record<string, unknown> }> = []
  page.on('request', (request) => {
    if (!request.url().endsWith('/rpc2'))
      return
    rpcRequests.push(request.postDataJSON() as { method: string, params?: Record<string, unknown> })
  })

  await page.clock.install({ time: new Date('2026-07-25T12:00:00.000Z') })
  await installKomariFixture(page, { hideEarth: true, useNativeClock: true, generalCardKeys: ['trafficQuota'] })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Komari Visual Lab' })).toBeVisible()
  await expect.poll(() => rpcRequests.filter(request => request.method === 'public:queryMetrics' && request.params?.aggregation === 'sum').length).toBeGreaterThan(0)

  await page.clock.pauseAt(new Date('2026-07-25T12:01:00.000Z'))
  const initialMetricRequestCount = rpcRequests.filter(request => request.method === 'public:queryMetrics' && request.params?.aggregation === 'sum').length
  await page.clock.runFor('11:00')
  const finalMetricRequestCount = rpcRequests.filter(request => request.method === 'public:queryMetrics' && request.params?.aggregation === 'sum').length
  expect(finalMetricRequestCount).toBeGreaterThanOrEqual(initialMetricRequestCount)
  expect(finalMetricRequestCount).toBeLessThanOrEqual(initialMetricRequestCount + 1)
})

test('cycle boundary causes one new monthly query while annual billing stays monthly', async ({ page }) => {
  const rpcRequests: Array<{ method: string, params?: Record<string, unknown> }> = []
  page.on('request', (request) => {
    if (!request.url().endsWith('/rpc2'))
      return
    rpcRequests.push(request.postDataJSON() as { method: string, params?: Record<string, unknown> })
  })

  await page.clock.install({ time: new Date('2026-08-24T23:59:00.000Z') })
  await installKomariFixture(page, { hideEarth: true, useNativeClock: true, generalCardKeys: ['trafficQuota'] })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Komari Visual Lab' })).toBeVisible()
  await expect.poll(() => rpcRequests.some(request => request.method === 'public:queryMetrics' && request.params?.start === '2026-07-25T00:00:00.000Z')).toBe(true)

  await page.clock.runFor('02:00')
  await expect.poll(() => rpcRequests.filter(request => request.method === 'public:queryMetrics' && request.params?.start === '2026-08-25T00:00:00.000Z').length).toBe(1)
  expect(rpcRequests.filter(request => request.method === 'public:queryMetrics' && request.params?.start === '2026-08-25T00:00:00.000Z')).toHaveLength(1)
})

test('monthly metric unavailability does not block ping RPC completion or fan out history', async ({ page }) => {
  const rpcRequests: Array<{ method: string, params?: Record<string, unknown> }> = []
  const completedMethods: string[] = []
  page.on('request', (request) => {
    if (!request.url().endsWith('/rpc2'))
      return
    rpcRequests.push(request.postDataJSON() as { method: string, params?: Record<string, unknown> })
  })
  page.on('requestfinished', (request) => {
    if (!request.url().endsWith('/rpc2'))
      return
    const payload = request.postDataJSON() as { method: string }
    completedMethods.push(payload.method)
  })

  await installKomariFixture(page, {
    hideEarth: true,
    latestStatusWithoutTraffic: true,
    trafficMetricUnavailable: true,
    transit: true,
    trafficMetricDelayMs: 250,
    generalCardKeys: ['trafficQuota'],
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Komari Visual Lab' })).toBeVisible()
  await expect.poll(() => completedMethods.includes('public:getPublicPingTasks')).toBe(true)
  await expect.poll(() => completedMethods.includes('public:getPingMetricStats')).toBe(true)
  expect(rpcRequests.filter(request => request.method === 'common:getRecords' && request.params?.type === 'load' && request.params?.start).length).toBe(0)
})

test('legacy traffic remains visible while the monthly metric request is pending', async ({ page }) => {
  const rpcRequests: Array<{ method: string, params?: Record<string, unknown> }> = []
  page.on('request', (request) => {
    if (request.url().endsWith('/rpc2'))
      rpcRequests.push(request.postDataJSON() as { method: string, params?: Record<string, unknown> })
  })

  await installKomariFixture(page, {
    hideEarth: true,
    trafficMetricZeroNode: 0,
    trafficMetricDelayMs: 1_000,
    generalCardKeys: ['trafficQuota'],
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Komari Visual Lab' })).toBeVisible()
  await expect(page.getByRole('button', { name: '查看节点 主控-洛杉矶 详情' }).getByText('0.5%', { exact: true })).toBeVisible()
  await expect.poll(() => rpcRequests.some(request => request.method === 'public:queryMetrics' && request.params?.aggregation === 'sum')).toBe(true)
  await expect(page.getByRole('button', { name: '查看节点 主控-洛杉矶 详情' }).getByText('0.0%', { exact: true })).toBeVisible()
})
