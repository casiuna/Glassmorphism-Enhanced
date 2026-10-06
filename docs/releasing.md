# Releasing Glassmorphism Enhanced

Repository: https://github.com/casiuna/Glassmorphism-Enhanced

Current delivery branch: **`release/v1.0.5`** in this fork. The temporary safety branch was retired only after the standard branch was read back at the verified v1.0.5 candidate SHA. Keep manifest **`1.0.5`** and the future Git tag / Release **`v1.0.5`**; temporary names are not release identifiers.

All writes must target **`casiuna/Glassmorphism-Enhanced`** only. Upstream is read-only: no upstream PRs, pushes, issues, comments or reviews. This branch-normalization pass creates no PR in any repository and does not revisit the unrelated upstream PR cleanup.

## Independent version policy

The independent version line began at **1.0.0**, which is released as Git tag / GitHub Release **v1.0.0**. The owner-approved version for this review is **1.0.5**, based on released **1.0.4**. `komari-theme.json.version` is the sole source of truth; do not add `package.json.version`.

- Bugfix: `1.0.1`, `1.0.2`, `1.0.3`, …
- Compatible feature: `1.1.0`, `1.2.0`, …
- Breaking change: `2.0.0`.
- No `-enhanced.x` suffix and no upstream version in our release number.
- Upstream base: Glassmorphism v3.3.7. Record future upstream provenance in CHANGELOG / AICACHE, independently of our SemVer.
- Keep the historical `v3.3.7-enhanced.1` tag/Release. Numeric comparison against the old line must not be used to select the independent release.

## Tag namespace sanitation

The fork's inherited upstream SemVer tags were audited before the independent release line was reopened. The 43 inherited original tags are preserved as `upstream-<original-tag>` refs and removed from the fork's original namespace. Existing release tags, including `v1.0.0` through `v1.0.4`, `v3.3.7-enhanced.1`, `upstream-v1.0.0`, and `komari`, remain protected; `v1.0.5` is the next intended Enhanced release namespace and must be checked for collisions before publication.

## v1.0.5 Transit configuration migration

Old format: `TargetNode|RelayNode|Task`. New format: `RelayNode|TargetNode|Task`, for example `RelayNode|TargetNode|Relay-Target`. Existing configurations must **manually swap the first two columns** before using v1.0.5; do not claim automatic migration. No old-order autodetection or backend writes are performed. The last valid row per target still wins, and multiple targets may share one relay. See [Transit rules](transit-rules.md) and the [v1.0.5 release notes](release-notes-v1.0.5.md).

## Komari 1.5.0 compatibility and monthly traffic

The validated compatibility target for this bugfix is **Komari Server 1.5.0**. The theme does not depend on `traffic_up` / `traffic_down` in `common:getNodesLatestStatus`; those latest payloads may contain only persistent `net_total_up` / `net_total_down` counters. Monthly quota usage is derived through the existing shared `public:queryMetrics` path using `traffic.up` and `traffic.down` with `aggregation=sum`, and every returned SUM bucket is accumulated.

The monthly window uses the existing `expired_at` calendar day as the renewal-day anchor. Annual billing changes the fee cycle only; traffic still rolls monthly. Short months clamp day 29/30/31 to the last day, and the original day is restored in the next month that contains it. The cycle starts at UTC midnight so Komari's UTC-aligned rollup buckets do not include the previous calendar day.

If `public:queryMetrics` is unavailable, or a node has no usable traffic series in a successful batch, shared/home contexts immediately use the v1.0.1 cumulative display and do not fan out `common:getRecords` history requests. An explicitly opened single-node detail context may use the existing bounded range/history compatibility path, which sends both the active-window `start/end` and a safe covering `hours` value, filters returned network records to the active window, and sums only `traffic_up` / `traffic_down` deltas. This history path is not described as un-reconstructed or error-free data because Komari may reconstruct records through its metric store and rollups. If no cycle delta is available, the cumulative display remains the explicit legacy fallback. This is separate from Komari 1.5.0 removing the Agent v1 protocol; the theme's frontend/RPC fallback is not an Agent protocol fallback.

## v1.0.2 incident and v1.0.3 hotfix

The v1.0.2 production regression was frontend request pressure: the shared monthly clock refreshed every minute while the traffic cache expired after 30 seconds, and missing metric data could start one full-cycle history request per node from the shared path. This could monopolize the shared request pool and delay monthly traffic, Ping/three-network data, and theme upload completion. There is no evidence of database corruption or writes/resetting of `net_total_*`; v1.0.3 addresses availability by using metric-to-legacy on shared paths, preserving legacy values while loading, and restricting history fallback to one explicitly opened detail node.

The v1.0.3 migration is forward-only. Its production package uses the fixed UTC rollout anchor `2026-09-16T00:00:00.000Z`: if the current cycle started before that anchor, traffic remains on the v1.0.1-compatible cumulative display and is not reconstructed on upgrade; the first cycle whose UTC renewal start is at or after the anchor activates the new monthly logic. Visual regression builds use a separate fixed test anchor only to keep the repository's historical July fixtures deterministic; this does not affect the production build. Existing finance calculations are stateless current-metadata/rate formatting, so the migration gate is intentionally traffic-only.

## Review gate

The v1.0.5 candidate is maintained on this fork's `release/v1.0.5`. The owner decides when and how to merge it into this fork's `main`; no PR is created by this agent pass. Direct pushes to `main`, unprotected force-pushes, manual tag creation and manual Release publication are outside this pass. After the owner's merge, this fork's main-push-only workflow owns publication.

The existing `Release On Version Bump` workflow runs on pushes to `main` only; it does not use `workflow_dispatch`. The owner's future merge of `release/v1.0.5` into **`casiuna/Glassmorphism-Enhanced:main`** would change the manifest from `1.0.4` to `1.0.5`. The workflow derives `release_tag=v${currentVersion}`, builds the theme, creates the missing annotated **`v1.0.5`** tag at the resulting main SHA, then creates/updates the Release in this fork and uploads the commit-matched ZIP. An existing tag is accepted only if its peeled commit matches that main SHA; otherwise the job fails. The agent does not execute the merge, create/move tags, or publish a Release. Release assets must come from the resulting main commit, not an earlier branch candidate.

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
