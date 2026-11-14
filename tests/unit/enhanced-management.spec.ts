import { expect, test } from '@playwright/test'
import { helperPresence, managementChanges, nodeBootstrapCommand, parseProbePolicy, stableValue } from '../../src/utils/enhancedManagement'

const UUID = '00000000-0000-4000-8000-000000000001'
const OTHER = '00000000-0000-4000-8000-000000000002'
const AT = '2026-11-09T12:00:00.000Z'
const draft = { uuid: UUID, globalEnabled: false, nodeEnabled: false, city: 'beijing', periodMinutes: 360, displayEnabled: false, ttlHours: 24, manual: { telecom: '', unicom: '', mobile: '' } }

test('central changes preserve unrelated theme fields, other UUID policies and manual/automatic evidence', () => {
  const settings = { transitCarrierPingRules: 'KEEP_RULE', financeCurrency: 'SGD', unknownFuture: { untouched: true }, returnRouteConfig: JSON.stringify({ version: 1, nodes: { [OTHER]: { manual: { mobile: { label: '保留', updatedAt: AT } }, auto: {} } } }) }
  const config = { enabled: false, nodes: JSON.stringify({ [OTHER]: { enabled: false, city: 'shanghai', periodMinutes: 120 } }) }
  const before = stableValue({ settings, config })
  const next = managementChanges(settings, config, { ...draft, manual: { ...draft.manual, telecom: '<线路> & 安全文本' } }, AT)
  expect(next.theme).toMatchObject({ transitCarrierPingRules: 'KEEP_RULE', financeCurrency: 'SGD', unknownFuture: { untouched: true } })
  expect(JSON.parse(next.plugin.nodes)[OTHER]).toEqual(JSON.parse(config.nodes)[OTHER])
  const document = JSON.parse(next.theme.returnRouteConfig)
  expect(document.nodes[OTHER]).toEqual(JSON.parse(settings.returnRouteConfig).nodes[OTHER])
  expect(document.nodes[UUID].manual.telecom).toEqual({ label: '<线路> & 安全文本', updatedAt: AT })
  expect(stableValue({ settings, config })).toBe(before)
})
test('unchanged manual labels retain timestamps; clearing an override never fabricates an automatic result', () => {
  const settings = { returnRouteConfig: JSON.stringify({ version: 1, nodes: { [UUID]: { manual: { telecom: { label: '保留', updatedAt: AT } }, auto: {} } } }) }
  const next = managementChanges(settings, {}, { ...draft, manual: { ...draft.manual, telecom: '保留' } })
  expect(JSON.parse(next.theme.returnRouteConfig).nodes[UUID].manual.telecom.updatedAt).toBe(AT)
  const cleared = managementChanges(settings, {}, draft)
  expect(JSON.parse(cleared.theme.returnRouteConfig).nodes[UUID]).toEqual({ manual: {}, auto: {} })
})
for (const changed of [{ uuid: 'Node Name' }, { city: 'example.invalid' }, { periodMinutes: 59 }, { periodMinutes: 10081 }, { ttlHours: 0 }, { ttlHours: 169 }, { manual: { ...draft.manual, telecom: 'x'.repeat(81) } }]) {
  test(`reject malformed management draft ${JSON.stringify(Object.keys(changed))} ${JSON.stringify(changed).length}`, () => {
    expect(() => managementChanges({}, {}, { ...draft, ...changed })).toThrow()
  })
}
test('corrupt prior manual document refuses the write rather than clearing it', () => {
  expect(() => managementChanges({ returnRouteConfig: '{broken' }, {}, draft)).toThrow('不会覆盖')
})
test('adding a 201st policy is rejected before any native configuration write', () => {
  const nodes = Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`00000000-0000-4000-8000-${String(i + 100).padStart(12, '0')}`, { enabled: false, city: 'beijing', periodMinutes: 360 }]))
  expect(() => managementChanges({}, { nodes }, draft)).toThrow()
})
test('strict native policy rejects names, arbitrary capabilities and too-frequent schedules', () => {
  expect(parseProbePolicy({})).toEqual({ enabled: false, nodes: {} })
  expect(() => parseProbePolicy({ nodes: { Wendy: {} } })).toThrow()
  expect(() => parseProbePolicy({ nodes: { [UUID]: { enabled: true, city: 'beijing', periodMinutes: 59 } } })).toThrow()
  expect(() => parseProbePolicy({ command: 'not-allowed' })).toThrow()
})
test('registration, online, expired and legacy helper states stay distinct', () => {
  const row = { enabled: false, state: 'not-detected', seenAt: null, auto: {} }
  expect(helperPresence(undefined, 200000)).toBe('未登记 Helper')
  expect(helperPresence({ ...row, registeredAt: 100000 }, 200000)).toContain('已登记，尚未轮询')
  expect(helperPresence({ ...row, seenAt: 190000, helperVersion: '0.2.0' }, 200000)).toBe('Helper 在线')
  expect(helperPresence({ ...row, seenAt: 10000 }, 200000)).toContain('离线')
  expect(helperPresence({ ...row, seenAt: 190000 }, 200000)).toContain('旧版')
})
test('bootstrap instructions contain no credentials or remote install and refuse insecure non-loopback panels', () => {
  const command = nodeBootstrapCommand('https://panel.example', UUID)
  expect(command).toContain('--uuid')
  expect(command).toContain('--agent-config')
  expect(command).not.toMatch(/ssh |curl |--token|--password|session_token/)
  expect(command).not.toMatch(/--apply|--enable-local|--run/)
  expect(nodeBootstrapCommand('http://panel.example', UUID)).toContain('拒绝')
  expect(nodeBootstrapCommand('http://127.0.0.1:1234', UUID)).toContain('--allow-loopback-http')
  expect(nodeBootstrapCommand('https://panel.example', 'not-a-uuid')).toBe('')
})
test('optimistic comparisons ignore key ordering, never actual configuration changes', () => {
  expect(stableValue({ b: { y: 1, x: 2 }, a: true })).toBe(stableValue({ a: true, b: { x: 2, y: 1 } }))
  expect(stableValue({ nodes: [UUID] })).not.toBe(stableValue({ nodes: [OTHER] }))
})
