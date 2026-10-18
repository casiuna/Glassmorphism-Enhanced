import type { PingChartCacheParams, PingChartHistory } from '../../src/services/ping-chart-cache.service'
import { expect, test } from '@playwright/test'
import { createPingChartCache, PING_CHART_CACHE_MAX_SIZE, PING_CHART_CACHE_TTL_MS } from '../../src/services/ping-chart-cache.service'

const BASE: PingChartCacheParams = { uuid: 'node-a', range: { hours: 1 }, maxCount: 6000, preserveHours: 168 }

function history(uuid = BASE.uuid): PingChartHistory {
  return {
    records: [
      { client: uuid, task_id: 1, time: '2026-10-16T01:00:00Z', value: 42 },
      { client: uuid, task_id: 1, time: '2026-10-16T00:00:00Z', value: -1 },
    ],
    tasks: [{ id: 1, name: 'Test Ping', interval: 60, loss: 50, clients: [uuid] }],
    legacyCustomRangeFallback: false,
  }
}

test('chart cache hits identical requests and isolates UUID, range, points and retention', () => {
  const cache = createPingChartCache()
  cache.set(BASE, history())
  expect(cache.get({ ...BASE, range: { hours: 1 } })).toEqual(history())
  const variants: PingChartCacheParams[] = [
    { ...BASE, uuid: 'node-b' },
    { ...BASE, range: { hours: 6 } },
    { ...BASE, maxCount: 150 },
    { ...BASE, preserveHours: 24 },
    { ...BASE, range: { start: '2026-10-16T00:00:00Z', end: '2026-10-16T01:00:00Z' } },
  ]
  for (const variant of variants)
    expect(cache.get(variant)).toBeUndefined()

  const custom = variants[4]!
  cache.set(custom, { ...history(), legacyCustomRangeFallback: true })
  expect(cache.get(custom)?.legacyCustomRangeFallback).toBe(true)
  expect(cache.get({ ...BASE, range: { start: '2026-10-15T00:00:00Z', end: '2026-10-16T01:00:00Z' } })).toBeUndefined()
  expect(cache.get({ ...BASE, range: { start: '2026-10-16T00:00:00Z', end: '2026-10-16T02:00:00Z' } })).toBeUndefined()
  expect(cache.get(BASE)?.legacyCustomRangeFallback).toBe(false)
})

test('chart cache copies on both insertion and retrieval, including task client lists', () => {
  const cache = createPingChartCache()
  const source = history()
  cache.set(BASE, source)
  source.records.reverse()
  source.records[0]!.value = 999
  source.tasks[0]!.clients!.push('unexpected')

  const result = cache.get(BASE)!
  expect(result).toEqual(history())
  result.records.sort((left, right) => left.time.localeCompare(right.time))
  result.records[0]!.value = 777
  result.tasks[0]!.name = 'changed'
  result.tasks[0]!.clients!.push('another')
  expect(cache.get(BASE)).toEqual(history())
})

test('chart cache expires at the TTL boundary, without extending freshness on reads', () => {
  const cache = createPingChartCache()
  const originalNow = Date.now
  let now = 1000
  Date.now = () => now
  try {
    cache.set(BASE, history())
    now += PING_CHART_CACHE_TTL_MS - 1
    expect(cache.get(BASE)).toEqual(history())
    now += 1
    expect(cache.get(BASE)).toBeUndefined()
  }
  finally {
    Date.now = originalNow
  }
})

test('chart cache evicts least-recently-used results at its finite capacity', () => {
  const cache = createPingChartCache()
  const originalNow = Date.now
  let now = 1000
  Date.now = () => now
  try {
    for (let index = 0; index < PING_CHART_CACHE_MAX_SIZE; index++) {
      cache.set({ ...BASE, uuid: `node-${index}` }, history(`node-${index}`))
      now += 1
    }
    expect(cache.get({ ...BASE, uuid: 'node-0' })).toBeDefined()
    now += 1
    cache.set({ ...BASE, uuid: 'new-node' }, history('new-node'))
    expect(cache.get({ ...BASE, uuid: 'node-1' })).toBeUndefined()
    expect(cache.get({ ...BASE, uuid: 'node-0' })).toBeDefined()
    expect(cache.get({ ...BASE, uuid: 'new-node' })).toBeDefined()
  }
  finally {
    Date.now = originalNow
  }
})

test('chart cache rejects empty, incomplete, cross-node and malformed histories', () => {
  const cache = createPingChartCache()
  const good = history()
  const invalid: PingChartHistory[] = [
    { ...good, records: [] },
    { ...good, tasks: [] },
    history('node-b'),
    { ...good, records: [{ ...good.records[0]!, value: Number.NaN }] },
    { ...good, records: [{ ...good.records[0]!, time: 'invalid' }] },
    { ...good, records: [{ ...good.records[0]!, task_id: 2 }] },
    { ...good, tasks: [{ ...good.tasks[0]!, loss: Number.NaN }] },
  ]
  for (const payload of invalid) {
    cache.set(BASE, payload)
    expect(cache.get(BASE)).toBeUndefined()
  }
})
