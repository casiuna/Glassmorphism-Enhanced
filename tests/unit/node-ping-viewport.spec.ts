import type { ComponentOptions } from 'vue'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'
import vue from '@vitejs/plugin-vue'
import { useIntersectionObserver } from '@vueuse/core'
import { createServer } from 'vite'
import { createRenderer, h, nextTick, onScopeDispose, reactive, ssrContextKey, toValue, watch } from 'vue'

test.setTimeout(10_000)

interface HostNode {
  tag: string
  parent: HostNode | null
  children: HostNode[]
}

const hostNode = (tag = ''): HostNode => ({ tag, parent: null, children: [] })
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

async function createRuntime(kind: 'card' | 'list', supported: boolean) {
  const root = fileURLToPath(new URL('../../', import.meta.url))
  const active = new Set<string>()
  const events: string[] = []
  const observers: MockObserver[] = []
  class MockObserver {
    targets: HostNode[] = []
    disconnected = false
    constructor(readonly callback: IntersectionObserverCallback, readonly options: IntersectionObserverInit) {
      observers.push(this)
    }

    observe(target: HostNode) {
      this.targets.push(target)
    }

    disconnect() {
      this.disconnected = true
    }

    visible(isIntersecting: boolean) {
      this.callback([{ target: this.targets[0], isIntersecting } as unknown as IntersectionObserverEntry], this as unknown as IntersectionObserver)
    }
  }

  const windowMock = supported ? { IntersectionObserver: MockObserver } : {}
  const descriptors = ['IntersectionObserver', '__nodeViewportTest'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const)
  if (supported)
    Object.defineProperty(globalThis, 'IntersectionObserver', { configurable: true, value: MockObserver })
  else
    Reflect.deleteProperty(globalThis, 'IntersectionObserver')
  Object.defineProperty(globalThis, '__nodeViewportTest', {
    configurable: true,
    value: {
      observe(target: Parameters<typeof useIntersectionObserver>[0], callback: IntersectionObserverCallback, options: NonNullable<Parameters<typeof useIntersectionObserver>[2]>) {
        return useIntersectionObserver(target, callback, { ...options, window: windowMock as unknown as Window })
      },
      bind(uuid: () => string, enabled: () => boolean) {
        let current: string | undefined
        const release = () => {
          if (current) {
            events.push(`stop:${current}`)
            active.delete(current)
            current = undefined
          }
        }
        watch([() => toValue(uuid), () => toValue(enabled)], ([id, on]) => {
          const next = on ? id : undefined
          if (next === current)
            return
          release()
          if (next) {
            current = next
            active.add(next)
            events.push(`start:${next}`)
          }
        }, { immediate: true })
        onScopeDispose(release)
      },
    },
  })
  const virtual = 'virtual:node-viewport-'
  const aliases = [
    { find: '@vueuse/core', replacement: `${virtual}observer` },
    { find: '@/composables/useNodeCarrierPingSource', replacement: `${virtual}ping` },
    { find: '@/composables/useNodePingDisplay', replacement: `${virtual}ping` },
    { find: '@/stores/app', replacement: `${virtual}store` },
    { find: /^@\/components\/ui\/.*/, replacement: `${virtual}ui` },
    { find: '@iconify/vue', replacement: `${virtual}ui` },
    { find: '@', replacement: `${root}src` },
  ]
  const server = await createServer({
    root,
    configFile: false,
    envDir: false,
    optimizeDeps: { noDiscovery: true, include: [] },
    resolve: { alias: aliases },
    plugins: [{
      name: 'node-viewport-test',
      resolveId(id) {
        if (id.startsWith(virtual))
          return `\0${id}`
      },
      load(id) {
        if (id === `\0${virtual}observer`)
          return 'export const useIntersectionObserver = (...args) => globalThis.__nodeViewportTest.observe(...args);'
        if (id === `\0${virtual}ping`) {
          return `export function useNodeCarrierPingSource(node, enabled) { globalThis.__nodeViewportTest.bind(() => node().uuid, enabled); return { carrierDisplays: [], isTransit: false }; }
export function useNodePingDisplay(uuid, options) { globalThis.__nodeViewportTest.bind(uuid, options.enabled); return { latencyRenderBars: [], lossRenderBars: [] }; }`
        }
        if (id === `\0${virtual}store`)
          return 'export const useAppStore = () => ({ isFavoriteNode: () => false });'
        if (id === `\0${virtual}ui`)
          return 'export const Icon = {}, Badge = {}, CardX = {}, DataTooltip = {}, ProgressThin = {};'
      },
    }, vue()],
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  })
  const name = kind === 'card' ? 'NodeCard' : 'NodePingListCell'
  const { default: Component } = await server.ssrLoadModule(`/src/components/${name}.vue`) as { default: ComponentOptions }
  // Keep the real setup/lifecycle; only the heavy visual rendering is replaced.
  const CardRoot = { render: () => h('div') }
  const component = {
    ...Component,
    render: () => kind === 'card' ? h(CardRoot, { ref: 'pingRoot' }) : h('button', { ref: 'pingRoot' }),
  }
  const props = reactive({ node: { uuid: 'node-a' }, uuid: 'node-a', online: true, enabled: true, pingEnabled: true })
  const app = renderer.createApp({ setup: () => () => h(component, props) })
  app.provide(ssrContextKey, {})
  app.mount(hostNode())
  await nextTick()

  return {
    props,
    active,
    events,
    observers,
    setUuid(uuid: string) {
      props.uuid = uuid
      props.node = { uuid }
    },
    setEnabled(enabled: boolean) {
      props.enabled = enabled
      props.pingEnabled = enabled
    },
    async close() {
      app.unmount()
      await nextTick()
      await server.close()
      for (const [key, descriptor] of descriptors) {
        if (descriptor)
          Object.defineProperty(globalThis, key, descriptor)
        else
          Reflect.deleteProperty(globalThis, key)
      }
    },
  }
}

