import { parseTags } from '@/utils/tagHelper'

// Display filtering only. Topology and other consumers still read the original
// tags through parseTags; never remove metadata from the node's source data.
const INTERNAL_TAG = /^(?:upstream|parent|上游|父节点|route|return-route|transit-route|enhanced-route)\s*[:=：]/i

export function parseNodeDisplayTags(tags: string | undefined) {
  return parseTags(tags).filter(tag => tag.text && !INTERNAL_TAG.test(tag.text))
}
