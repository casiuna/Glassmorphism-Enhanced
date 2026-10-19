import { expect, test } from '@playwright/test'
import { supportsGlobeRenderer } from '../../src/utils/globeCapability'

const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
test.afterEach(() => {
  if (originalDocument)
    Object.defineProperty(globalThis, 'document', originalDocument)
  else
    Reflect.deleteProperty(globalThis, 'document')
})

test('SSR does not require a canvas or pretend to support WebGL', () => {
  Reflect.deleteProperty(globalThis, 'document')
  expect(supportsGlobeRenderer('realistic')).toBe(false)
  expect(supportsGlobeRenderer('cobe')).toBe(false)
})

for (const renderer of ['realistic', 'cobe'] as const) {
  test(`${renderer}: release the capability probe context after successful detection`, () => {
    let released = 0
    Object.defineProperty(globalThis, 'document', { configurable: true, value: {
      createElement: () => ({ getContext: () => ({ getExtension: () => ({ loseContext: () => released++ }) }) }),
    } })
    expect(supportsGlobeRenderer(renderer)).toBe(true)
    expect(released).toBe(1)
  })
}

test('WebGL 1 supports cobe but must not be mistaken for Three.js WebGL 2', () => {
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    createElement: () => ({ getContext: (kind: string) => kind === 'webgl' ? { getExtension: () => null } : null }),
  } })
  expect(supportsGlobeRenderer('realistic')).toBe(false)
  expect(supportsGlobeRenderer('cobe')).toBe(true)
})

test('no WebGL and a browser-denied context both select the non-WebGL fallback', () => {
  for (const getContext of [() => null, () => {
    throw new Error('WebGL disabled by browser policy')
  }]) {
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => ({ getContext }) } })
    expect(supportsGlobeRenderer('realistic')).toBe(false)
    expect(supportsGlobeRenderer('cobe')).toBe(false)
  }
})
