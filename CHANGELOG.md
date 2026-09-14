# Changelog

All notable Glassmorphism Enhanced changes are documented here. Upstream history remains in the upstream repository and preserved Git history.

## 1.0.2 — Unreleased

Validated compatibility target: Komari Server 1.5.0. The theme keeps the existing RPC and legacy frontend fallback paths for older compatible servers.

### Fixed

- Monthly traffic quota usage now derives from the active renewal-day window instead of treating persistent `net_total_up/down` counters as the current month. Annual billing still rolls the traffic window monthly; the renewal calendar day is clamped to the last day of short months and restored in the next long month.
- Monthly usage is loaded through the shared metric/history derivation layer: Komari 1.5.0 uses `traffic.up` / `traffic.down` SUM series and adds every returned bucket; older compatible servers fall back to time-filtered network records and their additive traffic deltas. If neither cycle history path is available, the previous cumulative display is retained and identified internally as the legacy fallback.
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
