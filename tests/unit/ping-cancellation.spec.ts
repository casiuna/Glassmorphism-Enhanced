import type { EffectScope } from 'vue'
import type { PingRecord, PingTaskInfo, RpcClient } from '../../src/utils/rpc'
import { setImmediate } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'
import { createServer } from 'vite'
import { effectScope } from 'vue'

type RpcHandler = (method: string, params?: Record<string, unknown> | unknown[], signal?: AbortSignal) => Promise<unknown>

const UUID = '00000000-0000-4000-8000-000000000001'
const TIME = '2026-10-16T12:00:00Z'
const TASKS: PingTaskInfo[] = [{ id: 1, name: 'Test Ping', interval: 60, loss: 0 }]
const RECORDS: PingRecord[] = [
  { client: UUID, task_id: 1, time: TIME, value: 42 },
  { client: UUID, task_id: 1, time: TIME, value: -1 },
]

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

async function createRuntime() {
  // Transform the real Vite modules without listening, loading .env or using a browser.
  const root = fileURLToPath(new URL('../../', import.meta.url))
  const server = await createServer({
    root,
    configFile: false,
    envDir: false,
    optimizeDeps: { noDiscovery: true, include: [] },
    resolve: { alias: { '@': `${root}src` } },
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  })
  const scopes: EffectScope[] = []
  const history = await server.ssrLoadModule('/src/services/history.service.ts') as typeof import('../../src/services/history.service')
  const { useNodePingStats } = await server.ssrLoadModule('/src/composables/useNodePingStats.ts') as typeof import('../../src/composables/useNodePingStats')
  const { requestManager } = await server.ssrLoadModule('/src/services/request.service.ts') as typeof import('../../src/services/request.service')
  const { getSharedRpc, RpcError } = await server.ssrLoadModule('/src/utils/rpc.ts') as typeof import('../../src/utils/rpc')
  const client = getSharedRpc().getClient()

  return {
    history,
    RpcError,
    setHandler(handler: RpcHandler) {
      client.call = handler as RpcClient['call']
    },
    subscribe() {
      const scope = effectScope()
      scopes.push(scope)
      const stats = scope.run(() => useNodePingStats(UUID, { hours: 1, maxCount: 150 }))!
      return { stats, stop: () => scope.stop() }
    },
    async close() {
      scopes.forEach(scope => scope.stop())
      requestManager.abortAll()
      await setImmediate()
      await server.close()
    },
  }
}

test('Ping abort cancels both return-type keys, not another node', async () => {
  const runtime = await createRuntime()
  const payload = deferred<{ records: PingRecord[], tasks: PingTaskInfo[] }>()
  const signals: Array<AbortSignal | undefined> = []
  runtime.setHandler(async (method, _params, signal) => {
    expect(method).toBe('common:getRecords')
    signals.push(signal)
    return payload.promise
  })

  try {
    const records = runtime.history.loadPingRecords(1.9, 150.9, UUID)
    const withTasks = runtime.history.loadPingRecordsWithTasks(1.9, 150.9, UUID)
    const otherNode = runtime.history.loadPingRecordsWithTasks(1, 150, 'another-node')
    const settled = Promise.allSettled([records, withTasks, otherNode])
    expect(signals).toHaveLength(3)

    runtime.history.abortPingRecords(1, 150, UUID)
    expect(signals[0]?.aborted).toBe(true)
    expect(signals[1]?.aborted).toBe(true)
    expect(signals[2]?.aborted).toBe(false)

    payload.resolve({ records: RECORDS, tasks: TASKS })
    const outcomes = await settled
    expect(outcomes.slice(0, 2)).toMatchObject([
      { status: 'rejected', reason: { name: 'AbortError' } },
      { status: 'rejected', reason: { name: 'AbortError' } },
    ])
    await expect(otherNode).resolves.toEqual({ records: RECORDS, tasks: TASKS })
    await expect(runtime.history.loadPingRecords(1, 150, UUID)).resolves.toEqual(RECORDS)
    await expect(runtime.history.loadPingRecordsWithTasks(1, 150, UUID)).resolves.toEqual({ records: RECORDS, tasks: TASKS })
  }
  finally {
    payload.resolve({ records: RECORDS, tasks: TASKS })
    await runtime.close()
  }
})

