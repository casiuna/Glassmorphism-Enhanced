import type { VisualFixtureOptions } from './fixtures/komari'
import { expect, test } from '@playwright/test'
import { installKomariFixture } from './fixtures/komari'

const UUID = '00000000-0000-4000-8000-000000000001'
const OTHER = '00000000-0000-4000-8000-000000000002'
const AT = '2026-07-25T11:00:00Z'
const labels = { unicom: '9929', telecom: 'CN2', mobile: 'CMI' }
const manual = Object.fromEntries(Object.entries(labels).map(([key, label]) => [key, { label, updatedAt: AT }]))
const doc = (node: object, extra = {}) => JSON.stringify({ version: 1, nodes: { [UUID]: node, ...extra } })
const card = (page: import('@playwright/test').Page) => page.getByRole('button', { name: '查看节点 主控-洛杉矶 详情', exact: true })
const observed = (status = 'ok', collectedAt = AT, source = 'helper') => ({ direction: 'node-to-cn', target: 'beijing-telecom', collectedAt, reachedTarget: true, status, source, hops: [{ ttl: 1, asns: [4134], ips: ['192.0.2.77'], asnSource: 'traceroute' }, { ttl: 2, asns: [4134], ips: ['219.141.140.10'], asnSource: 'traceroute' }] })

for (const size of ['mini', 'compact', 'comfortable', 'large'] as const) {
  for (const width of [1440, 390, 320]) {
    for (const dark of [false, true]) {
      test(`inline route summary ${size}/${width}/${dark ? 'dark' : 'light'} stays one neutral row`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 })
        await installKomariFixture(page, { hideEarth: true, nodeCardSize: size, dark, themeSettings: { returnRoutesVisible: true, returnRouteConfig: doc({ manual }) } })
        await page.goto('/')
        const node = card(page)
        const line = node.locator('[data-route-summary]')
        await expect(line).toBeVisible()
        expect(await line.locator('[data-return-carrier]').evaluateAll(els => els.map(el => el.getAttribute('data-return-carrier')))).toEqual(['unicom', 'telecom', 'mobile'])
        for (const [carrier, label] of Object.entries(labels)) {
          await expect(line.locator(`[data-return-carrier="${carrier}"]`)).toContainText(label)
          await expect(node.locator(`[data-carrier-ping="${carrier}-latency"]`)).toBeVisible()
          await expect(node.locator(`[data-carrier-ping="${carrier}-loss"]`)).toBeVisible()
        }
        const layout = await line.evaluate((element) => {
          const bounds = element.getBoundingClientRect()
          const carriers = [...element.querySelectorAll<HTMLElement>('[data-return-carrier]')]
          const markerColors = Array.from(element.querySelectorAll('[data-carrier-marker]'), e => getComputedStyle(e).backgroundColor)
          const neutral = carriers.every((e) => {
            const s = getComputedStyle(e)
            return s.backgroundColor === 'rgba(0, 0, 0, 0)' && Number.parseFloat(s.borderTopWidth) === 0
          })
          return { height: bounds.height, rows: new Set(carriers.map(e => Math.round(e.getBoundingClientRect().top))).size, neutral, markerColors, text: element.textContent }
        })
        expect(layout.height).toBeLessThanOrEqual(18)
        expect(layout.rows).toBe(1)
        expect(layout.neutral).toBe(true)
        expect(new Set(layout.markerColors).size).toBe(3)
        expect(layout.text).not.toMatch(/未知|过期|未测|UTC|回程|联通|电信|移动|\.\.\.|…/)
        await expect(node.locator('summary,[data-route-details],time,pre')).toHaveCount(0)
        await expect(page.locator('html')).toHaveJSProperty('scrollWidth', width)
      })
    }
  }
}

for (const [name, node] of [
  ['empty', {}],
  ['unknown', { auto: { telecom: { ...observed(), status: 'unknown', hops: [] } } }],
  ['expired', { auto: { telecom: observed('ok', '2026-07-20T11:00:00Z') } }],
  ['failed', { auto: { telecom: observed('permission-denied') } }],
  ['fixture', { auto: { telecom: observed('ok', AT, 'fixture') } }],
] as const) {
  test(`no valid ${name} route leaves no front-card region or placeholder height`, async ({ page }) => {
    const options: VisualFixtureOptions = { hideEarth: true, loggedIn: true, themeSettings: { returnRoutesVisible: true, returnRouteAutoEnabled: true, returnRouteConfig: doc(node) } }
    await installKomariFixture(page, options)
    await page.goto('/')
    await expect(card(page)).toBeVisible()
    await expect(card(page).locator('[data-return-routes],[data-return-carrier],[data-route-details]')).toHaveCount(0)
    await expect(card(page)).not.toContainText('未知')
    for (const carrier of ['telecom', 'unicom', 'mobile'])
      await expect(card(page).locator(`[data-carrier-ping="${carrier}-latency"]`)).toBeVisible()
  })
}

