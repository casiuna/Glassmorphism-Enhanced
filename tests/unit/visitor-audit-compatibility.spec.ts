import type { PublicSettings } from '../../src/utils/api'
import { expect, test } from '@playwright/test'
import { createPinia, disposePinia, setActivePinia } from 'pinia'
import { useVisitorAudit } from '../../src/composables/useVisitorAudit'
import { useAppStore } from '../../src/stores/app'

const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
test.beforeEach(() => {
  const values = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  } })
})
test.afterEach(() => {
  if (originalStorage)
    Object.defineProperty(globalThis, 'localStorage', originalStorage)
  else
    Reflect.deleteProperty(globalThis, 'localStorage')
})

for (const scenario of [
  { label: 'Komari 1.6.0 absent capability', field: undefined, supported: false, enabled: false },
  { label: 'Komari 1.5.1 disabled capability', field: false, supported: true, enabled: false },
  { label: 'supported legacy/custom core enabled capability', field: true, supported: true, enabled: true },
  { label: 'malformed string must not advertise support', field: 'true', supported: false, enabled: false },
]) {
  test(scenario.label, async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    try {
      const store = useAppStore()
      store.publicSettings = { theme: 'Enhanced', theme_settings: {}, ...(scenario.field === undefined ? {} : { visitor_audit_enabled: scenario.field }) } as PublicSettings
      const audit = useVisitorAudit()
      expect(audit.supported.value).toBe(scenario.supported)
      expect(audit.enabled.value).toBe(scenario.enabled)
      if (!scenario.enabled) {
        let calls = 0
        const originalFetch = globalThis.fetch
        globalThis.fetch = async () => {
          calls++
          throw new Error('Removed or disabled capability must never be called')
        }
        // A security-profile request must also return before fingerprinting.
        try {
          await audit.record({ event: 'unit_test', path: '/' }, true)
        }
        finally {
          globalThis.fetch = originalFetch
        }
        expect(calls).toBe(0)
      }
    }
    finally {
      disposePinia(pinia)
    }
  })
}
