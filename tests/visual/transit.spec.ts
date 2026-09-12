import type { Page } from '@playwright/test'
import type { NodePingTaskStatsState } from '../../src/composables/useNodePingStats'
import { expect, test } from '@playwright/test'
import { deriveTransitCarrierPing, mergeTransitHistory, mergeTransitLatency, mergeTransitLoss, parseTransitCarrierPingRules } from '../../src/utils/transitCarrierPing'
import { installKomariFixture } from './fixtures/komari'

function task(id: number, name: string, latency: number, loss: number): NodePingTaskStatsState {
  return {
    id,
    name,
    hasLatency: true,
    stats: { avgLatency: latency, avgLoss: loss, avgVolatility: 9, hasData: true, history: [{ time: '2026-07-25T12:00:00Z', latency, loss }] },
  }
}

test('transit parser trims, ignores malformed/comments and uses last valid target', () => {
  expect(parseTransitCarrierPingRules(' TargetNode | RelayNode | Link ')).toEqual([{ target: 'TargetNode', relay: 'RelayNode', task: 'Link' }])
  expect(parseTransitCarrierPingRules('\n # comment\ninvalid\nA||Link\nA|B|C|D\nA|A|Link\n')).toEqual([])
  expect(parseTransitCarrierPingRules('A|B|One\n C | B | Two\nA|D|Three\nA||bad')).toEqual([
    { target: 'A', relay: 'D', task: 'Three' },
    { target: 'C', relay: 'B', task: 'Two' },
  ])
  for (const input of [null, undefined, {}, 42])
    expect(parseTransitCarrierPingRules(input)).toEqual([])
})

test('transit RTT and loss keep null and probability semantics', () => {
  expect(mergeTransitLatency(32, 63)).toBe(95)
  expect(mergeTransitLoss(1, 2)).toBeCloseTo(2.98, 10)
  expect(mergeTransitLoss(1, 2)?.toFixed(1)).toBe('3.0')
  expect(mergeTransitLoss(100, 2)).toBe(100)
  for (const missing of [null, Number.NaN, Number.POSITIVE_INFINITY]) {
    expect(mergeTransitLatency(missing, 63)).toBeNull()
    expect(mergeTransitLatency(32, missing)).toBeNull()
    expect(mergeTransitLoss(missing, 2)).toBeNull()
  }
  expect(mergeTransitLoss(-1, 2)).toBeNull()
  expect(mergeTransitLoss(1, 101)).toBeNull()
})

test('transit derives carriers without mutating source, excluding link from carrier matching', () => {
  const tasks = [task(1, 'Unicom', 32, 1), task(2, 'Telecom Link', 63, 2), task(3, 'Mobile', 25, 0)]
  const before = JSON.stringify(tasks)
  const result = deriveTransitCarrierPing(tasks, 'Telecom Link')
  expect(result[0]!.stats.avgLatency).toBe(95)
  expect(result[0]!.stats.avgLoss).toBeCloseTo(2.98)
  expect(result[0]!.stats.avgVolatility).toBe(0)
  expect(result[1]!.hasLatency).toBe(false)
  expect(result[2]!.stats.avgLatency).toBe(88)
  expect(deriveTransitCarrierPing(tasks, 'Missing').every(carrier => !carrier.hasLatency && !carrier.stats.hasData)).toBe(true)
  expect(JSON.stringify(tasks)).toBe(before)
})

test('transit history aligns timestamps, preserves null and never joins disjoint windows', () => {
  const make = (seconds: number, latency: number | null) => ({ time: new Date(Date.UTC(2026, 6, 25, 12, 0, seconds)).toISOString(), latency, loss: latency === null ? null : 1 })
  const merged = mergeTransitHistory([make(0, 32), make(60, null), make(190, 32)], [make(1, 63), make(61, 63), make(191, 63)])
  expect(merged).toHaveLength(20)
  expect(merged[0]!.latency).toBe(95)
  expect(merged.some(point => point.latency === null)).toBe(true)
  expect(mergeTransitHistory([make(0, 32)], [make(3600, 63)]).every(point => point.latency === null && point.loss === null)).toBe(true)
  expect(mergeTransitHistory([make(0, 32)], []).every(point => point.latency === null)).toBe(true)
  expect(mergeTransitHistory([], [])).toEqual([])
})

function card(page: Page, name = 'TargetNode') {
  return page.getByRole('button', { name: `查看节点 ${name} 详情`, exact: true })
}

async function updateLiveState(page: Page, change: { enabled?: boolean, rules?: string, online?: boolean }) {
  await page.evaluate((change) => {
    interface TestStore {
      publicSettings: { theme_settings: Record<string, unknown> }
      nodes: Array<{ name: string, online: boolean }>
    }
    const root = document.querySelector('#app') as HTMLElement & {
      __vue_app__: { config: { globalProperties: { $pinia: { _s: Map<string, TestStore> } } } }
    }
    const stores = root.__vue_app__.config.globalProperties.$pinia._s
    const settings = stores.get('app')!.publicSettings.theme_settings
    if (change.enabled !== undefined)
      settings.transitCarrierPingEnabled = change.enabled
    if (change.rules !== undefined)
      settings.transitCarrierPingRules = change.rules
    if (change.online !== undefined)
      stores.get('nodes')!.nodes.find(node => node.name === 'RelayNode')!.online = change.online
  }, change)
}

