import type { ComponentOptions } from 'vue'
import type { PingRecord, PingTaskInfo, RpcClient } from '../../src/utils/rpc'
import { setImmediate } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'
import vue from '@vitejs/plugin-vue'
import { createServer } from 'vite'
import { createRenderer, nextTick, ssrContextKey } from 'vue'

interface HostNode {
  parent: HostNode | null
  children: HostNode[]
}

interface ChartState {
  selectedView: string
  customStartInput: string
  customEndInput: string
  remoteData: PingRecord[]
  tasks: PingTaskInfo[]
  loading: boolean
  error: string | null
  legacyCustomRangeFallback: boolean
  fetchRecords: () => Promise<void>
}

type RpcHandler = (method: string, params?: Record<string, unknown> | unknown[], signal?: AbortSignal) => Promise<unknown>

const UUID = '00000000-0000-4000-8000-000000000001'
const TIME = '2026-10-16T00:00:00Z'
const TASKS: PingTaskInfo[] = [{ id: 1, name: 'Test Ping', interval: 60, loss: 50 }]
const hostNode = (): HostNode => ({ parent: null, children: [] })
const renderer = createRenderer<HostNode, HostNode>({
  createElement: hostNode,
  createText: hostNode,
  createComment: hostNode,
  insert(child, parent) {
    child.parent = parent
    parent.children.push(child)
  },
  remove(child) {
    child.parent?.children.splice(child.parent.children.indexOf(child), 1)
    child.parent = null
  },
  parentNode: node => node.parent,
  nextSibling: () => null,
  patchProp() {},
  setText() {},
  setElementText() {},
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

async function createRuntime() {
  const root = fileURLToPath(new URL('../../', import.meta.url))
  const ui = 'virtual:ping-chart-ui'
  const store = 'virtual:ping-chart-store'
  const uiNames = ['Icon', 'Button', 'Empty', 'Input', 'Spinner', 'Tabs', 'TabsList', 'TabsTrigger', 'Tooltip', 'TooltipContent', 'TooltipProvider', 'TooltipTrigger']
  const server = await createServer({
    root,
    configFile: false,
    envDir: false,
    optimizeDeps: { noDiscovery: true, include: [] },
    resolve: {
      alias: [
        { find: '@/stores/app', replacement: store },
        { find: /^@\/components\/ui\/.*/, replacement: ui },
        { find: '@/utils/echarts', replacement: ui },
        { find: 'vue-echarts', replacement: ui },
        { find: '@iconify/vue', replacement: ui },
        { find: '@', replacement: `${root}src` },
      ],
    },
    plugins: [
      {
        name: 'ping-chart-test-ui',
        resolveId(id) {
          if (id === ui || id === store)
            return `\0${id}`
        },
        load(id) {
          if (id === `\0${ui}`)
            return `const Stub = { render: () => null }; export default Stub; ${uiNames.map(name => `export const ${name} = Stub;`).join(' ')}`
          if (id === `\0${store}`)
            return 'export const useAppStore = () => ({ isDark: false, colorVisionFriendly: false, publicSettings: { ping_record_preserve_time: 168 } });'
        },
      },
      vue(),
    ],
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  })
  const { default: Chart } = await server.ssrLoadModule('/src/components/PingChart.vue') as { default: ComponentOptions }
  const { getSharedRpc, RpcError } = await server.ssrLoadModule('/src/utils/rpc.ts') as typeof import('../../src/utils/rpc')
  const { requestManager } = await server.ssrLoadModule('/src/services/request.service.ts') as typeof import('../../src/services/request.service')
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) },
  })
  const apps: Array<ReturnType<typeof renderer.createApp>> = []
  getSharedRpc().getClient().call = async () => {
    throw new Error('Unexpected RPC call')
  }

  return {
    RpcError,
    setHandler(handler: RpcHandler) {
      getSharedRpc().getClient().call = handler as RpcClient['call']
    },
    mount(uuid = UUID) {
      // Execute the real SFC setup/lifecycle with only its visual rendering stubbed.
      const app = renderer.createApp({ ...Chart, render: () => null }, { uuid })
      apps.push(app)
      app.provide(ssrContextKey, {})
      app.mount(hostNode())
      const state = (app._instance as unknown as { setupState: ChartState }).setupState
      expect(typeof state.fetchRecords).toBe('function')
      return { state, unmount: () => app.unmount() }
    },
    async close() {
      apps.forEach(app => app._instance && app.unmount())
      requestManager.abortAll()
      await setImmediate()
      if (windowDescriptor)
        Object.defineProperty(globalThis, 'window', windowDescriptor)
      else
        Reflect.deleteProperty(globalThis, 'window')
      await server.close()
    },
  }
}