test('guest sees only explicit manual labels, no inline auto ASN/IP/time and no private requests on home or detail', async ({ page }) => {
  const requests: string[] = []
  page.on('request', (r) => {
    if (/enhanced-route-probe|admin:listPlugins|admin:getPlugin/.test(r.url() + (r.postData() ?? '')))
      requests.push(r.url())
  })
  await installKomariFixture(page, { hideEarth: true, themeSettings: { returnRoutesVisible: true, returnRouteAutoEnabled: true, returnRouteCompanionEnabled: true, returnRouteConfig: doc({ manual: { unicom: manual.unicom }, auto: { telecom: observed() } }, { [OTHER]: { auto: { telecom: observed() } } }) } })
  await page.goto('/')
  const region = page.locator(`[data-route-node="${UUID}"]`)
  await expect(region.locator('[data-return-carrier="unicom"]')).toHaveText('9929')
  await expect(region.locator('[data-return-carrier="telecom"]')).toHaveCount(0)
  await expect(region.locator('summary,time,pre,[data-route-details]')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('192.0.2.77')
  await expect(page.locator('body')).not.toContainText('AS4134')
  await page.goto(`/instance/${UUID}`)
  await expect(region.locator('[data-return-carrier="unicom"]')).toBeVisible()
  await expect(region.locator('[data-return-carrier="telecom"]')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('192.0.2.77')
  await expect(page.locator('body')).not.toContainText('AS4134')
  expect(requests).toEqual([])
})

test('one manual carrier does not invent two others and another UUID remains isolated', async ({ page }) => {
  await installKomariFixture(page, { hideEarth: true, themeSettings: { returnRoutesVisible: true, returnRouteConfig: doc({ manual: { mobile: manual.mobile } }) } })
  await page.goto('/')
  await expect(card(page).locator('[data-return-carrier]')).toHaveCount(1)
  await expect(card(page).locator('[data-return-carrier="mobile"]')).toHaveText('CMI')
  await expect(page.locator(`[data-route-node="${OTHER}"]`)).toHaveCount(0)
})

test('long custom labels remain escaped and contained in narrow mini cards', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 })
  const label = '<img src=x onerror=window.__inlinePwned=1> 很长的线路说明'
  await installKomariFixture(page, { hideEarth: true, nodeCardSize: 'mini', themeSettings: { returnRoutesVisible: true, returnRouteConfig: doc({ manual: { ...manual, telecom: { label, updatedAt: AT } } }) } })
  await page.goto('/')
  const line = card(page).locator('[data-route-summary]')
  await expect(line.locator('[data-return-carrier="telecom"]')).toContainText(label)
  await expect(line.locator('img')).toHaveCount(0)
  await expect(page.locator('html')).toHaveJSProperty('scrollWidth', 320)
  expect(await page.evaluate(() => '__inlinePwned' in window)).toBe(false)
})

test('valid current automatic observation is administrator-only and retains private expanded evidence', async ({ page }) => {
  await installKomariFixture(page, { hideEarth: true, loggedIn: true, themeSettings: { returnRoutesVisible: true, returnRouteAutoEnabled: true, returnRouteConfig: doc({ auto: { telecom: observed() } }) } })
  await page.goto('/')
  const region = card(page).locator('[data-return-routes]')
  await expect(region.locator('[data-return-carrier="telecom"]')).toHaveText('163')
  await expect(region.locator('[data-return-carrier="telecom"]')).toHaveAttribute('data-route-status', 'fresh-auto')
  await expect(region.locator('[data-route-details]')).not.toBeVisible()
  await region.locator('summary').click()
  await expect(region.locator('[data-route-details]')).toBeVisible()
  await expect(region.locator('pre')).toContainText('192.0.2.77')
  await expect(region.locator('[data-route-details]')).toContainText('2026-07-25 11:00 UTC')
  await expect(region.locator('[data-route-summary]')).not.toContainText('192.0.2.77')
})
