# Transit Carrier Ping rules

Current v1.0.5 format: **relay | target | task** (中转节点 | 目标节点 | 链路任务名).

```text
RelayNode|TargetNode|Relay-Target
RelayNode|TargetB|Relay-TargetB
```

The first field selects the relay's existing Ping source. The second field selects the target card to display the estimate. Names are exact and case-sensitive; fields are trimmed. Empty lines, `#` comments, malformed rows and self-relays are ignored. Multiple targets can share one relay; duplicate targets use the **last valid** row, without an invalid later row erasing it. Disabled or unmatched targets keep direct Ping behavior.

Old format: `TargetNode|RelayNode|Task`. New format: `RelayNode|TargetNode|Task`. Existing configurations must manually swap their first two columns before using v1.0.5. There is no automatic migration. The parser cannot safely infer which of two valid node names was intended as relay, so there is no legacy-order autodetection or automatic backend rewrite. IPv6 task names remain supported, for example `RelayNode|TargetNode|Relay-Target-v6`.

This correction does not change latency/loss calculations, cache/request deduplication, visibility restrictions, Server or Agent. Historical release records retain their original examples; use this document and the current README/manifest help for configuration.

The owner has selected **1.0.5** for this rule-order correction. The manifest is bumped from 1.0.4 to 1.0.5; published 1.0.4 assets remain untouched. This review prepares a candidate only; merge, tag and Release publication are not performed by the agent.