function installResponses(runtime: Awaited<ReturnType<typeof createRuntime>>, mode: 'metric' | 'legacy' | 'empty' | 'error') {
  const calls: Array<{ method: string, params?: Record<string, unknown> | unknown[] }> = []
  runtime.setHandler(async (method, params) => {
    calls.push({ method, params })
    const uuid = params && !Array.isArray(params) ? String(params.entity_id ?? params.uuid ?? UUID) : UUID
    if (method === 'public:getPublicPingTasks')
      return TASKS
    if (mode === 'error')
      throw new runtime.RpcError(403, 'History unavailable')
    if (method === 'public:getPingMetricStats') {
      return {
        stats: mode === 'metric'
          ? [{ entity_id: uuid, task_id: '1', name: 'Test Ping', interval: 60, total: 2, valid: 1, loss: 50, avg: 42, latest: 42, loss_approximate: false }]
          : [],
      }
    }
    if (method === 'public:queryMetrics') {
      return {
        series: mode === 'metric'
          ? [{ metric_key: 'ping.latency_ms', entity_id: uuid, tags: { task_id: '1' }, points: [{ time: TIME, value: 42 }] }]
          : [],
      }
    }
    if (method === 'common:getRecords') {
      return mode === 'empty'
        ? { records: [], tasks: [] }
        : { records: [{ client: uuid, task_id: 1, time: TIME, value: 42 }], tasks: TASKS }
    }
    throw new Error(`Unexpected RPC method: ${method}`)
  })
  return calls
}

for (const mode of ['metric', 'legacy'] as const) {
  test(`reopening a complete ${mode} chart uses fresh history without new data requests`, async () => {
    const runtime = await createRuntime()
    const calls = installResponses(runtime, mode)
    try {
      const first = runtime.mount()
      await setImmediate()
      expect(first.state.loading).toBe(false)
      expect(first.state.remoteData[0]?.value).toBe(42)
      expect(first.state.tasks[0]?.loss).toBe(50)
      first.state.remoteData[0]!.value = 999
      first.unmount()
      const count = calls.length
      const second = runtime.mount()
      await setImmediate()
      expect(second.state.remoteData[0]?.value).toBe(42)
      expect(second.state.error).toBeNull()
      expect(calls).toHaveLength(count)
    }
    finally {
      await runtime.close()
    }
  })
}

test('chart request caching separates UUIDs, preset hours and custom start/end', async () => {
  const runtime = await createRuntime()
  const calls = installResponses(runtime, 'metric')
  const dataCalls = () => calls.filter(call => call.method === 'public:queryMetrics')
  try {
    const first = runtime.mount()
    await setImmediate()
    first.state.selectedView = '6 小时'
    await nextTick()
    await setImmediate()
    expect(dataCalls()).toHaveLength(2)
    first.state.selectedView = '1 小时'
    await nextTick()
    await setImmediate()
    expect(dataCalls()).toHaveLength(2)
    runtime.mount('00000000-0000-4000-8000-000000000002')
    await setImmediate()
    expect(dataCalls()).toHaveLength(3)

    first.state.customStartInput = '2026-10-16T00:00'
    first.state.customEndInput = '2026-10-16T01:00'
    first.state.selectedView = '自定义'
    await nextTick()
    await setImmediate()
    expect(dataCalls()).toHaveLength(4)
    first.state.customEndInput = '2026-10-16T02:00'
    await first.state.fetchRecords()
    expect(dataCalls()).toHaveLength(5)
    first.state.customEndInput = '2026-10-16T01:00'
    await first.state.fetchRecords()
    expect(dataCalls()).toHaveLength(5)
    expect(dataCalls().every(call => !Array.isArray(call.params) && call.params?.max_points === 6000)).toBe(true)
  }
  finally {
    await runtime.close()
  }
})

for (const stage of ['metric', 'legacy'] as const) {
  test(`unmounting during ${stage} loading prevents late fallback and state writes`, async () => {
    const runtime = await createRuntime()
    const pending = deferred<unknown>()
    let legacyCalls = 0
    runtime.setHandler(async (method) => {
      if (method === 'public:getPublicPingTasks')
        return TASKS
      if (method === 'public:getPingMetricStats')
        return { stats: [] }
      if (method === 'public:queryMetrics')
        return stage === 'metric' ? pending.promise : { series: [] }
      if (method === 'common:getRecords') {
        legacyCalls += 1
        return pending.promise
      }
      throw new Error(`Unexpected RPC method: ${method}`)
    })
    try {
      const chart = runtime.mount()
      await setImmediate()
      const records = chart.state.remoteData
      const tasks = chart.state.tasks
      const count = legacyCalls
      expect(chart.state.loading).toBe(true)
      chart.unmount()
      pending.resolve(stage === 'metric'
        ? { series: [] }
        : { records: [{ client: UUID, task_id: 1, time: TIME, value: 42 }], tasks: TASKS })
      await setImmediate()
      expect(legacyCalls).toBe(count)
      expect(chart.state.remoteData === records).toBe(true)
      expect(chart.state.tasks === tasks).toBe(true)
      expect(chart.state.loading).toBe(true)
      expect(chart.state.error).toBeNull()
    }
    finally {
      pending.resolve({ records: [], tasks: [], series: [] })
      await runtime.close()
    }
  })
}

for (const mode of ['empty', 'error'] as const) {
  test(`${mode} chart responses are not cached`, async () => {
    const runtime = await createRuntime()
    const calls = installResponses(runtime, mode)
    try {
      const first = runtime.mount()
      await setImmediate()
      first.unmount()
      const second = runtime.mount()
      await setImmediate()
      expect(second.state.remoteData).toEqual([])
      expect(calls.filter(call => call.method === 'public:queryMetrics')).toHaveLength(2)
      expect(calls.filter(call => call.method === 'public:getPingMetricStats')).toHaveLength(2)
      expect(calls.filter(call => call.method === 'common:getRecords')).toHaveLength(2)
    }
    finally {
      await runtime.close()
    }
  })
}
