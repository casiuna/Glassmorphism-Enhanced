# Transit Carrier Ping rules

Current format: **relay | target | task** (中转节点 | 目标节点 | 链路任务名).

```text
RelayNode|TargetNode|Relay-Target
RelayNode|TargetB|Relay-TargetB
```

The first field selects the relay's existing Ping source. The second field selects the target card to display the estimate. Names are exact and case-sensitive; fields are trimmed. Empty lines, `#` comments, malformed rows and self-relays are ignored. Multiple targets can share one relay; duplicate targets use the **last valid** row, without an invalid later row erasing it. Disabled or unmatched targets keep direct Ping behavior.

Existing configurations must manually swap their first two columns before using this change. The parser cannot safely infer which of two valid node names was intended as relay, so there is no legacy-order autodetection or automatic backend rewrite. IPv6 task names remain supported, for example `RelayNode|TargetNode|Relay-Target-v6`.

This correction does not change latency/loss calculations, cache/request deduplication, visibility restrictions, Server or Agent. Historical release records retain their original examples; use this document and the current README/manifest help for configuration.

The review keeps manifest 1.0.4 unchanged. A future release containing the incompatible rule-order change needs a deliberate version/migration decision; it must not silently replace an already published 1.0.4 asset.
