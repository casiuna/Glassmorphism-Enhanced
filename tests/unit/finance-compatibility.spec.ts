import type { NodeData } from '../../src/stores/nodes'
import { expect, test } from '@playwright/test'
import {
  applyExchangeRateOverrides,
  calculateMeteredEstimate,
  calculateMonthlyCostCNY,
  clearExchangeRateOverrides,
  clearStoredMeteredEstimateSettings,
  DEFAULT_EXCHANGE_RATES,
  formatFinanceAmount,
  getDailyExchangeRates,
  getPriceCNY,
  getStoredFinanceCurrency,
  getStoredMeteredEstimateSettings,
  normalizeCurrency,
  setExchangeRateOverride,
  setStoredFinanceCurrency,
  setStoredMeteredEstimateSettings,
  SUPPORTED_CURRENCIES,
} from '../../src/utils/financeHelper'

// Deterministic unit fixtures, not evidence of a live exchange-rate provider.
const descriptors = new Map(['localStorage', 'window', 'fetch'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
let values: Map<string, string>
test.beforeEach(() => {
  values = new Map()
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  }
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { setTimeout, clearTimeout } })
})
test.afterEach(() => {
  for (const [key, descriptor] of descriptors) {
    if (descriptor)
      Object.defineProperty(globalThis, key, descriptor)
    else
      Reflect.deleteProperty(globalThis, key)
  }
})

for (const currency of SUPPORTED_CURRENCIES) {
  test(`existing ${currency} conversion and display are preserved`, () => {
    const node = { currency, price: DEFAULT_EXCHANGE_RATES[currency] * 100 } as NodeData
    expect(getPriceCNY(node, DEFAULT_EXCHANGE_RATES)).toBeCloseTo(100)
    expect(normalizeCurrency(currency)).toBe(currency)
    expect(formatFinanceAmount(node.price, currency).symbol).toBeTruthy()
  })
}

test('exactly thirteen currencies include SGD aliases and recurring cost', () => {
  expect(new Set(SUPPORTED_CURRENCIES).size).toBe(13)
  expect(normalizeCurrency('S$')).toBe('SGD')
  expect(normalizeCurrency(' sgd ')).toBe('SGD')
  const rates = { ...DEFAULT_EXCHANGE_RATES, SGD: 0.2 }
  expect(calculateMonthlyCostCNY({ price: 20, currency: 'SGD', billing_cycle: 30 } as NodeData, rates)).toBe(100)
  expect(formatFinanceAmount(20, 'SGD')).toEqual({ currency: 'SGD', symbol: 'S$', value: '20.00' })
})

test('SGD currency and manual override persist without mutating base rates', () => {
  setStoredFinanceCurrency('SGD')
  expect(getStoredFinanceCurrency()).toBe('SGD')
  setExchangeRateOverride('SGD', 0.25)
  setExchangeRateOverride('CNY', 2)
  setExchangeRateOverride('USD', Number.NaN)
  const rates = applyExchangeRateOverrides(DEFAULT_EXCHANGE_RATES)
  expect(rates.SGD).toBe(0.25)
  expect(rates.CNY).toBe(1)
  expect(DEFAULT_EXCHANGE_RATES.SGD).toBe(0.188746)
  expect(getPriceCNY({ price: 25, currency: 'SGD' } as NodeData, rates)).toBe(100)
  clearExchangeRateOverrides()
  expect(applyExchangeRateOverrides(DEFAULT_EXCHANGE_RATES)).toEqual(DEFAULT_EXCHANGE_RATES)
})

test('existing metered estimator uses machine totals and saves SGD settings', () => {
  const settings = { currency: 'SGD' as const, trafficMode: 'sum' as const, trafficRate: 2, timeRate: 3, manualHours: 4, oneTimeFee: 5 }
  setStoredMeteredEstimateSettings('test-node', settings)
  expect(getStoredMeteredEstimateSettings('test-node')).toEqual(settings)
  const result = calculateMeteredEstimate({ net_total_up: 1024 ** 4, net_total_down: 2 * 1024 ** 4 } as NodeData, settings)
  expect(result.trafficBytes).toBe(3 * 1024 ** 4)
  expect(result.totalCost).toBe(23)
  clearStoredMeteredEstimateSettings('test-node')
  expect(getStoredMeteredEstimateSettings('test-node').currency).toBe('USD')
})

test('online response fixture is cached with SGD; the second call does not fetch', async () => {
  let requests = 0
  Object.defineProperty(globalThis, 'fetch', { configurable: true, value: async () => {
    requests++
    return Response.json({ rates: { ...DEFAULT_EXCHANGE_RATES, SGD: 0.25 } })
  } })
  const first = await getDailyExchangeRates()
  expect(first.source).toBe('network')
  expect(first.rates.SGD).toBe(0.25)
  const second = await getDailyExchangeRates()
  expect(second.source).toBe('cache')
  expect(second.rates).toEqual(first.rates)
  expect(requests).toBe(1)
})

test('both provider failures preserve a stale SGD cache rather than inventing a rate', async () => {
  values.set('komari_finance_exchange_rates_cny_v1', JSON.stringify({ base: 'CNY', date: '2000-01-01', fetchedAt: 1, rates: { ...DEFAULT_EXCHANGE_RATES, SGD: 0.22 } }))
  let requests = 0
  Object.defineProperty(globalThis, 'fetch', { configurable: true, value: async () => {
    requests++
    return new Response('', { status: 503 })
  } })
  const result = await getDailyExchangeRates()
  expect(result.source).toBe('stale-cache')
  expect(result.rates.SGD).toBe(0.22)
  expect(requests).toBe(2)
})
