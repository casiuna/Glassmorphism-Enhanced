import type { NodeData } from '../../src/stores/nodes'
import { expect, test } from '@playwright/test'
import * as financeHelper from '../../src/utils/financeHelper'
import { getTrafficUsed, getTrafficUsedPercentage, isTrafficWarningNode } from '../../src/utils/nodeMetricsHelper'

const TIB = 1024 ** 4
function node(overrides: Partial<NodeData> = {}): NodeData {
  return { billing_cycle: 365, expired_at: '2027-07-25T18:30:00Z', traffic_limit: 1000, traffic_limit_type: 'sum', net_total_up: 100, net_total_down: 300, ...overrides } as NodeData
}

// Finance is independent of the monitoring traffic display contract.
test('currency normalization and user-selected metered estimate remain separate', () => {
  for (const [value, expected] of [['SGD', 'SGD'], ['S$', 'SGD'], ['C$', 'CAD'], ['$', 'USD']])
    expect(financeHelper.normalizeCurrency(value!)).toBe(expected)
  expect(financeHelper.normalizeCurrency('S$ per month')).toBe('CNY')
  const estimate = financeHelper.calculateMeteredEstimate(node({ net_total_up: 100 * TIB, net_total_down: 200 * TIB }), { currency: 'USD', trafficMode: 'down', trafficRate: 1, timeRate: 0, manualHours: 0, oneTimeFee: 0 })
  expect(estimate.trafficBytes).toBe(200 * TIB)
})

for (const [mode, expected] of [['up', 100], ['down', 300], ['min', 100], ['max', 300], ['sum', 400]] as const) {
  test(`machine cumulative helper respects ${mode} and quota ratio`, () => {
    const snapshot = node({ traffic_limit_type: mode })
    expect(getTrafficUsed(snapshot)).toBe(expected)
    expect(getTrafficUsedPercentage(snapshot)).toBeCloseTo(expected / 10)
    expect(getTrafficUsedPercentage({ ...snapshot, traffic_limit: 1 })).toBe(100)
    expect(isTrafficWarningNode(snapshot, 20)).toBe(expected >= 200)
  })
  test(`machine cumulative ${mode} has no quota warning for limit=0`, () => {
    const snapshot = node({ traffic_limit_type: mode, traffic_limit: 0 })
    expect(getTrafficUsed(snapshot)).toBe(expected)
    expect(getTrafficUsedPercentage(snapshot)).toBe(0)
    expect(isTrafficWarningNode(snapshot, 1)).toBe(false)
  })
}

test('counter reset displays only the new snapshot, never stitched history or a monthly delta', () => {
  const before = node({ net_total_up: 100 * TIB, net_total_down: 200 * TIB })
  const after = node({ net_total_up: 2, net_total_down: 3 })
  expect(getTrafficUsed(before)).toBe(300 * TIB)
  expect(getTrafficUsed(after)).toBe(5)
  expect(getTrafficUsedPercentage(after)).toBeCloseTo(0.5)
  expect(getTrafficUsed(before)).toBe(300 * TIB)
})

test('billing and renewal metadata cannot redefine machine cumulative counters', () => {
  for (const billingCycle of [-1, 30, 45, 365]) {
    expect(getTrafficUsed(node({ billing_cycle: billingCycle, expired_at: '' }))).toBe(400)
    expect(getTrafficUsedPercentage(node({ billing_cycle: billingCycle, expired_at: '' }))).toBe(40)
  }
})
