import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { parseReturnRouteConfig, serializeReturnRoutes } from '../../src/utils/returnRoutes'
import { installKomariFixture } from './fixtures/komari'

const UUID = '00000000-0000-4000-8000-000000000001'
const AT = '2026-07-25T11:00:00Z'
const LONG = '很长的自定义标签'.repeat(24)
const SPECIAL = '<img src=x onerror=alert(1)> & "安全文本"'
const TAGS = `用户A<jade>;${LONG};${SPECIAL};upstream:RelayNode;route:internal; ;`
function card(page: Page) {
  return page.getByRole('button', { name: '查看节点 主控-洛杉矶 详情', exact: true })
}
function manualConfig(label = '管理员指定 & <线路>') {
  return JSON.stringify({ version: 1, nodes: { [UUID]: { manual: { telecom: { label, updatedAt: AT } } } } })
}

for (const scenario of [
  { name: 'desktop-light', width: 1440, height: 900, dark: false, size: 'compact' },
  { name: 'desktop-dark', width: 1440, height: 900, dark: true, size: 'compact' },
  { name: 'mobile-light', width: 390, height: 844, dark: false, size: 'compact' },
  { name: 'mobile-dark', width: 390, height: 844, dark: true, size: 'compact' },
  { name: 'mini-narrow', width: 320, height: 844, dark: false, size: 'mini' },
  { name: 'mini-dark', width: 390, height: 844, dark: true, size: 'mini' },
] as const) {
  test(`header pills and independent routes fit ${scenario.name}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: scenario.width, height: scenario.height })
    await installKomariFixture(page, {
      hideEarth: true,
      userTags: TAGS,
      dark: scenario.dark,
      nodeCardSize: scenario.size,
      multipleTelecomTasks: true,
      themeSettings: { returnRoutesVisible: true, returnRouteConfig: manualConfig() },
    })
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto('/')
    const node = card(page)
    const header = node.locator('[data-node-header-meta]')
    const tags = header.locator('[data-node-user-tag]')
    await expect(tags).toHaveCount(3)
    await expect(node.locator('[data-node-user-tag]')).toHaveCount(3)
    await expect(tags.nth(0)).toHaveText('用户A')
    await expect(tags.nth(1)).toHaveAttribute('title', LONG)
    await expect(tags.nth(2)).toHaveText(SPECIAL)
    await expect(tags.nth(2).locator('img')).toHaveCount(0)
    await expect(header).toContainText('在线')
    await expect(header).not.toContainText('upstream:')
    await expect(node.getByRole('button', { name: '收藏 主控-洛杉矶', exact: true })).toBeVisible()
    await expect(node.locator('img[alt="美国"]')).toBeVisible()
    await expect(node.locator('[data-return-carrier="telecom"]')).toContainText('管理员指定 & <线路>')
    await expect(node.locator('[data-return-carrier="unicom"]')).toContainText('未检测')
    for (const carrier of ['telecom', 'unicom', 'mobile']) {
      await expect(node.locator(`[data-carrier-ping="${carrier}-latency"]`)).toBeVisible()
      await expect(node.locator(`[data-carrier-ping="${carrier}-loss"]`)).toBeVisible()
    }
    const geometry = await header.evaluate((element) => {
      const left = element.firstElementChild!.getBoundingClientRect()
      const right = element.querySelector('[data-node-header-tags]')!.getBoundingClientRect()
      return { nonoverlap: left.right <= right.left + 1, within: right.right <= element.getBoundingClientRect().right + 1 }
    })
    expect(geometry).toEqual({ nonoverlap: true, within: true })
    await expect(page.locator('html')).toHaveJSProperty('scrollWidth', scenario.width)
    const screenshot = testInfo.outputPath(`${scenario.name}.png`)
    await node.screenshot({ path: screenshot, animations: 'disabled' })
    await testInfo.attach(scenario.name, { path: screenshot, contentType: 'image/png' })
    expect(errors).toEqual([])
  })
}

for (const visible of [true, false]) {
  test(`shared visibility controls card, list and detail: ${visible}`, async ({ page }) => {
    await installKomariFixture(page, { hideEarth: true, userTags: 'VISIBLE_USER;route:private', themeSettings: { customTagsVisible: visible, nodeListMetadataFields: 'tags' } })
    await page.goto('/')
    await expect(card(page)).toBeVisible()
    await expect(card(page).getByText('VISIBLE_USER', { exact: true })).toHaveCount(visible ? 1 : 0)
    await page.getByRole('button', { name: '列表视图', exact: true }).click()
    await expect(page.getByText('VISIBLE_USER', { exact: true })).toHaveCount(visible ? 1 : 0)
    await page.goto(`/instance/${UUID}`)
    await expect(page.getByRole('combobox', { name: '切换节点', exact: true })).toHaveValue(UUID)
    await expect(page.getByText('VISIBLE_USER', { exact: true })).toHaveCount(visible ? 1 : 0)
    await expect(page.getByText('route:private', { exact: true })).toHaveCount(0)
  })
}

test('empty tags leave no phantom pills; route feature is opt-in', async ({ page }) => {
  await installKomariFixture(page, { hideEarth: true, userTags: ' ; ;' })
  await page.goto('/')
  await expect(card(page)).toBeVisible()
  await expect(card(page).locator('[data-node-header-tags]')).toHaveCount(0)
  await expect(card(page).locator('[data-return-routes]')).toHaveCount(0)
})

test('list-specific visibility still overrides the global tags switch', async ({ page }) => {
  await installKomariFixture(page, { hideEarth: true, viewMode: 'list', userTags: 'LIST_PRIVATE', themeSettings: { customTagsVisible: true, nodeListMetadataFields: 'tags', nodeListCustomTagsVisible: false } })
  await page.goto('/')
  await expect(card(page)).toBeVisible()
  await expect(page.getByText('LIST_PRIVATE', { exact: true })).toHaveCount(0)
})

test('manual UUID configuration survives reload and a node rename', async ({ page }) => {
  await installKomariFixture(page, {
    hideEarth: true,
    firstNodeName: 'Renamed Wendy',
    themeSettings: { returnRoutesVisible: true, returnRouteConfig: manualConfig('唯一手动线路') },
  })
  await page.goto('/')
  const route = page.locator(`[data-route-node="${UUID}"]`)
  await expect(route).toContainText('唯一手动线路')
  await expect(route).toContainText('手动 · 2026-07-25 11:00 UTC')
  await expect(page.getByRole('button', { name: '查看节点 Renamed Wendy 详情', exact: true })).toBeVisible()
  await page.reload()
  await expect(route).toContainText('唯一手动线路')
  await page.goto(`/instance/${UUID}`)
  await expect(route).toContainText('唯一手动线路')
  await expect(route.locator('[data-return-carrier="telecom"]')).toHaveAttribute('data-route-status', 'manual')
})

test('fresh, unknown and expired evidence display separately without starting collection', async ({ page }) => {
  const collected = '2026-07-25T11:00:00Z'
  const make = (target: string, collectedAt: string, asns: number[]) => ({
    direction: 'node-to-cn',
    target,
    collectedAt,
    reachedTarget: true,
    hops: asns.map((asn, i) => ({ ttl: i + 1, asns: [asn] })),
  })
  const document = { version: 1, nodes: { [UUID]: { auto: {
    telecom: make('beijing-telecom', collected, [4134, 4134]),
    unicom: make('beijing-unicom', collected, [64500, 64500]),
    mobile: make('beijing-mobile', '2026-07-23T01:00:00Z', [9808, 9808]),
  } } } }
  await installKomariFixture(page, { hideEarth: true, themeSettings: {
    returnRoutesVisible: true,
    returnRouteAutoEnabled: true,
    returnRouteConfig: JSON.stringify(document),
  } })
  const dangerous: string[] = []
  page.on('request', (request) => {
    const body = request.postData() ?? ''
    if (/traceroute|admin:exec|ssh|return-route-probe|admin\/theme\/set/i.test(request.url() + body))
      dangerous.push(request.url())
  })
  await page.goto('/')
  const route = card(page).locator('[data-return-routes]')
  await expect(route.locator('[data-return-carrier="telecom"]')).toHaveAttribute('data-route-status', 'fresh-auto')
  await expect(route.locator('[data-return-carrier="telecom"]')).toContainText('163')
  await expect(route.locator('[data-return-carrier="unicom"]')).toContainText('未知')
  await expect(route.locator('[data-return-carrier="mobile"]')).toContainText('已过期')
  await expect(route).toContainText('自动 · 2026-07-25 11:00 UTC')
  expect(dangerous).toEqual([])
})

test('native theme-settings save contract round-trips a UUID override (mock only)', async ({ page }) => {
  // Exercise the documented 1.6.0 full-map HTTP contract, not a real DB write
  // or a claim that the official admin form was tested against a live backend.
  const settings: Record<string, unknown> = {
    returnRoutesVisible: true,
    returnRouteConfig: '{"version":1,"nodes":{}}',
    transitCarrierPingEnabled: false,
    transitCarrierPingRules: 'Relay|Target|Link',
    customTagsVisible: true,
  }
  await installKomariFixture(page, { hideEarth: true, themeSettings: settings })
  const writes: Record<string, unknown>[] = []
  await page.route('**/api/admin/theme/settings?theme=Enhanced', async (route) => {
    expect(route.request().method()).toBe('POST')
    const payload = route.request().postDataJSON() as Record<string, unknown>
    writes.push(payload)
    Object.assign(settings, payload)
    await route.fulfill({ json: { status: 'success', data: null } })
  })
  await page.goto('/')
  await expect(card(page).locator('[data-return-carrier="telecom"]')).toContainText('未检测')
  const normalized = serializeReturnRoutes(parseReturnRouteConfig(manualConfig('保存后的手动线路')).document)
  const payload = { ...settings, returnRouteConfig: normalized }
  const status = await page.evaluate(async (body) => {
    const response = await fetch('/api/admin/theme/settings?theme=Enhanced', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return response.status
  }, payload)
  expect(status).toBe(200)
  expect(writes).toEqual([payload])
  expect(writes[0]!.transitCarrierPingRules).toBe('Relay|Target|Link')
  await page.reload()
  await expect(card(page).locator('[data-return-carrier="telecom"]')).toContainText('保存后的手动线路')
})

test('invalid route JSON is visible as a configuration error, not a fabricated route', async ({ page }) => {
  await installKomariFixture(page, { hideEarth: true, themeSettings: { returnRoutesVisible: true, returnRouteConfig: '{broken' } })
  await page.goto('/')
  await expect(card(page).locator('[data-return-routes]')).toContainText('回程配置无效')
  await expect(card(page).locator('[data-return-carrier="telecom"]')).toContainText('未检测')
})
