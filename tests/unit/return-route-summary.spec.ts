import type { ReturnRouteDisplay } from '../../src/utils/returnRoutes'
import { expect, test } from '@playwright/test'
import { summaryReturnRoutes } from '../../src/utils/returnRouteDisplay'

const row = (overrides: Partial<ReturnRouteDisplay> = {}): ReturnRouteDisplay => ({ carrier: 'telecom', label: '163', status: 'fresh-auto', source: 'auto', at: '2026-07-25T11:00:00Z', detail: 'private raw detail must never be rendered in the summary', ...overrides })
for (const status of ['unknown', 'expired', 'not-detected', 'failed'] as const) {
  test(`summary omits ${status} instead of certifying a line`, () => {
    expect(summaryReturnRoutes([row({ status })], true)).toEqual([])
  })
}
for (const label of ['未知', '未检测', '过期', '失败', '权限不足', '待复核', '协议分歧', 'UNKNOWN', 'Expired', 'Failed', 'Timeout', 'Mixed / Unknown / Expired', 'N/A', '—', '  ']) {
  test(`manual placeholder ${JSON.stringify(label)} is not a valid route`, () => {
    expect(summaryReturnRoutes([row({ status: 'manual', source: 'manual', label })], true)).toEqual([])
  })
}
test('automatic observation is not publishable to anonymous visitors', () => {
  expect(summaryReturnRoutes([row()], false)).toEqual([])
  expect(summaryReturnRoutes([row()], true)).toEqual([row()])
})
test('mock or protocol disagreement remains diagnostic, never a route summary', () => {
  expect(summaryReturnRoutes([row({ source: 'fixture' })], true)).toEqual([])
  for (const protocolState of ['different', 'partial'] as const)
    expect(summaryReturnRoutes([row({ protocolState })], true)).toEqual([])
})
test('manual priority survives stale/disagreeing auto metadata; only exact carriers are retained', () => {
  const unicom = row({ carrier: 'unicom', label: '9929', status: 'manual', source: 'manual', protocolState: 'different' })
  const mobile = row({ carrier: 'mobile', label: 'CMI', status: 'manual', source: 'manual' })
  expect(summaryReturnRoutes([mobile, row(), unicom], false)).toEqual([unicom, mobile])
  expect(summaryReturnRoutes([mobile, row(), unicom], true)).toEqual([unicom, row(), mobile])
})
test('no valid result means no summary and input is not mutated', () => {
  const rows = [row({ status: 'expired' }), row({ carrier: 'unicom', status: 'failed' })]
  const saved = structuredClone(rows)
  expect(summaryReturnRoutes(rows, true)).toEqual([])
  expect(rows).toEqual(saved)
})

for (const label of ['10099 -> 4837', '10099 → 4837', 'CN2 GIA', 'CMIN2', 'CTGNET', 'CTGNET / Mixed']) {
  test(`full display name is never abbreviated: ${label}`, () => {
    const value = row({ source: 'manual', status: 'manual', label })
    expect(summaryReturnRoutes([value], false)[0]?.label).toBe(label)
  })
}