test('transit reacts to disable, rule removal and relay going offline without stale values', async ({ page }) => {
  await installKomariFixture(page, { transit: true, hideEarth: true })
  await page.goto('/')
  const row = card(page).locator('[data-carrier-ping="unicom-latency"]')
  await expect(row).toContainText('≈95 ms')
  await updateLiveState(page, { online: false })
  await expect(row).toHaveAttribute('title', /中转节点离线/)
  await expect(row).not.toContainText('≈')
  await updateLiveState(page, { online: true })
  await expect(row).toContainText('≈95 ms')
  await updateLiveState(page, { enabled: false })
  await expect(row).toContainText('32 ms')
  await expect(card(page)).not.toContainText('中转估算')
  await updateLiveState(page, { enabled: true })
  await expect(row).toContainText('≈95 ms')
  await updateLiveState(page, { rules: '' })
  await expect(row).toContainText('32 ms')
  await expect(card(page)).not.toContainText('中转估算')
})

test('transit targets independently select multiple relays', async ({ page }) => {
  await installKomariFixture(page, {
    transit: true,
    hideEarth: true,
    transitRules: 'TargetNode|RelayNode|Relay-Target-v6\nTargetB|RelayOther|Relay-Target-v6',
  })
  await page.goto('/')
  await expect(card(page).locator('[data-carrier-ping="unicom-latency"]')).toContainText('≈95 ms')
  await expect(card(page, 'TargetB').locator('[data-carrier-ping="unicom-latency"]')).toHaveAttribute('title', /中转：RelayOther/)
  await updateLiveState(page, { online: false })
  await expect(card(page).locator('[data-carrier-ping="unicom-latency"]')).toHaveAttribute('title', /中转节点离线/)
  await expect(card(page, 'TargetB').locator('[data-carrier-ping="unicom-latency"]')).toContainText('≈95 ms')
})

for (const width of [1280, 390]) {
  test(`transit desktop/mobile ${width}: estimates, histories and relay request dedupe`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    const requests: Array<{ method: string, params?: Record<string, unknown> }> = []
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('request', (request) => {
      if (request.url().endsWith('/rpc2') && request.method() === 'POST')
        requests.push(request.postDataJSON())
    })
    await installKomariFixture(page, { transit: true, hideEarth: true })
    await page.goto('/')
    await expect(card(page).locator('[data-carrier-ping="unicom-latency"]')).toContainText('≈95 ms')
    await expect(card(page).locator('[data-carrier-ping="unicom-loss"]')).toContainText('≈3.0%')
    await expect(card(page).getByText('中转估算', { exact: true })).toHaveCount(2)
    await expect(card(page).locator('[data-carrier-ping="unicom-latency"]')).toHaveAttribute('title', /中转：RelayNode[\s\S]*三网段：32 ms[\s\S]*中转段：63 ms/)
    await expect(card(page).locator('[data-carrier-ping="unicom-loss"]')).not.toHaveAttribute('title', /平均波动/)
    await expect(card(page).locator('[data-carrier-ping="unicom-latency"] [role="tooltip"]').filter({ hasText: '估算历史' })).toHaveCount(20)
    await expect(card(page, 'RelayNode').locator('[data-carrier-ping="unicom-latency"]')).toContainText('32 ms')
    await expect(card(page, 'RelayNode')).not.toContainText('≈')
    await expect(card(page, 'TargetB').locator('[data-carrier-ping="unicom-latency"]')).toContainText('≈95 ms')
    const relayQueries = requests.filter(request => request.method === 'public:queryMetrics' && request.params?.entity_id === '00000000-0000-4000-8000-000000000002')
    const relayStats = requests.filter(request => request.method === 'public:getPingMetricStats' && request.params?.entity_id === '00000000-0000-4000-8000-000000000002')
    expect(relayQueries).toHaveLength(1)
    expect(relayStats).toHaveLength(1)
    expect(requests.filter(request => request.method === 'public:getPublicPingTasks')).toHaveLength(1)
    expect(errors).toEqual([])
    expect(await page.locator('html').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  })
}

for (const scenario of [
  { name: 'disabled direct', options: { transitEnabled: false }, display: '32 ms', reason: '' },
  { name: 'unmatched direct', options: { transitRules: 'Other|RelayNode|Relay-Target-v6' }, display: '32 ms', reason: '' },
  { name: 'missing relay', options: { transitRules: 'TargetNode|AbsentRelay|Link' }, display: '--', reason: '未找到配置的中转节点' },
  { name: 'missing task', options: { transitRules: 'TargetNode|RelayNode|AbsentLink' }, display: '--', reason: '未找到中转链路 Ping 任务' },
  { name: 'offline relay', options: { relayOffline: true }, display: '--', reason: '中转节点离线' },
  { name: 'empty link', options: { transitEmptyLink: true }, display: '--', reason: '中转链路没有数据' },
  { name: 'legacy fallback', options: { transitLegacy: true }, display: '≈95 ms', reason: '中转：RelayNode' },
]) {
  test(`transit ${scenario.name}`, async ({ page }) => {
    await installKomariFixture(page, { transit: true, hideEarth: true, ...scenario.options })
    await page.goto('/')
    const row = card(page).locator('[data-carrier-ping="unicom-latency"]')
    await expect(row).toContainText(scenario.display)
    if (scenario.reason)
      await expect(row).toHaveAttribute('title', new RegExp(scenario.reason))
    else
      await expect(card(page)).not.toContainText('中转估算')
  })
}

test('transit missing one carrier leaves other carriers available', async ({ page }) => {
  await installKomariFixture(page, { transit: true, hideEarth: true, transitMissingCarrier: true })
  await page.goto('/')
  await expect(card(page).locator('[data-carrier-ping="unicom-latency"]')).toContainText('≈95 ms')
  await expect(card(page).locator('[data-carrier-ping="telecom-latency"]')).toContainText('--')
  await expect(card(page).locator('[data-carrier-ping="mobile-latency"]')).toContainText('≈115 ms')
})
