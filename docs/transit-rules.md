# Transit Carrier Ping rules

**v1.0.7** retains the format introduced in **v1.0.5**: **relay | target | task** (中转节点 | 目标节点 | 链路任务名). There is no new v1.0.7 rule migration; three-network Ping, Transit calculations, visibility and request/cache behavior remain unchanged. See the [v1.0.7 release notes](release-notes-v1.0.7.md). Historical v1.0.6 and its original tag remain intact.

```text
RelayNode|TargetNode|Relay-Target
RelayNode|TargetB|Relay-TargetB
```

The first field selects the relay's existing Ping source. The second field selects the target card to display the estimate. Names are exact and case-sensitive; fields are trimmed. Empty lines, `#` comments, malformed rows and self-relays are ignored. Multiple targets can share one relay; duplicate targets use the **last valid** row, without an invalid later row erasing it. Disabled or unmatched targets keep direct Ping behavior.

Old format: `TargetNode|RelayNode|Task`. New format: `RelayNode|TargetNode|Task`. Existing configurations must manually swap their first two columns before using v1.0.5. There is no automatic migration. The parser cannot safely infer which of two valid node names was intended as relay, so there is no legacy-order autodetection or automatic backend rewrite. IPv6 task names remain supported, for example `RelayNode|TargetNode|Relay-Target-v6`.

This correction does not change latency/loss calculations, cache/request deduplication, visibility restrictions, Server or Agent. Historical release records retain their original examples; use this document and the current README/manifest help for configuration.

**Historical v1.0.5 review snapshot (not current release status):** the owner selected **1.0.5** for this rule-order correction, bumping the manifest from 1.0.4 while preserving published 1.0.4 assets. That review prepared a candidate without performing merge, tag or Release publication. The correction has since been published and remains unchanged in v1.0.6.
