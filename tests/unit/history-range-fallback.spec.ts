import type { KomariApi } from '../../src/utils/api'
import type { RpcClient, StatusRecord } from '../../src/utils/rpc'
import { setImmediate } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'
import { createServer } from 'vite'
import { REQUEST_CONFIG } from '../../src/constants/request'

type RpcHandler = (method: string, params?: Record<string, unknown> | unknown[], signal?: AbortSignal) => Promise<unknown>
type ApiHandler = (uuid: string, hours: number, maxCount?: number, signal?: AbortSignal) => Promise<unknown>

const UUID = '00000000-0000-4000-8000-000000000001'
const START = new Date('2026-10-16T00:00:00Z')
const END = new Date('2026-10-16T01:00:00Z')
const RAW_RECORDS: Array<Partial<StatusRecord>> = [
  { client: UUID, time: END.toISOString(), cpu: Number.NaN, load: 2, net_total_up: 300, traffic_up: 12, traffic_down: -1 },
  { client: UUID, time: START.toISOString(), cpu: 3, load: 1, net_total_down: 400 },
  { client: '', time: START.toISOString() },
]

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

async function createRuntime() {
  const root = fileURLToPath(new URL('../../', import.meta.url))
  const server = await createServer({
    root,
    configFile: false,
    envDir: false,
    optimizeDeps: { noDiscovery: true, include: [] },
    resolve: { alias: { '@': `${root}src` } },
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  })
  const history = await server.ssrLoadModule('/src/services/history.service.ts') as typeof import('../../src/services/history.service')
  const { requestManager } = await server.ssrLoadModule('/src/services/request.service.ts') as typeof import('../../src/services/request.service')
  const { getSharedRpc, RpcError } = await server.ssrLoadModule('/src/utils/rpc.ts') as typeof import('../../src/utils/rpc')
  const { getSharedApi, ApiError } = await server.ssrLoadModule('/src/utils/api.ts') as typeof import('../../src/utils/api')
  const client = getSharedRpc().getClient()
  const api = getSharedApi()
  // Unconfigured calls fail locally; neither transport can reach a real server.
  client.call = async () => {
    throw new Error('Unexpected RPC call')
  }
  api.getLoadRecords = async () => {
    throw new Error('Unexpected API call')
  }

  return {
    history,
    requestManager,
    RpcError,
    ApiError,
    setRpcHandler(handler: RpcHandler) {
      client.call = handler as RpcClient['call']
    },
    setApiHandler(handler: ApiHandler) {
      api.getLoadRecords = handler as KomariApi['getLoadRecords']
    },
    async close() {
      requestManager.abortAll()
      await setImmediate()
      await server.close()
    },
  }
}

function expectNormalized(records: StatusRecord[]) {
  expect(records).toHaveLength(2)
  expect(records.map(record => record.time)).toEqual([START.toISOString(), END.toISOString()])
  expect(records[0]).toMatchObject({ cpu: 3, load: 1, load5: 1, net_total_down: 400 })
  expect(records[1]).toMatchObject({ cpu: 0, load: 2, load5: 2, net_total_up: 300, traffic_up: 12 })
  expect(records[1]?.traffic_down).toBeUndefined()
}

