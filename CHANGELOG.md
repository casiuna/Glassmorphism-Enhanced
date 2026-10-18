# Changelog

All notable Glassmorphism Enhanced changes are documented here. Upstream history remains in the upstream repository and preserved Git history.

## 1.0.7 — Released

- Restore the original three-network theme's machine-cumulative traffic display from current `net_total_up` / `net_total_down` snapshots. Quota-related values follow Komari `traffic_limit_type` (`up`, `down`, `min`, `max`, `sum`); bidirectional totals remain upload plus download.
- Align home cards and summaries, lists, detail upload/download, node comparison, health warnings and CSV/JSON export on the cumulative scope. Percentages are machine-cumulative/configured-quota reference ratios, not current-month usage or provider bills; no monthly reset is promised. Unlimited quotas do not generate health/export percentages or quota warnings.
- Remove the monthly-only hook, traffic service, bucket-completeness helpers and renewal-window calculation, together with their extra monthly SUM queries. Do not hide machine counters behind missing-monthly-data states. Counter resets display the new snapshot without reconstructing earlier totals.
- Replace the health panel's misleading period-average traffic burn rate with current `net_in + net_out`, labeled “当前网络速率”. Preserve other health, pricing, authorization and export behavior; identify JSON traffic as `machine-cumulative-not-provider-bill`.
- Preserve three-network Ping, Transit, v1.0.6 viewport subscriptions, request cancellation/queue fixes and chart caches. Shared metrics/history/request services and historical collection remain; no Server, Agent, database or production changes, and no counter writes or resets.
- Verified cumulative helper/view/export regressions: **21/21 passed**. Three-network/Transit, viewport subscriptions and header regressions: **29/29 passed**. TypeScript, full no-fix ESLint, diff-check and production build passed; Vite transformed 1864 modules and produced 761 dist files (12.206 MiB). These are 50 targeted tests, not a full pixel-baseline run.
- Manifest is 1.0.7 and publication is owner-authorized. The main-push Actions workflow is the authoritative release build; verify its final commit and theme ZIP rather than publishing the old-HEAD local validation package. [Release/download](https://github.com/casiuna/Glassmorphism-Enhanced/releases/tag/v1.0.7) · [Release notes](docs/release-notes-v1.0.7.md).

## 1.0.6 — Released (2026-10-18)

- Remove the v1.0.3 rollout anchor/grandfathering; immediately query the actual current monthly UTC renewal window. Keep annual/quarterly payment periods separate from monthly quota periods and preserve short-month clamping. Do not invent windows for one-off/custom/missing renewal metadata.
- Stop presenting machine-lifetime `net_total_up/down` as monthly usage. Use nullable unknown/partial/loading states instead of legacy cumulative substitution or fabricated zero. Only positive-count, continuous, correctly matched SUM bucket evidence can drive a collected-monthly quota percentage; this is not provider billing certification.
- Align cards, list progress, detail, summaries, warnings, comparison, health burn-rate and snapshot export on the same configured up/down/min/max/sum monthly source. Min/max combine period totals. Keep the separate financial estimator's user-selected cumulative mode with an explicit non-monthly/non-bill label.
- Preserve shared batches, five-minute refresh and ten-minute cache; prevent shared history fanout and remove nested request-pool slot acquisition. Single-node bounded history remains controlled and explicitly partial because reconstructed records lack reliable coverage metadata.
- Audit Komari 1.5.0/1.5.1 source read-only. Record raw/rollup coverage, within-bucket gap and provider-policy limitations in `docs/monthly-traffic-reliability.md`. No Server/Agent/DB/production changes. Manifest is 1.0.6; the published tag and theme ZIP identify release commit `b9f7f4f730a9e8445d261363fe8c070c98bd3001`.
- Generate monthly windows for valid monthly/annual recurring plans even with zero/null unlimited quotas. Homepage, cards, detail and comparison use shared monthly up/down/total/quota data; non-ready or untrusted data remains **待核对**, while genuine observed zero stays zero. Preserve historical counters and collected data.

### Ping loading and queue fixes

- Protect same-key pending request identity so a cancelled/settled request cannot remove its replacement.
- Cancel both Ping history return-type keys; prevent obsolete subscriptions from continuing legacy fallback or writing late results.
- Reuse the current request-pool slot and abort signal during range-history compatibility fallback instead of nesting queued requests.
- Invalidate unmounted chart loads and cache complete successful chart histories for 60 seconds / at most 128 isolated keys; never cache empty/failed results, and return copies.
- Subscribe card/list Ping near the viewport with a 200px preload margin; release off-screen subscriptions and preserve the no-IntersectionObserver fallback and shared relay behavior.

### Validation and reproducibility

- Pre-release local source validation: Chromium **155/155**, unit/component **28/28**, TypeScript, ESLint and production build passed. Frozen-dependency revalidation also passed 28 unit/component tests and 14 focused detail/comparison Chromium cases. No production speedup percentage or provider-bill certification is claimed.
- Commit native `bun.lock`, preserve tested direct dependency versions and use Bun **1.3.14** across package metadata and CI; clean-directory and worktree `bun install --frozen-lockfile` both passed.
- Published release and download: [v1.0.6](https://github.com/casiuna/Glassmorphism-Enhanced/releases/tag/v1.0.6). Subsequent documentation-only main commits do not republish this version.

## 1.0.5 — Released

### Transit rule format change — manual migration required

- Change the Transit Carrier Ping rule format from **target | relay | task** to **relay | target | task**: old `TargetNode|RelayNode|Task`, new `RelayNode|TargetNode|Task` (recommended example: `RelayNode|TargetNode|Relay-Target`).
- Existing configurations **must manually swap the first two columns** before using v1.0.5. There is no automatic migration, legacy-order autodetection, or backend configuration rewrite.
- Keep deterministic duplicate handling: the last valid rule for each target wins; multiple targets can share one relay. Invalid rows do not erase earlier valid rules.
- Synchronize current manifest, README, configuration help and release documentation to v1.0.5. Preserve latency/loss calculations, shared Ping caches, direct/unmatched behavior, traffic migration, finance, safe-area, admin-login and owner preview. No Server/Agent changes.

## 1.0.4 — Released

- Protect the sticky header from viewport safe-area overlap, including translucent iOS standalone status bars, without device/version detection or duplicate page padding.
- Verify the native session before admin navigation. Guests use the bundled official homepage's native login (an additional login click); native login returns to `/admin`. No invented login route, return-url parameter, credential storage or Server/Agent changes.
- Synchronize the README release badge and independent manifest version. Preserve v1.0.3 traffic migration, finance, Transit and owner preview.

## 1.0.3 — Released

Hotfix for the v1.0.2 production regression. Validated compatibility target: Komari Server 1.5.0. No Komari Server or Agent changes are included.

### Fixed

- Monthly traffic no longer refreshes the full shared usage path on every one-minute clock tick. The clock only detects a renewal-cycle key change; normal refresh is bounded to a five-minute policy and a ten-minute usage cache.
- Shared/home traffic usage now prefers one batched `public:queryMetrics` request and falls directly back to the v1.0.1 cumulative display when the metric method or a node's required traffic series is unavailable. Automatic per-node full-cycle `common:getRecords` fan-out is removed from the shared path.
- Existing traffic values remain visible while a monthly request is pending or fails; loading no longer flashes `0` usage when legacy cumulative data is available.
- Explicit detail usage may still use a single-node bounded history compatibility path; it is not used by home/shared polling and remains request-deduplicated.

### Incident

- v1.0.2 could create excessive frontend request pressure: the shared monthly clock refreshed every minute while its cache expired after 30 seconds, and missing metric data could fan out full-cycle history requests for many nodes. The resulting shared request-pool/backend pressure was consistent with missing monthly traffic, delayed Ping/three-network data, and a theme upload appearing stuck at 100%. There is no evidence that v1.0.2 wrote, reset, or corrupted Komari cumulative counters or database data.

### Compatibility

- Annual billing still uses a monthly traffic renewal window derived from the UTC `expired_at` calendar day; 29/30/31-day short-month clamping and later restoration remain unchanged.
- SGD/S$ support remains compatible with C$ (CAD) and `$` (USD).
- Komari Server 1.5.0 latest status payloads without `traffic_up/down` remain supported. Agent v1 protocol changes are separate from the theme's RPC and frontend fallback layers.
- The v1.0.3 migration is forward-only: the fixed package rollout anchor is `2026-09-16T00:00:00.000Z`; a cycle that started before it remains on legacy cumulative display until its next renewal boundary. The anchor is package/build data, not browser storage or a server-side write.

### Finance audit

- Existing `monthlyCost`, yearly/remaining-value calculations, currency normalization, and exchange-rate formatting are stateless views of current node metadata and rates. No new renewal-cycle finance snapshot was introduced; the forward-only migration gate applies to the new monthly traffic derivation only.

## 1.0.2 — Released

Validated compatibility target: Komari Server 1.5.0. The theme keeps the existing RPC and legacy frontend fallback paths for older compatible servers.

### Fixed

- Monthly traffic quota usage now derives from the active renewal-day window instead of treating persistent `net_total_up/down` counters as the current month. Annual billing still rolls the traffic window monthly; the renewal calendar day is clamped to the last day of short months and restored in the next long month.
- Monthly usage is loaded through the shared metric/history derivation layer: Komari 1.5.0 uses `traffic.up` / `traffic.down` SUM series and adds every returned bucket; a node with a missing or all-null metric series falls back individually to the bounded network-history compatibility path, whose first request includes both the active `start/end` and a safe covering `hours` window before strict client-side filtering. Only additive `traffic_up/down` deltas are used; if no cycle delta is available, the previous cumulative display is retained and identified internally as the legacy fallback.
- Added Singapore Dollar support to finance parsing and formatting: `SGD` and `S$` normalize to `SGD`; existing `$` (USD) and `C$` (CAD) mappings remain unchanged.

### Compatibility

- The theme does not depend on `traffic_up/down` in `common:getNodesLatestStatus`; Komari 1.5.0 latest status payloads without those fields are supported.
- Cumulative `net_total_*` source data is never reset or written back. Komari Agent v1 protocol removal is independent of the theme's RPC and frontend legacy fallback compatibility.

## 1.0.1 — Released

Upstream base: Glassmorphism Enhanced v1.0.0 (`42e0190b1812edfb95fe90c518e84cb063ae2939`).

### Fixed

- Simplified Transit current-value and history Tooltips: current values retain only carrier, Transit marker, Relay and the two-segment RTT expression; history cells retain carrier, Transit marker, timestamp and estimated value without repeating the link task or diagnostic breakdown.
- Fixed a confirmed long-running history alignment bug where two 20-slot histories with small timestamp drift could lose a slot. Each segment is now normalized by its own ordered slots while disjoint time windows remain uncombined.

### Documentation

- Rewrote README as a project homepage based on current behavior, including Transit limitations, `nodes.visibleNodes` Hidden Relay protection, direct compatibility and the `1.0.1` release path.
- Corrected release documentation to describe the actual `main`-push-only automation.

### Changed

- Replaced `docs/preview.png` with the owner-provided 1280×720 production Komari screenshot. The asset is copied unchanged; no fixture, AI-generated or synthetic image is used.

## 1.0.0 — Released

Upstream base: Glassmorphism v3.3.7.

- Establish an independent SemVer line: bugfix `1.0.x`, compatible features `1.x.0`, breaking changes `2.0.0`. No `-enhanced.x` suffix; upstream versions are provenance only.
- Preserve upstream attribution: original theme author **Tokinx** and upstream maintainer **sanrokamlan** remain credited in README, LICENSE, THIRD_PARTY, Git history, and this changelog; changing the manifest maintainer to `casiuna` does not remove that provenance.
- Rename the Fork to `casiuna/Glassmorphism-Enhanced`; unify the public name as **Glassmorphism Enhanced**. Keep internal `short: Glassmorphism` and ZIP layout for compatibility.
- Add optional Transit Carrier Ping: exact-name rules, one relay source shared with existing Ping caches, Metric/Legacy fallback, no backend changes.
- Estimate RTT by adding segments and loss by multiplying success probabilities; align history on a common 20-slot timeline and preserve missing data.
- Mark estimates explicitly, include relay/segment tooltips, suppress derived volatility, and fail safely for missing/ambiguous relays/tasks or offline relays.
- Rewrite README as a project homepage with generic configuration examples and migration guidance.
- Preserve all historical tags/releases, including `v3.3.7-enhanced.1`. The independent release history starts at `v1.0.0`; no tag or Release is created by this review task.

## [3.3.7-enhanced.1] - 2026-08-28

Based on Komari Glassmorphism v3.3.7 (`bf8376587c720de915ac48789a8a180357c762d6`).

### Added

- China Unicom, China Telecom, and China Mobile latency panels.
- Per-carrier packet-loss panels and Ping history blocks.
- Case-insensitive carrier task matching for Chinese and English aliases.
- Aggregation when one carrier has multiple Ping Tasks.
- Automatic, persistent, upstream, and off globe arc modes.
- Deterministic, deduplicated, bounded automatic globe connections.
- Shared upstream-tag parser for advanced topology and globe arcs.
- Three-network emerald-style light/dark default background.
- Deterministic Playwright coverage for carrier, globe, topology, missing-geo, no-task, and mobile scenarios.

### Preserved

- Glassmorphism v3.3.7 cumulative traffic history fix and current Metric Store behavior.
- Ping Task backend ordering and legacy API fallback compatibility.
- Existing realistic, Cobe, and tiled earth renderers.
- `upstream:NodeName` / `上游:NodeName` topology semantics.
- ASN/BGP topology and authenticated advanced tools.
- Existing theme settings, responsive layouts, and light/dark behavior.

### Changed

- Public Ping Task metadata is cached and shared so carrier derivation does not create per-node duplicate task-list requests.
- Node geo resolution can try another available IP candidate after a failed lookup instead of excluding a node solely because its IPv4 is private.
- Theme display metadata identifies the project as Glassmorphism Enhanced while retaining the internal `short` identifier `Glassmorphism` for Komari compatibility.

[3.3.7-enhanced.1]: https://github.com/casiuna/Glassmorphism-Enhanced/releases/tag/v3.3.7-enhanced.1
