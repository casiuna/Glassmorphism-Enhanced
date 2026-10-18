import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './unit',
  testMatch: [
    'request-manager.spec.ts',
    'ping-cancellation.spec.ts',
    'history-range-fallback.spec.ts',
    'ping-chart-cache.spec.ts',
    'ping-chart.spec.ts',
    'node-ping-viewport.spec.ts',
  ],
  tsconfig: '../tsconfig.app.json',
  outputDir: '../test-results/request-manager',
  workers: 1,
  reporter: 'list',
})
