import { expect, test } from '@playwright/test'
import { installKomariFixture } from './fixtures/komari'

for (const scenario of [
  { name: 'desktop', width: 1440, height: 900, inset: 0, standalone: false },
  { name: 'mobile browser', width: 390, height: 844, inset: 0, standalone: false },
  { name: 'iPhone standalone safe-area simulation', width: 390, height: 844, inset: 47, standalone: true },
]) {
  test(`header remains clear in ${scenario.name}`, async ({ page }) => {
    await page.setViewportSize({ width: scenario.width, height: scenario.height })
    await page.addInitScript(({ standalone }) => {
      Object.defineProperty(navigator, 'standalone', { value: standalone })
    }, scenario)
    await installKomariFixture(page, { hideEarth: true })
    await page.goto('/')
    const header = page.locator('.site-header')
    await expect(header).toBeVisible()
    // Chromium cannot provide an iOS status bar. Inject only the environmental
    // inset via the CSS variable; exercise the real sticky header layout.
    if (scenario.inset) {
      await page.evaluate(inset => document.documentElement.style.setProperty('--header-safe-area-top', `${inset}px`), scenario.inset)
    }
    await expect(header).toHaveCSS('padding-top', `${scenario.inset}px`)
    const content = header.locator(':scope > div').first()
    await expect.poll(async () => (await content.boundingBox())!.y).toBe(scenario.inset)
    await expect(content).toHaveCSS('height', '56px')
    await page.evaluate(() => window.scrollTo(0, 400))
    await expect.poll(async () => (await content.boundingBox())!.y).toBe(scenario.inset)
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /viewport-fit=cover/)
  })
}

for (const loggedIn of [true, false]) {
  test(`admin navigation uses verified native session: loggedIn=${loggedIn}`, async ({ page }) => {
    await installKomariFixture(page, { loggedIn, hideEarth: true })
    const destinations: string[] = []
    page.on('request', (request) => {
      if (request.isNavigationRequest())
        destinations.push(new URL(request.url()).pathname)
    })
    await page.goto('/')
    if (loggedIn) {
      await page.route('**/admin', route => route.fulfill({ contentType: 'text/html', body: '<h1>Admin navigation target</h1>' }))
      await page.getByRole('button', { name: '后台管理', exact: true }).click()
      await expect(page).toHaveURL(/\/admin$/)
    }
    else {
      await page.getByRole('button', { name: '后台管理', exact: true }).click()
      await expect.poll(() => destinations.includes('/admin-app/index.html')).toBe(true)
      await expect(page).toHaveURL('http://127.0.0.1:4173/')
      expect(destinations).not.toContain('/admin')
      // This is the real bundled official frontend, not a theme login clone.
      await expect(page.getByRole('button', { name: /登录|Login|Log in/i }).first()).toBeVisible()
      await page.getByRole('button', { name: /登录|Login|Log in/i }).first().click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await page.route('**/api/login', route => route.fulfill({ json: { status: 'success' } }))
      await page.route('**/admin', route => route.fulfill({ contentType: 'text/html', body: '<h1>Native login return target</h1>' }))
      await page.getByPlaceholder('admin', { exact: true }).fill('fixture-admin')
      await page.locator('input[type="password"]').fill('fixture-only-password')
      await page.getByRole('dialog').getByRole('button', { name: /登录|Login|Log in/i }).click()
      await expect(page).toHaveURL(/\/admin$/)
    }
  })
}
