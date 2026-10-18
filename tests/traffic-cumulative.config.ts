import { fileURLToPath } from 'node:url'
import { defineConfig } from '@playwright/test'
import base from '../playwright.config'

export default defineConfig({
  ...base,
  testDir: './visual',
  testMatch: ['traffic.spec.ts', 'traffic-cumulative-views.spec.ts'],
  tsconfig: '../tsconfig.app.json',
  outputDir: '../test-results/traffic-cumulative',
  reporter: 'list',
  retries: 0,
  use: { ...base.use, baseURL: 'http://127.0.0.1:4175' },
  webServer: {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    command: 'node --input-type=module -e \'import { createServer } from "vite"; globalThis.__dirname = process.cwd(); const server = await createServer({ configLoader: "runner", cacheDir: "test-results/traffic-cumulative-vite", server: { host: "127.0.0.1", port: 4175, strictPort: true } }); await server.listen();\'',
    url: 'http://127.0.0.1:4175',
    reuseExistingServer: false,
    timeout: 30_000,
  },
})
