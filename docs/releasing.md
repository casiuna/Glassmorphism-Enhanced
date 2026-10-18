# Releasing Glassmorphism Enhanced

Repository: https://github.com/casiuna/Glassmorphism-Enhanced

Last recorded published baseline: **v1.0.5**, main/tag peeled `3bb76d9fd6f86d9fe56845b12922ee75866f2ed3`; `release/v1.0.5` remains retained. Current candidate work is **`fix/v1.0.6-performance`**, with owner-approved manifest **1.0.6**. This pass permits one reviewed local commit and commit-matched packaging only; no push, merge, tag, Release or deployment is authorized. Do not replace published v1.0.5 assets. See the [v1.0.6 release notes](release-notes-v1.0.6.md).

All repository changes must target **`casiuna/Glassmorphism-Enhanced`** only. Upstream is read-only: no upstream PRs, pushes, issues, comments or reviews. This local-only pass creates no PR in any repository and does not access upstream PR #57, production, databases or provider accounts.

## Independent version policy

The independent version line began at **1.0.0**, which is released as Git tag / GitHub Release **v1.0.0**. The last recorded published version is **1.0.5**; **1.0.6** is an owner-approved local candidate, not a published Release. `komari-theme.json.version` is the sole source of truth; do not add `package.json.version`.

- Bugfix: `1.0.1`, `1.0.2`, `1.0.3`, …
- Compatible feature: `1.1.0`, `1.2.0`, …
- Breaking change: `2.0.0`.
- No `-enhanced.x` suffix and no upstream version in our release number.
- Upstream base: Glassmorphism v3.3.7. Record future upstream provenance in CHANGELOG / AICACHE, independently of our SemVer.
- Keep the historical `v3.3.7-enhanced.1` tag/Release. Numeric comparison against the old line must not be used to select the independent release.

## Tag namespace sanitation

The fork's inherited upstream SemVer tags were audited before the independent release line was reopened. The 43 inherited original tags are preserved as `upstream-<original-tag>` refs and removed from the fork's original namespace. Existing release tags, including `v1.0.0` through published `v1.0.5`, `v3.3.7-enhanced.1`, `upstream-v1.0.0`, and `komari`, remain protected. Any future owner-approved release namespace must be checked for collisions before publication; the published v1.0.5 must not be reused or moved.

## v1.0.5 Transit configuration migration

Old format: `TargetNode|RelayNode|Task`. New format: `RelayNode|TargetNode|Task`, for example `RelayNode|TargetNode|Relay-Target`. Existing configurations must **manually swap the first two columns** before using v1.0.5; do not claim automatic migration. No old-order autodetection or backend writes are performed. The last valid row per target still wins, and multiple targets may share one relay. See [Transit rules](transit-rules.md) and the [v1.0.5 release notes](release-notes-v1.0.5.md).

## Komari 1.5.0 compatibility and monthly traffic

The source-audited compatibility targets for this bugfix are **Komari Server 1.5.0/1.5.1**; deterministic frontend tests are not production validation. The theme does not depend on `traffic_up` / `traffic_down` in `common:getNodesLatestStatus`; those latest payloads may contain only persistent `net_total_up` / `net_total_down` counters. Monthly quota usage is derived through the existing shared `public:queryMetrics` path using `traffic.up` and `traffic.down` with `aggregation=sum`; only uniquely matched observations inside the provisional current window are accumulated, and numeric quota usage additionally requires conservative returned-bucket coverage checks.

The provisional monthly window uses the existing `expired_at` UTC calendar day as the renewal-day anchor. Annual billing changes the fee cycle only; traffic still rolls monthly in this theme. Short months clamp day 29/30/31 to the last day, and the original day is restored in the next month that contains it. The cycle starts at UTC midnight so Komari's UTC-aligned rollup buckets do not include the previous calendar day. Provider reset dates/timezones and traffic rules are not inferred or verified from that metadata; official reconciliation remains separate.

In the current unreleased repair, missing/incomplete monthly metric data is unknown/partial, never a machine cumulative value or manufactured zero. Complete returned-bucket evidence uses SUM + exact entity/range + UTC interval alignment + positive observation counts; it does not certify a provider bill or invisible reporting gaps. Shared/home never fans out history. A single-node detail may request bounded network history with start/end + safe hours + maxCount=-1, but reconstructed records lack coverage counts and can default absent fields to zero, so their subtotal stays partial. See [the read-only source audit and no-write reconciliation plan](monthly-traffic-reliability.md).

## v1.0.2 incident and v1.0.3 hotfix

The v1.0.2 production regression was frontend request pressure: the shared monthly clock refreshed every minute while the traffic cache expired after 30 seconds, and missing metric data could start one full-cycle history request per node from the shared path. This could monopolize the shared request pool and delay monthly traffic, Ping/three-network data, and theme upload completion. There is no evidence of database corruption or writes/resetting of `net_total_*`; v1.0.3 addresses availability by using metric-to-legacy on shared paths, preserving legacy values while loading, and restricting history fallback to one explicitly opened detail node.

The historical v1.0.3 fixed rollout protection is explicitly withdrawn by the owner for this repair: all valid current cycles query immediately. Production and visual builds no longer inject a migration anchor. Existing stateless finance price/rate calculations remain unchanged; the financial metered estimator keeps its separate user-selected machine-counter scope.

## Review gate

The current candidate is maintained only on this fork's `fix/v1.0.6-performance`, with manifest 1.0.6. One local commit is authorized only after review, reproducible frozen installation and the necessary checks pass. No PR, push, merge, rebase, tag, Release or deployment is permitted in this pass; do not reuse or move the published v1.0.5 tag.

The existing `Release On Version Bump` workflow runs on this fork's `main` pushes only; it does not use `workflow_dispatch`. Published v1.0.5 was created at `3bb76d9fd6f86d9fe56845b12922ee75866f2ed3`. The workflow derives `release_tag=v${currentVersion}`, builds at the resulting main SHA, and refuses an existing tag pointing elsewhere. Its Bun version is pinned to **1.3.14**, matching `package.json` and the quality/visual workflows; `bun.lock` must be committed and `bun install --frozen-lockfile` must succeed. This workflow is not invoked here. Publication still needs separate owner authorization and remote verification.

## Verification

```sh
bun install --frozen-lockfile
bun run lint
bun run type-check
bun run build
bun run test:visual
git diff --check
```

Inspect the ZIP, not just `dist/`: top level must be exactly `komari-theme.json`, `preview.png`, `dist/`. Keep `short: Glassmorphism` and `komari-theme-Glassmorphism-build-<short-sha>.zip`. Rebuild after the final commit so the filename identifies the reviewed commit, then compute SHA-256. Preserve the MIT license and THIRD_PARTY attributions.

Read the exact branch ref back from this fork after pushing. After the owner's eventual main merge, verify this fork's Actions, tag target, Release metadata and downloaded asset digest. A local ZIP alone is not proof of a published Release. Do not create a PR or invoke a publication workflow during this normalization pass.

## Identity separation

Git clone/fetch/push use Hermes CLI SSH. GitHub metadata, PRs and Actions queries use an independent, repository-scoped Fine-grained PAT: Metadata Read, Contents Read/Write, Pull requests Read/Write, Actions Read. No Issues permission is needed here. Never place tokens or private keys in source, docs, logs or PR bodies. Repository role flags returned by GitHub are not evidence of a token's exact permission scopes.