for (const kind of ['card', 'list'] as const) {
  test(`${kind} subscribes only near viewport and respects UUID and parent enabled changes`, async () => {
    const runtime = await createRuntime(kind, true)
    try {
      expect([...runtime.active]).toEqual([])
      expect(runtime.observers).toHaveLength(1)
      const observer = runtime.observers[0]!
      expect(observer.options.rootMargin).toBe('200px 0px')
      expect(observer.targets[0]?.tag).toBe(kind === 'card' ? 'div' : 'button')
      observer.visible(true)
      await nextTick()
      expect([...runtime.active]).toEqual(['node-a'])
      observer.visible(false)
      await nextTick()
      expect([...runtime.active]).toEqual([])
      const count = runtime.events.length
      runtime.setUuid('node-b')
      await nextTick()
      expect(runtime.events).toHaveLength(count)
      observer.visible(true)
      await nextTick()
      expect([...runtime.active]).toEqual(['node-b'])
      runtime.setUuid('node-c')
      await nextTick()
      expect(runtime.events.slice(-2)).toEqual(['stop:node-b', 'start:node-c'])
      runtime.setEnabled(false)
      await nextTick()
      expect([...runtime.active]).toEqual([])
      observer.visible(false)
      runtime.setEnabled(true)
      await nextTick()
      expect([...runtime.active]).toEqual([])
      observer.visible(true)
      await nextTick()
      expect([...runtime.active]).toEqual(['node-c'])
    }
    finally {
      await runtime.close()
    }
    expect([...runtime.active]).toEqual([])
    expect(runtime.observers.every(observer => observer.disconnected)).toBe(true)
  })

  test(`${kind} without IntersectionObserver falls back on, still respecting parent disable`, async () => {
    const runtime = await createRuntime(kind, false)
    try {
      expect(runtime.observers).toHaveLength(0)
      expect([...runtime.active]).toEqual(['node-a'])
      runtime.setEnabled(false)
      await nextTick()
      expect([...runtime.active]).toEqual([])
      runtime.setUuid('node-b')
      await nextTick()
      expect([...runtime.active]).toEqual([])
      runtime.setEnabled(true)
      await nextTick()
      expect([...runtime.active]).toEqual(['node-b'])
    }
    finally {
      await runtime.close()
    }
    expect([...runtime.active]).toEqual([])
  })
}
