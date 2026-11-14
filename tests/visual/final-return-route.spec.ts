import type { Page } from '@playwright/test'
import { createRequire } from 'node:module'
import { expect, test } from '@playwright/test'
import { installKomariFixture } from './fixtures/komari'

const require = createRequire(import.meta.url)
const { SCENARIOS, ORDER, auditSummary } = require('./fixtures/final-route.cjs')

const UUID = '00000000-0000-4000-8000-000000000001'
const AT = '2026-07-25T11:00:00Z'
const card = (page: Page) => page.getByRole('button', { name: '查看节点 主控-洛杉矶 详情', exact: true })
async function mount(page: Page, labels: Record<string, string>, width = 320, query = '') {
  await page.setViewportSize({ width, height: 1000 })
  const manual = Object.fromEntries(Object.entries(labels).map(([carrier, label]) => [carrier, { label, updatedAt: AT }]))
  await installKomariFixture(page, { hideEarth: true, dark: true, nodeCardSize: 'compact', themeSettings: { returnRoutesVisible: true, returnRouteConfig: JSON.stringify({ version: 1, nodes: { [UUID]: { manual } } }) } })
  await page.goto(`/${query}`)
  return card(page).locator('[data-route-summary]')
}
for (const width of [1440, 320]) {
  for (const [name, labels] of Object.entries(SCENARIOS) as Array<[string, Record<string, string>]>) {
    test(`final full labels ${name}/${width} have no operator text, ellipsis or clipped glyphs`, async ({ page }) => {
      const line = await mount(page, labels, width)
      await expect(line).toBeVisible()
      const report = await line.evaluate(auditSummary) as { carriers: string[], text: string, labels: Array<{ text: string, textOverflow: string, overflowX: string, whiteSpace: string, clippedCharacters: number, lines: number }>, rows: number, horizontalOverflow: boolean, textOverflowModes: string[], entryStyles: Array<{ background: string, border: string }>, markerClasses: string[] }
      expect(report.carriers).toEqual(ORDER.filter((c: string) => labels[c]))
      expect(report.text).not.toMatch(/回程|联通|电信|移动|\.\.\.|…/)
      expect(report.labels.map(value => value.text)).toEqual(ORDER.filter((c: string) => labels[c]).map((c: string) => labels[c]))
      expect(report.horizontalOverflow).toBe(false)
      expect(report.textOverflowModes).not.toContain('ellipsis')
      for (const value of report.labels) {
        expect(value.clippedCharacters).toBe(0)
        expect(value.overflowX).toBe('visible')
        expect(value.whiteSpace).not.toContain('nowrap')
      }
      for (const style of report.entryStyles) {
        expect(style.background).toBe('rgba(0, 0, 0, 0)')
        expect(style.border).toBe('0px')
      }
      const colors: Record<string, string> = { unicom: 'bg-red-', telecom: 'bg-blue-', mobile: 'bg-green-' }
      report.carriers.forEach((carrier, index) => expect(report.markerClasses[index]).toContain(colors[carrier]))
      if (width === 320 && name === 'long-wrap')
        expect(report.labels.some(value => value.lines > 1)).toBe(true)
      if (width === 320 && name === 'single-token')
        expect(report.labels[0]!.lines).toBeGreaterThan(1)
      for (const c of ['telecom', 'unicom', 'mobile']) {
        await expect(card(page).locator(`[data-carrier-ping="${c}-latency"]`)).toBeVisible()
        await expect(card(page).locator(`[data-carrier-ping="${c}-loss"]`)).toBeVisible()
      }
    })
  }
}
test('obsolete ping preview query cannot switch away from the selected final independent UI', async ({ page }) => {
  const line = await mount(page, SCENARIOS['short-three'], 390, '?return_route_preview=ping')
  await expect(line.locator('[data-return-carrier]')).toHaveCount(3)
  await expect(page.locator('[data-ping-route-carrier]')).toHaveCount(0)
})
test('English status placeholders are hidden rather than displayed or shortened', async ({ page }) => {
  await mount(page, { unicom: 'Mixed / Unknown / Expired', telecom: 'Expired', mobile: 'Unknown' })
  await expect(card(page).locator('[data-return-routes]')).toHaveCount(0)
})
