# Releasing Glassmorphism Enhanced

Repository: https://github.com/casiuna/Glassmorphism-Enhanced

**Release preparation: v1.1.0**, manifest `1.1.0`, identity `Enhanced`. The latest independently verified historical publication is [v1.0.8](https://github.com/casiuna/Glassmorphism-Enhanced/releases/tag/v1.0.8), at `20109bfab5de1278c94d6344114dfd50f3ecf496`. Existing tags and Release assets remain intact.

**Publication authority:** a finalized CHANGELOG entry and local commit do not establish remote publication. After separately authorized publication, verify this fork's main ref, successful Actions run, v1.1.0 tag target, Release metadata and downloaded ZIP. CI is the authoritative release build; never upload the old-HEAD local validation ZIP as the final asset. This preparation authorizes no remote write or production deployment.

**Historical scope:** the monthly-window compatibility discussion and v1.0.2/v1.0.3 incident notes below describe v1.0.6 and earlier releases, not the current implementation. That frontend monthly implementation was withdrawn in v1.0.7; current machine-cumulative traffic semantics are in the [README](../README.md#流量说明). Existing release policies and historical records remain intact.

**Historical v1.0.6** was published on **2026-10-18** at `b9f7f4f730a9e8445d261363fe8c070c98bd3001`. Its annotated tag, [GitHub Release](https://github.com/casiuna/Glassmorphism-Enhanced/releases/tag/v1.0.6) and `komari-theme-Glassmorphism-build-b9f7f4f.zip` remain unchanged. Historical v1.0.5 and earlier tags/assets are also retained. See [v1.0.6 notes](release-notes-v1.0.6.md).

All repository changes must target **`casiuna/Glassmorphism-Enhanced`** only. Upstream is read-only: no upstream PRs, pushes, issues, comments or reviews. GitHub publication is separate from installing a theme on a production Komari server; production, databases and provider accounts are not modified by documentation synchronization.

## Independent version policy

The independent version line began at **1.0.0**, released as Git tag / GitHub Release **v1.0.0**. The version being prepared is **1.1.0**; the verified historical v1.0.8 and earlier publications are preserved. `komari-theme.json.version` is the sole version source; do not add `package.json.version`. Remote publication status must be verified independently.

- Bugfix: `1.0.1`, `1.0.2`, `1.0.3`, …
- Compatible feature: `1.1.0`, `1.2.0`, …
- Breaking change: `2.0.0`.
- No `-enhanced.x` suffix and no upstream version in our release number.
- Upstream base: Glassmorphism v3.3.7. Record future upstream provenance in CHANGELOG / AICACHE, independently of our SemVer.
- Keep the historical `v3.3.7-enhanced.1` tag/Release. Numeric comparison against the old line must not be used to select the independent release.

## Tag namespace sanitation

The fork's inherited upstream SemVer tags were audited before the independent release line was reopened. The 43 inherited original tags are preserved as `upstream-<original-tag>` refs and removed from the fork's original namespace. Existing release tags, including `v1.0.0` through published `v1.0.6`, `v3.3.7-enhanced.1`, `upstream-v1.0.0`, and `komari`, remain protected. Any future owner-approved release namespace must be checked for collisions before publication; published tags must not be reused or moved.

## v1.0.5 Transit configuration migration

Old format: `TargetNode|RelayNode|Task`. New format: `RelayNode|TargetNode|Task`, for example `RelayNode|TargetNode|Relay-Target`. Existing configurations must **manually swap the first two columns** before using v1.0.5; do not claim automatic migration. No old-order autodetection or backend writes are performed. The last valid row per target still wins, and multiple targets may share one relay. See [Transit rules](transit-rules.md) and the [v1.0.5 release notes](release-notes-v1.0.5.md).

## Historical v1.0.6: Komari 1.5.0 compatibility and monthly traffic

The following records the retired v1.0.6 monthly implementation, not v1.1.0 behavior.

The source-audited compatibility targets for this bugfix are **Komari Server 1.5.0/1.5.1**; deterministic frontend tests are not production validation. The theme does not depend on `traffic_up` / `traffic_down` in `common:getNodesLatestStatus`; those latest payloads may contain only persistent `net_total_up` / `net_total_down` counters. Monthly quota usage is derived through the existing shared `public:queryMetrics` path using `traffic.up` and `traffic.down` with `aggregation=sum`; only uniquely matched observations inside the provisional current window are accumulated, and numeric quota usage additionally requires conservative returned-bucket coverage checks.

The provisional monthly window uses the existing `expired_at` UTC calendar day as the renewal-day anchor. Annual billing changes the fee cycle only; traffic still rolls monthly in this theme. Short months clamp day 29/30/31 to the last day, and the original day is restored in the next month that contains it. The cycle starts at UTC midnight so Komari's UTC-aligned rollup buckets do not include the previous calendar day. Provider reset dates/timezones and traffic rules are not inferred or verified from that metadata; official reconciliation remains separate.

In released v1.0.6, missing/incomplete monthly metric data is unknown/partial, never a machine cumulative value or manufactured zero. Complete returned-bucket evidence uses SUM + exact entity/range + UTC interval alignment + positive observation counts; it does not certify a provider bill or invisible reporting gaps. Shared/home never fans out history. A single-node detail may request bounded network history with start/end + safe hours + maxCount=-1, but reconstructed records lack coverage counts and can default absent fields to zero, so their subtotal stays partial. See [the read-only source audit and no-write reconciliation plan](monthly-traffic-reliability.md).

## Historical v1.0.2 incident and v1.0.3 hotfix

The v1.0.2 production regression was frontend request pressure: the shared monthly clock refreshed every minute while the traffic cache expired after 30 seconds, and missing metric data could start one full-cycle history request per node from the shared path. This could monopolize the shared request pool and delay monthly traffic, Ping/three-network data, and theme upload completion. There is no evidence of database corruption or writes/resetting of `net_total_*`; v1.0.3 addresses availability by using metric-to-legacy on shared paths, preserving legacy values while loading, and restricting history fallback to one explicitly opened detail node.

The historical v1.0.3 fixed rollout protection is explicitly withdrawn by the owner for this repair: all valid current cycles query immediately. Production and visual builds no longer inject a migration anchor. Existing stateless finance price/rate calculations remain unchanged; the financial metered estimator keeps its separate user-selected machine-counter scope.

## Review gate

**v1.1.0 local acceptance:** browser **81/81**, unit/component **67/67**, real Komari 1.6.0/1.5.1 integration **16/16**, plus TypeScript, full no-fix ESLint, diff-check and production build passed. Physical GPU telemetry was not tested. The historical browser report has no pinned source fingerprint; local package payloads were matched byte-for-byte to the recorded integration-tested bundle. See [the compatibility review](komari-1.6.0-compatibility.md) and [identity migration/backout](migration-v1.1.0.md).

Precisely review and commit the implementation, tests, manifest and documentation on the development branch. Before any separately authorized main update, independently verify fast-forward ancestry and tag collision state. The final v1.1.0 ZIP must be built from the reviewed release commit in CI; never publish a precommit validation ZIP or replace old tags/assets. Market submission is a separate authorized action after the official downloadable ZIP is verified.

v1.0.6 has passed its release gate and is published at `b9f7f4f730a9e8445d261363fe8c070c98bd3001`, with manifest 1.0.6. Documentation/workflow-only follow-up commits do not bump the manifest, rebuild its package, move its tag or rewrite its Release/assets. A future version requires its own approved version change, validation and collision checks; never reuse a published tag.

The `Release On Version Bump` workflow runs on this fork's `main` pushes only; it does not use `workflow_dispatch`. It derives `release_tag=v${currentVersion}` and compares the manifest against the push's previous SHA. **Only `steps.version.outputs.version_changed == 'true'` enables tag-state validation, build, tag creation and Release publication.** An unchanged version logs a normal skip and leaves existing tags/assets untouched. For an actual version change, an existing tag pointing at another commit still causes refusal. Bun is pinned to **1.3.14**, matching `package.json` and the quality/visual workflows; committed `bun.lock` and a successful `bun install --frozen-lockfile` are required. Published v1.0.5 remains at `3bb76d9fd6f86d9fe56845b12922ee75866f2ed3`; v1.0.6 remains at its separate release commit.

## Verification

For a future version/source change, run the release checks below. Documentation-only synchronization instead checks links, YAML, unchanged-version gates and diff scope without rebuilding the published package.

```sh
bun install --frozen-lockfile
bun x --no-install eslint . --max-warnings 0
bun run type-check
node node_modules/@playwright/test/cli.js test -c tests/request-manager.config.ts
bun run test:visual
bun run build
git diff --check
```

For v1.1.0, inspect the ZIP, not just `dist/`: top level must be exactly `komari-theme.json`, `preview.png`, `dist/`. Require `short: Enhanced`, `name: Glassmorphism Enhanced`, `version: 1.1.0`, `author: casiuna`; retain `komari-theme-Glassmorphism-build-<short-sha>.zip`. Build from that version's final release commit in a clean checkout with Bun 1.3.14 and the frozen lockfile, then verify required HTML/assets, preview, commit identity and SHA-256. Preserve the MIT license and THIRD_PARTY attributions. Old `Glassmorphism` installations/settings remain separate; do not delete them or directly edit the database to migrate.

After an authorized push, read the exact branch/main ref back from this fork. For a new version, verify Actions, tag target, Release metadata and the downloaded asset digest; a local ZIP alone is not proof of publication. For unchanged-version documentation-only main updates, verify that publication steps are skipped and all previously published tags, Releases and assets remain unchanged. Do not manually recreate an existing release.

## Identity separation

Git clone/fetch/push use Hermes CLI SSH. GitHub metadata, PRs and Actions queries use an independent, repository-scoped Fine-grained PAT: Metadata Read, Contents Read/Write, Pull requests Read/Write, Actions Read. No Issues permission is needed here. Never place tokens or private keys in source, docs, logs or PR bodies. Repository role flags returned by GitHub are not evidence of a token's exact permission scopes.