for (const fallback of ['rpc', 'api'] as const) {
  test(`range ${fallback} fallback completes while every request pool slot is occupied`, async () => {
    const runtime = await createRuntime()
    const blocker = deferred<string>()
    const requests: Promise<unknown>[] = []
    const rpcSignals: Array<AbortSignal | undefined> = []
    let apiCalls = 0
    let completed = false
    runtime.setRpcHandler(async (method, params, signal) => {
      expect(method).toBe('common:getRecords')
      if (!params || Array.isArray(params))
        throw new Error('Expected record query parameters')
      rpcSignals.push(signal)
      if (params.start || params.load_type === 'network')
        throw new runtime.RpcError(-32601, 'Network range records unsupported')
      expect(params).toMatchObject({ uuid: UUID, hours: 2, max_count: 150 })
      if (fallback === 'api')
        throw new runtime.RpcError(-32601, 'Generic records unsupported')
      return { records: { [UUID]: RAW_RECORDS } }
    })
    runtime.setApiHandler(async (uuid, hours, maxCount, signal) => {
      apiCalls += 1
      expect([uuid, hours, maxCount]).toEqual([UUID, 2, 150])
      expect(signal).toBe(rpcSignals[0])
      return { records: RAW_RECORDS }
    })

    try {
      // The range request owns the last slot; blockers stay unresolved throughout.
      requests.push(...Array.from({ length: REQUEST_CONFIG.pool.maxConcurrent - 1 }, (_, index) =>
        runtime.requestManager.run(`blocker:${index}`, () => blocker.promise, { retryAttempts: 0 })))
      const result = runtime.history.loadNodeLoadRecordsByRange(UUID, START, END, 150.9).then((records) => {
        completed = true
        return records
      })
      requests.push(result)
      await setImmediate()

      expect(completed).toBe(true)
      expectNormalized(await result)
      expect(rpcSignals).toHaveLength(3)
      expect(rpcSignals[0]).toBeDefined()
      expect(rpcSignals.every(signal => signal === rpcSignals[0])).toBe(true)
      expect(apiCalls).toBe(fallback === 'api' ? 1 : 0)
    }
    finally {
      const settled = Promise.allSettled(requests)
      runtime.requestManager.abortAll()
      blocker.resolve('released')
      await settled
      await runtime.close()
    }
  })
}

test('range abort reaches API fallback through the same attempt signal without retrying', async () => {
  const runtime = await createRuntime()
  const response = deferred<unknown>()
  const rpcSignals: Array<AbortSignal | undefined> = []
  let apiSignal: AbortSignal | undefined
  let apiCalls = 0
  runtime.setRpcHandler(async (_method, _params, signal) => {
    rpcSignals.push(signal)
    throw new runtime.RpcError(-32601, 'RPC history unsupported')
  })
  runtime.setApiHandler(async (_uuid, _hours, _maxCount, signal) => {
    apiCalls += 1
    apiSignal = signal
    return response.promise
  })

  const result = runtime.history.loadNodeLoadRecordsByRange(UUID, START, END)
  const settled = Promise.allSettled([result])
  try {
    await setImmediate()
    expect(apiCalls).toBe(1)
    expect(apiSignal).toBeDefined()
    expect(apiSignal === rpcSignals[0]).toBe(true)
    runtime.requestManager.abort(runtime.history.getNodeLoadRecordsRangeRequestKey(UUID, START.toISOString(), END.toISOString()))
    await expect(result).rejects.toMatchObject({ name: 'AbortError' })
    expect(apiSignal?.aborted).toBe(true)
    await setImmediate()
    expect(apiCalls).toBe(1)
  }
  finally {
    runtime.requestManager.abortAll()
    response.resolve({ records: RAW_RECORDS })
    await settled
    await runtime.close()
  }
})

for (const retryable of [true, false]) {
  test(`range compatibility fallback preserves retry policy (${retryable})`, async () => {
    const runtime = await createRuntime()
    let rpcCalls = 0
    let apiCalls = 0
    const failure = new runtime.ApiError('History unavailable', 'error', retryable ? 503 : 403)
    runtime.setRpcHandler(async () => {
      rpcCalls += 1
      throw new runtime.RpcError(-32601, 'RPC history unsupported')
    })
    runtime.setApiHandler(async () => {
      apiCalls += 1
      if (apiCalls === 1)
        throw failure
      return { records: RAW_RECORDS }
    })

    try {
      const result = runtime.history.loadNodeLoadRecordsByRange(UUID, START, END)
      if (retryable)
        expectNormalized(await result)
      else
        await expect(result).rejects.toBe(failure)
      expect(apiCalls).toBe(retryable ? 2 : 1)
      expect(rpcCalls).toBe(retryable ? 6 : 3)
    }
    finally {
      await runtime.close()
    }
  })
}
