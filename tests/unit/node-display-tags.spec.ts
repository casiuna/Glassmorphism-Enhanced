import { expect, test } from '@playwright/test'
import { parseNodeDisplayTags } from '../../src/utils/nodeDisplayTags'
import { getNodeUpstreamRefs } from '../../src/utils/nodeTopology'
import { parseTags } from '../../src/utils/tagHelper'

test('display tags retain semicolon parsing, color and special-character text', () => {
  const tags = ' ; 普通<jade> ; A&B <img src=x onerror=alert(1)> ; 很长'.concat('标签'.repeat(100), '; ;')
  const parsed = parseNodeDisplayTags(tags)
  expect(parsed).toEqual(parseTags(tags))
  expect(parsed[0]).toMatchObject({ text: '普通', color: 'jade' })
  expect(parsed[1]!.text).toContain('<img')
  expect(parsed[2]!.text.length).toBeGreaterThan(100)
})

for (const tags of [undefined, '', '  ; ;  ', '<jade>']) {
  test(`empty tags do not produce pills: ${String(tags)}`, () => {
    expect(parseNodeDisplayTags(tags)).toEqual([])
  })
}

test('internal metadata is filtered only for display; topology/source survive', () => {
  const tags = 'upstream:Relay;parent=Other;上游：上游节点;父节点 : Fourth;route:internal;return-route=x;transit-route：a;enhanced-route:b;用户<red>;router;Upstream friendly'
  expect(parseNodeDisplayTags(tags).map(tag => tag.text)).toEqual(['用户', 'router', 'Upstream friendly'])
  expect(getNodeUpstreamRefs({ tags })).toEqual(['Relay', 'Other', '上游节点', 'Fourth'])
  expect(parseTags(tags)).toHaveLength(11)
  expect(tags).toContain('route:internal')
})
