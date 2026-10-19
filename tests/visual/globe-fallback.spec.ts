import { expect, test } from '@playwright/test'
import { installKomariFixture } from './fixtures/komari'

for (const earthRenderer of ['realistic', 'cobe'] as const) {
  test(`${earthRenderer} degrades to the existing tiled map when WebGL is unavailable`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext
      HTMLCanvasElement.prototype.getContext = function (kind: string, ...args: unknown[]) {
        if (kind === 'webgl' || kind === 'webgl2' || kind === 'experimental-webgl')
          return null
        return Reflect.apply(original, this, [kind, ...args])
      } as typeof original
    })
    await installKomariFixture(page, { earthRenderer })
    await page.goto('/')
    await expect(page.locator('.earth-map')).toBeVisible()
    await expect(page.getByRole('img', { name: '真实地球贴图节点世界地图' })).toBeVisible()
    await expect(page.getByRole('button', { name: '查看节点 主控-洛杉矶 详情', exact: true })).toBeVisible()
    expect(errors).toEqual([])
  })
}
