import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'
import { createServer } from 'vite'

async function runtime(reply: unknown, status = 200) {
  const root = fileURLToPath(new URL('../../', import.meta.url))
  const server = await createServer({ root, configFile: false, envDir: false, optimizeDeps: { noDiscovery: true, include: [] }, resolve: { alias: { '@': `${root}src` } }, server: { middlewareMode: true, hmr: false, ws: false, watch: null } })
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'fetch')
  Object.defineProperty(globalThis, 'fetch', { configurable: true, value: async () => Response.json(reply, { status }) })
  const { KomariApi } = await server.ssrLoadModule('/src/utils/api.ts') as typeof import('../../src/utils/api')
  const api = new KomariApi({ baseUrl: 'http://127.0.0.1:29999/api' })
  return { api, async close() {
    if (descriptor)
      Object.defineProperty(globalThis, 'fetch', descriptor)
    else
      Reflect.deleteProperty(globalThis, 'fetch')
    await server.close()
  } }
}

test('native 1.6.0 managed-theme save omits data: accept ONLY this explicitly void ACK', async () => {
  const r = await runtime({ status: 'success', message: '' })
  try {
    await expect(r.api.updateThemeSettings('Enhanced', { preserve: 'existing-map' })).resolves.toBeUndefined()
  }
  finally { await r.close() }
})
test('missing data on a data-bearing REST query still fails instead of inventing public settings', async () => {
  const r = await runtime({ status: 'success', message: '' })
  try {
    await expect(r.api.getPublicSettings()).rejects.toThrow('Invalid API response')
  }
  finally { await r.close() }
})
test('a forbidden/error/failed-HTTP theme save is never a success acknowledgment', async () => {
  for (const [body, status] of [[{ status: 'error', message: 'Permission denied' }, 403], [{ status: 'success', message: '' }, 500]] as const) {
    const r = await runtime(body, status)
    try {
      await expect(r.api.updateThemeSettings('Enhanced', {})).rejects.toThrow()
    }
    finally { await r.close() }
  }
})
