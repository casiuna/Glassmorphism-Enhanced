# Releasing Glassmorphism Enhanced

Repository: https://github.com/casiuna/Glassmorphism-Enhanced

## Independent version policy

The independent version line began at **1.0.0**, which is released as Git tag / GitHub Release **v1.0.0**. This hotfix round targets **1.0.3** after the v1.0.2 runtime regression. `komari-theme.json.version` is the sole source of truth; do not add `package.json.version`.

- Bugfix: `1.0.1`, `1.0.2`, `1.0.3`, …
- Compatible feature: `1.1.0`, `1.2.0`, …
- Breaking change: `2.0.0`.
- No `-enhanced.x` suffix and no upstream version in our release number.
- Upstream base: Glassmorphism v3.3.7. Record future upstream provenance in CHANGELOG / AICACHE, independently of our SemVer.
- Keep the historical `v3.3.7-enhanced.1` tag/Release. Numeric comparison against the old line must not be used to select the independent release.

## Tag namespace sanitation

The fork's inherited upstream SemVer tags were audited before the independent release line was reopened. The 43 inherited original tags are preserved as `upstream-<original-tag>` refs and removed from the fork's original namespace. `v1.0.0`, `v1.0.1`, `v1.0.2`, `v3.3.7-enhanced.1`, `upstream-v1.0.0`, and `komari` remain protected; `v1.0.3` is the next available Enhanced release namespace.

## Komari 1.5.0 compatibility and monthly traffic

The validated compatibility target for this bugfix is **Komari Server 1.5.0**. The theme does not depend on `traffic_up` / `traffic_down` in `common:getNodesLatestStatus`; those latest payloads may contain only persistent `net_total_up` / `net_total_down` counters. Monthly quota usage is derived through the existing shared `public:queryMetrics` path using `traffic.up` and `traffic.down` with `aggregation=sum`, and every returned SUM bucket is accumulated.

The monthly window uses the existing `expired_at` calendar day as the renewal-day anchor. Annual billing changes the fee cycle only; traffic still rolls monthly. Short months clamp day 29/30/31 to the last day, and the original day is restored in the next month that contains it. The cycle starts at UTC midnight so Komari's UTC-aligned rollup buckets do not include the previous calendar day.

If `public:queryMetrics` is unavailable, or a node has no usable traffic series in a successful batch, shared/home contexts immediately use the v1.0.1 cumulative display and do not fan out `common:getRecords` history requests. An explicitly opened single-node detail context may use the existing bounded range/history compatibility path, which sends both the active-window `start/end` and a safe covering `hours` value, filters returned network records to the active window, and sums only `traffic_up` / `traffic_down` deltas. This history path is not described as un-reconstructed or error-free data because Komari may reconstruct records through its metric store and rollups. If no cycle delta is available, the cumulative display remains the explicit legacy fallback. This is separate from Komari 1.5.0 removing the Agent v1 protocol; the theme's frontend/RPC fallback is not an Agent protocol fallback.

## v1.0.2 incident and v1.0.3 hotfix

The v1.0.2 production regression was frontend request pressure: the shared monthly clock refreshed every minute while the traffic cache expired after 30 seconds, and missing metric data could start one full-cycle history request per node from the shared path. This could monopolize the shared request pool and delay monthly traffic, Ping/three-network data, and theme upload completion. There is no evidence of database corruption or writes/resetting of `net_total_*`; v1.0.3 addresses availability by using metric-to-legacy on shared paths, preserving legacy values while loading, and restricting history fallback to one explicitly opened detail node.

The v1.0.3 migration is forward-only. Its production package uses the fixed UTC rollout anchor `2026-09-16T00:00:00.000Z`: if the current cycle started before that anchor, traffic remains on the v1.0.1-compatible cumulative display and is not reconstructed on upgrade; the first cycle whose UTC renewal start is at or after the anchor activates the new monthly logic. Visual regression builds use a separate fixed test anchor only to keep the repository's historical July fixtures deterministic; this does not affect the production build. Existing finance calculations are stateless current-metadata/rate formatting, so the migration gate is intentionally traffic-only.

## Review gate

The feature work is reviewed through the feature branch and PR. Direct pushes to `main`, force-pushes, manual tag creation, and manual Release publication remain outside the normal review path; after an approved merge, the main-push-only workflow owns the release transition.

The existing `Release On Version Bump` workflow runs on pushes to `main` only; it does not use `workflow_dispatch`. It compares manifest versions for inequality, so the transition from released `1.0.2` to `1.0.3` is supported. After this hotfix is approved and merged into `main`, the manifest change to `1.0.3` is expected to trigger the `v1.0.3` tag and GitHub Release. Collision handling is explicit: a missing tag is created; a tag whose peeled commit is the current target commit continues through build and creates or updates the Release; a tag on any other commit emits `::error::` and hard-fails the job. The workflow never green-skips a tag collision. Do not dispatch or manually publish the workflow during this hotfix.

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

Read the PR and Actions back through GitHub API after pushing. When the owner separately authorizes publication, verify the tag target, Release metadata and downloaded asset digest. A local ZIP alone is not proof of a published Release.

## Identity separation

Git clone/fetch/push use Hermes CLI SSH. GitHub metadata, PRs and Actions queries use an independent, repository-scoped Fine-grained PAT: Metadata Read, Contents Read/Write, Pull requests Read/Write, Actions Read. No Issues permission is needed here. Never place tokens or private keys in source, docs, logs or PR bodies. Repository role flags returned by GitHub are not evidence of a token's exact permission scopes.
