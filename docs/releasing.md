# Releasing Glassmorphism Enhanced

Repository: https://github.com/casiuna/Glassmorphism-Enhanced

## Independent version policy

The independent version line began at **1.0.0**, which is released as Git tag / GitHub Release **v1.0.0**. This maintenance round targets **1.0.2**. `komari-theme.json.version` is the sole source of truth; do not add `package.json.version`.

- Bugfix: `1.0.1`, `1.0.2`, …
- Compatible feature: `1.1.0`, `1.2.0`, …
- Breaking change: `2.0.0`.
- No `-enhanced.x` suffix and no upstream version in our release number.
- Upstream base: Glassmorphism v3.3.7. Record future upstream provenance in CHANGELOG / AICACHE, independently of our SemVer.
- Keep the historical `v3.3.7-enhanced.1` tag/Release. Numeric comparison against the old line must not be used to select the independent release.

## Tag namespace sanitation

The fork's inherited upstream SemVer tags were audited before the independent release line was reopened. The 43 inherited original tags are preserved as `upstream-<original-tag>` refs and removed from the fork's original namespace. `v1.0.0`, `v3.3.7-enhanced.1`, `upstream-v1.0.0`, and `komari` remain protected; `v1.0.2` is the next available Enhanced release namespace.

## Komari 1.5.0 compatibility and monthly traffic

The validated compatibility target for this bugfix is **Komari Server 1.5.0**. The theme does not depend on `traffic_up` / `traffic_down` in `common:getNodesLatestStatus`; those latest payloads may contain only persistent `net_total_up` / `net_total_down` counters. Monthly quota usage is derived through the existing shared `public:queryMetrics` path using `traffic.up` and `traffic.down` with `aggregation=sum`, and every returned SUM bucket is accumulated.

The monthly window uses the existing `expired_at` calendar day as the renewal-day anchor. Annual billing changes the fee cycle only; traffic still rolls monthly. Short months clamp day 29/30/31 to the last day, and the original day is restored in the next month that contains it. The cycle starts at UTC midnight so Komari's UTC-aligned rollup buckets do not include the previous calendar day.

If `public:queryMetrics` is unavailable, the theme uses the existing `common:getRecords` / history chain, filters network records to the active window, and sums only `traffic_up` / `traffic_down` deltas. If no cycle history is available, the v1.0.1 cumulative display remains as an explicit legacy fallback. This is separate from Komari 1.5.0 removing the Agent v1 protocol; the theme's frontend/RPC fallback is not an Agent protocol fallback.

## Review gate

The feature work is reviewed through the feature branch and PR. Direct pushes to `main`, force-pushes, manual tag creation, and manual Release publication remain outside the normal review path; after an approved merge, the main-push-only workflow owns the release transition.

The existing `Release On Version Bump` workflow runs on pushes to `main` only; it does not use `workflow_dispatch`. It compares manifest versions for inequality, so the transition from released `1.0.1` to `1.0.2` is supported. After this PR is approved and merged into `main`, the manifest change to `1.0.2` is expected to trigger the `v1.0.2` tag and GitHub Release. Collision handling is explicit: a missing tag is created; a tag whose peeled commit is the current target commit continues through build and creates or updates the Release; a tag on any other commit emits `::error::` and hard-fails the job. The workflow never green-skips a tag collision. Do not dispatch or manually publish the workflow during this task.

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
