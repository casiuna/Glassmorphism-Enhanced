# Glassmorphism Enhanced v1.0.5 — release notes

Status: candidate on **`casiuna/Glassmorphism-Enhanced:release/v1.0.5`**; not yet published. The owner has selected version **1.0.5** and will handle merge into this fork's `main` separately. No PR is created in this pass; upstream is read-only.

## Transit rule format change — manual migration required

The Transit Carrier Ping rule order changes from **target | relay | task** to **relay | target | task**.

```text
Old: TargetNode|RelayNode|Task
New: RelayNode|TargetNode|Task
```

Recommended new-format example:

```text
RelayNode|TargetNode|Relay-Target
```

**Existing configurations must manually swap the first two columns before using v1.0.5.** Keep the third field as the existing exact Ping task name. There is no automatic migration, old-order autodetection, or backend configuration rewrite; two valid node names cannot reliably reveal the intended direction.

Names remain case-sensitive and trimmed. Empty/comment/malformed/self-relay rows are ignored. Duplicate targets retain the last valid row; multiple targets may share one relay. Disabled and unmatched targets retain direct Ping behavior.

## Unchanged

- Latency/loss derivation, visibility restrictions and shared Ping request/cache behavior.
- Monthly traffic migration and finance calculations.
- Safe-area and native admin-login behavior from v1.0.4.
- Owner-approved preview and the theme ZIP layout.
- Komari Server and Agent: no changes.

Manifest version is **1.0.5** and the standard Git tag / Release name is **v1.0.5**. Published v1.0.4 tags/assets are not replaced. After the owner merges `release/v1.0.5` into this fork's `main`, this fork's existing main-push workflow builds and publishes at the resulting main SHA. This agent pass does not create PRs, merge, create/move tags, or publish a Release. A release-branch ZIP is only a candidate; the eventual release asset must be rebuilt from the merged main commit.
