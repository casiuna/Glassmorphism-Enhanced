import { createRequire } from 'node:module'
import { expect, test } from '@playwright/test'
import { installKomariFixture } from './fixtures/komari'

const require = createRequire(import.meta.url)
const { PREVIEW_SCENARIOS, ORDER, auditSummary, auditGrid } = require('./fixtures/final-route.cjs')

const UUID = '00000000-0000-4000-8000-000000000001'
const AT = '2026-07-25T11:00:00Z'
interface SummaryAudit {
  carriers: string[]
  labels: Array<{ text: string }>
  horizontalOverflow: boolean
  text: string
  textOverflowModes: string[]
}
interface GridAudit {
  display: string
  columns: number[]
  columnGap: string
  root: { width: number, height: number }
  maxWidthDelta: number
  sameLabelTop: boolean
  overlap: boolean
  cells: Array<{ carrier: string, column: string, centerError: number, positionError: number, markerCenterError: number, markerNameGap: number, lines: number, clippedCharacters: number, groupInsideCell: boolean, cell: { width: number } }>
}
for (const width of [1440, 320]) {
  for (const size of ['mini', 'compact'] as const) {
    for (const dark of [false, true]) {
      for (const [scenario, labels] of Object.entries(PREVIEW_SCENARIOS) as Array<[string, Record<string, string>]>) {
        test(`equal thirds ${scenario}/${width}/${size}/${dark ? 'dark' : 'light'} centers each dot-name group without wrapping`, async ({ page }) => {
          await page.setViewportSize({ width, height: 1000 })
          const manual = Object.fromEntries(Object.entries(labels).map(([carrier, label]) => [carrier, { label, updatedAt: AT }]))
          await installKomariFixture(page, { hideEarth: true, dark, nodeCardSize: size, themeSettings: { returnRoutesVisible: true, returnRouteConfig: JSON.stringify({ version: 1, nodes: { [UUID]: { manual } } }) } })
          await page.goto('/')
          const card = page.getByRole('button', { name: '查看节点 主控-洛杉矶 详情', exact: true })
          const line = card.locator('[data-route-summary]')
          await expect(line).toBeVisible()
          await page.evaluate(() => document.fonts.ready)
          const grid = await line.evaluate(auditGrid) as GridAudit
          const full = await line.evaluate(auditSummary) as SummaryAudit
          expect(grid.display).toBe('grid')
          expect(grid.columns).toHaveLength(3)
          expect(grid.columnGap).toBe('0px')
          expect(grid.maxWidthDelta).toBeLessThanOrEqual(0.1)
          expect(grid.sameLabelTop).toBe(true)
          expect(grid.overlap).toBe(false)
          expect(grid.root.height).toBe(16)
          expect(full.carriers).toEqual(ORDER)
          expect(full.labels.map((label: { text: string }) => label.text)).toEqual(ORDER.map((carrier: string) => labels[carrier]))
          expect(full.horizontalOverflow).toBe(false)
          expect(full.text).not.toMatch(/回程|联通|电信|移动|\.\.\.|…/)
          expect(full.textOverflowModes).not.toContain('ellipsis')
          for (const cell of grid.cells) {
            expect(Math.abs(cell.cell.width - grid.root.width / 3)).toBeLessThanOrEqual(0.1)
            expect(cell.column).toBe(String(ORDER.indexOf(cell.carrier) + 1))
            expect(cell.centerError).toBeLessThanOrEqual(0.1)
            expect(cell.positionError).toBeLessThanOrEqual(0.1)
            expect(cell.markerCenterError).toBeLessThanOrEqual(0.1)
            expect(cell.markerNameGap).toBe(3)
            expect(cell.lines).toBe(1)
            expect(cell.clippedCharacters).toBe(0)
            expect(cell.groupInsideCell).toBe(true)
            await expect(card.locator(`[data-carrier-ping="${cell.carrier}-latency"]`)).toBeVisible()
            await expect(card.locator(`[data-carrier-ping="${cell.carrier}-loss"]`)).toBeVisible()
          }
        })
      }
    }
  }
}
for (const [carrier, column] of [['telecom', '2'], ['mobile', '3']]) {
  test(`partial ${carrier} keeps column ${column} without manufacturing missing results`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 1000 })
    const manual = { [carrier!]: { label: 'CTGNET', updatedAt: AT } }
    await installKomariFixture(page, { hideEarth: true, themeSettings: { returnRoutesVisible: true, returnRouteConfig: JSON.stringify({ version: 1, nodes: { [UUID]: { manual } } }) } })
    await page.goto('/')
    const line = page.locator(`[data-route-node="${UUID}"] [data-route-summary]`)
    await expect(line.locator('[data-return-carrier]')).toHaveCount(1)
    const grid = await line.evaluate(auditGrid) as GridAudit
    expect(grid.columns).toHaveLength(3)
    expect(grid.cells[0]!.column).toBe(column)
    expect(grid.cells[0]!.positionError).toBeLessThanOrEqual(0.1)
    expect(grid.cells[0]!.centerError).toBeLessThanOrEqual(0.1)
    expect(grid.cells[0]!.clippedCharacters).toBe(0)
  })
}
