import { expect, test } from '@playwright/test'
import { getCoordByCode, getCountryCodeFromRegion } from '../../src/utils/geoHelper'
import { lookupIpGeo } from '../../src/utils/ipGeoHelper'

const descriptors = new Map(['window', 'fetch'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
test.beforeEach(() => {
  const values = new Map<string, string>()
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    setTimeout,
    clearTimeout,
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  } })
})
test.afterEach(() => {
  for (const [key, descriptor] of descriptors) {
    if (descriptor)
      Object.defineProperty(globalThis, key, descriptor)
    else
      Reflect.deleteProperty(globalThis, key)
  }
})

// Reserved documentation IPv6 addresses and controlled provider responses are
// unit fixtures, never substituted into the real-backend integration tests.
test('IPv6 paths are encoded and a successful provider fallback is cached', async () => {
  const urls: string[] = []
  Object.defineProperty(globalThis, 'fetch', { configurable: true, value: async (url: string) => {
    urls.push(url)
    if (urls.length === 1)
      return new Response('', { status: 503 })
    return Response.json({ latitude: 1.3, longitude: 103.8, loc: '1.3,103.8', city: 'Singapore', country: 'SG', country_code: 'SG', success: true })
  } })
  const geo = await lookupIpGeo('2001:db8::101')
  expect(geo).toMatchObject({ lat: 1.3, lng: 103.8 })
  expect(urls).toHaveLength(2)
  expect(urls.every(url => url.includes('2001%3Adb8%3A%3A101'))).toBe(true)
  expect(await lookupIpGeo('2001:db8::101')).toEqual(geo)
  expect(urls).toHaveLength(2)
})

test('provider failures remain missing and use negative cache, never fake coordinates', async () => {
  let requests = 0
  Object.defineProperty(globalThis, 'fetch', { configurable: true, value: async () => {
    requests++
    return new Response('', { status: 503 })
  } })
  expect(await lookupIpGeo('2001:db8::102')).toBeNull()
  const firstRequests = requests
  expect(firstRequests).toBeGreaterThan(0)
  expect(await lookupIpGeo('2001:db8::102')).toBeNull()
  expect(requests).toBe(firstRequests)
  expect(getCountryCodeFromRegion('SG')).toBe('SG')
  expect(getCoordByCode('SG')).toHaveLength(2)
})
