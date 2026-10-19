import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'
import { createServer } from 'vite'

// Protocol unit fixtures mirror the observed official void ACK; real-backend
// installation and settings readback are exercised separately in integration/.
interface Request { id: number, method: string }
type Reply = (request: Request) => unknown

async function runtime(useWebSocket: boolean, reply: Reply) {
  const root = fileURLToPath(new URL('../../', import.meta.url))
  const server = await createServer({
    root,
    configFile: false,
    envDir: false,
    optimizeDeps: { noDiscovery: true, include: [] },
    resolve: { alias: { '@': `${root}src` } },
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  })
  const descriptors = new Map(['fetch', 'WebSocket'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  class FixtureSocket {
    static OPEN = 1
    static CLOSED = 3
    static CONNECTING = 0
    readyState = 1
    onopen: (() => void) | null = null
    onerror: (() => void) | null = null
    onclose: (() => void) | null = null
    onmessage: ((event: { data: string }) => void) | null = null
    constructor() {
      queueMicrotask(() => this.onopen?.())
    }

    send(payload: string) {
      const request = JSON.parse(payload) as Request
      queueMicrotask(() => this.onmessage?.({ data: JSON.stringify(reply(request)) }))
    }

    close() {
      this.readyState = 3
      this.onclose?.()
    }
  }
  Object.defineProperty(globalThis, 'WebSocket', { configurable: true, value: FixtureSocket })
  Object.defineProperty(globalThis, 'fetch', { configurable: true, value: async (_url: string, init: RequestInit) => Response.json(reply(JSON.parse(String(init.body)))) })
  const { RpcClient } = await server.ssrLoadModule('/src/utils/rpc.ts') as typeof import('../../src/utils/rpc')
  const client = new RpcClient({ baseUrl: 'http://127.0.0.1:29999/api/rpc2', useWebSocket, timeout: 1000 })
  return {
    client,
    async close() {
      client.close()
      for (const [key, descriptor] of descriptors) {
        if (descriptor)
          Object.defineProperty(globalThis, key, descriptor)
        else
          Reflect.deleteProperty(globalThis, key)
      }
      await server.close()
    },
  }
}

for (const useWebSocket of [false, true]) {
  const label = useWebSocket ? 'WebSocket' : 'HTTP'
  test(`${label}: official settings success without result is a void ACK`, async () => {
    const r = await runtime(useWebSocket, ({ id }) => ({ jsonrpc: '2.0', id }))
    try {
      await expect(r.client.call('admin:editSettings', { visitor_audit_enabled: true })).resolves.toBeUndefined()
    }
    finally { await r.close() }
  })

  test(`${label}: a missing query payload is still an error, not fake data`, async () => {
    const r = await runtime(useWebSocket, ({ id }) => ({ jsonrpc: '2.0', id }))
    try {
      await expect(r.client.call('common:getNodes')).rejects.toMatchObject({ code: -32603 })
    }
    finally { await r.close() }
  })

  test(`${label}: real permission errors are never treated as successful saves`, async () => {
    const r = await runtime(useWebSocket, ({ id }) => ({ jsonrpc: '2.0', id, error: { code: 403, message: 'Permission denied' } }))
    try {
      await expect(r.client.call('admin:editSettings', {})).rejects.toMatchObject({ code: 403, message: 'Permission denied' })
    }
    finally { await r.close() }
  })

  test(`${label}: malformed protocol envelope remains invalid for void methods`, async () => {
    const r = await runtime(useWebSocket, ({ id }) => ({ jsonrpc: '1.0', id }))
    try {
      await expect(r.client.call('admin:editSettings', {})).rejects.toMatchObject({ code: -32603 })
    }
    finally { await r.close() }
  })

  test(`${label}: concurrent ACK and query retain per-request contracts`, async () => {
    const r = await runtime(useWebSocket, ({ id, method }) => method === 'admin:editSettings'
      ? { jsonrpc: '2.0', id }
      : { jsonrpc: '2.0', id, result: { version: 'protocol-fixture' } })
    try {
      const [ack, data] = await Promise.all([r.client.call('admin:editSettings', {}), r.client.call('public:getVersion')])
      expect(ack).toBeUndefined()
      expect(data).toEqual({ version: 'protocol-fixture' })
    }
    finally { await r.close() }
  })
}