test('resubscription starts a fresh load instead of reviving an obsolete legacy fallback', async () => {
  const runtime = await createRuntime()
  const publicTasks = deferred<PingTaskInfo[]>()
  let statsCalls = 0
  let legacyCalls = 0
  runtime.setHandler(async (method) => {
    if (method === 'public:getPublicPingTasks')
      return publicTasks.promise
    if (method === 'public:getPingMetricStats') {
      statsCalls += 1
      return {
        stats: statsCalls === 1
          ? []
          : [{
              entity_id: UUID,
              task_id: '1',
              name: 'Test Ping',
              tags: {},
              total: 1,
              valid: 1,
              loss: 0,
              loss_approximate: false,
              avg: 42,
              latest: 42,
            }],
      }
    }
    if (method === 'public:queryMetrics') {
      return {
        series: ['ping.latency_ms', 'ping.loss'].map(metric_key => ({
          metric_key,
          entity_id: UUID,
          tags: { task_id: '1' },
          points: [{ time: TIME, value: metric_key === 'ping.loss' ? 0 : 42, count: 1 }],
        })),
      }
    }
    if (method === 'common:getRecords') {
      legacyCalls += 1
      return { records: RECORDS, tasks: TASKS }
    }
    throw new Error(`Unexpected RPC method: ${method}`)
  })

  try {
    const first = runtime.subscribe()
    await setImmediate()
    expect(statsCalls).toBe(1)
    first.stop()
    const replacement = runtime.subscribe()
    publicTasks.resolve(TASKS)
    await setImmediate()

    expect(statsCalls).toBe(2)
    expect(legacyCalls).toBe(0)
    expect(replacement.stats.loading.value).toBe(false)
    expect(replacement.stats.error.value).toBeNull()
    expect(replacement.stats.avgLatency.value).toBe(42)
    expect(replacement.stats.avgLoss.value).toBe(0)
  }
  finally {
    publicTasks.resolve(TASKS)
    await runtime.close()
  }
})

for (const keepSubscriber of [false, true]) {
  test(`late legacy task metadata writes only with a live subscription (${keepSubscriber})`, async () => {
    const runtime = await createRuntime()
    const lateTasks = deferred<PingTaskInfo[]>()
    let taskCalls = 0
    runtime.setHandler(async (method) => {
      if (method === 'public:getPublicPingTasks') {
        taskCalls += 1
        if (taskCalls === 1)
          throw new runtime.RpcError(-32601, 'Tasks temporarily unavailable')
        return lateTasks.promise
      }
      if (method === 'public:getPingMetricStats')
        return { stats: [] }
      if (method === 'public:queryMetrics')
        return { series: [] }
      if (method === 'common:getRecords')
        return { records: RECORDS, tasks: [] }
      throw new Error(`Unexpected RPC method: ${method}`)
    })

    try {
      const first = runtime.subscribe()
      const remaining = keepSubscriber ? runtime.subscribe() : null
      await setImmediate()
      expect(taskCalls).toBe(2)
      first.stop()
      lateTasks.resolve(TASKS)
      await setImmediate()

      if (remaining) {
        expect(remaining.stats.hasData.value).toBe(true)
        expect(remaining.stats.avgLatency.value).toBe(42)
        expect(remaining.stats.avgLoss.value).toBe(50)
        expect(remaining.stats.taskStats.value[0]?.name).toBe('Test Ping')
      }
      else {
        // A new subscriber must not inherit data committed by the disposed load.
        const replacement = runtime.subscribe()
        expect(replacement.stats.hasData.value).toBe(false)
        expect(replacement.stats.loading.value).toBe(true)
      }
    }
    finally {
      lateTasks.resolve(TASKS)
      await runtime.close()
    }
  })
}
