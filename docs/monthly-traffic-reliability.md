# Monthly traffic reliability — review-only change

Baseline: published fork v1.0.5, `3bb76d9fd6f86d9fe56845b12922ee75866f2ed3`. Branch: `fix/monthly-traffic-reliability`. Manifest stays **1.0.5**; a future 1.0.6 bump needs owner approval. No PR, merge, main push, tag or Release in this pass. Only `casiuna/Glassmorphism-Enhanced` is writable; no production/DB/VPS/Agent/provider access and no upstream PR #57 access.

## What was wrong

- v1.0.3's fixed rollout helper prevented immediate reconstruction of cycles predating its anchor.
- Both the service and composable substituted machine `net_total_up/down` into monthly `used/percentage` when data was missing or pending. Lifetime usage could masquerade as current-month usage, produce a false full-quota alert, or silently become zero.
- The list's text used the monthly service but its colored progress used lifetime counters; health burn-rate divided monthly traffic by machine uptime.
- An outer RequestManager wrapper waited on metric/history services that themselves acquire pool slots. Many distinct cycle groups could occupy the pool with nested waits.

## Current behavior

There is **no rollout anchor**, visitor activation state, storage migration flag or grandfathered cycle. A recurring plan with a valid expiry calendar day and quota immediately requests the actual current monthly window. Annual/quarterly/semiannual/etc. payment durations do not lengthen traffic periods. One-off/custom/invalid renewal metadata gets `not-applicable`, not an invented month.

Boundaries remain UTC calendar midnight, with day 29/30/31 clamping and restoration. Queries use the current cycle start and snapshot `now`; included observations are in **[start, now)**. An exact empty boundary is unknown until observations arrive, not a manufactured zero. Cache keys include cycle and relevant node configuration; old-cycle or old-config values cannot appear as new ones.

This is a **provisional monthly window inferred from current node metadata**, not a verified provider renewal/reset policy. The frontend does not know whether the provider uses another timezone, renewal anchor, traffic period or inclusion rule. Official policy and usage reconciliation must be performed separately; no production calibration is claimed.

`used/percentage` are nullable. States:

- `ready`: required directions have a uniquely matched, untagged, non-adaptive-filled SUM series with valid range/interval metadata and every expected UTC-aligned bucket has finite non-negative value and positive observation count. The complete grid is checked, not only visible first/last buckets; duplicates cannot stand in for a missing middle bucket. Unlocatable timestamps prevent certification. Zero-valued buckets with positive counts are genuine observed zeros.
- `partial`: some observations exist but the required direction, range, aggregation, counts or bucket coverage cannot be certified. Observed directional subtotals are diagnostics only, not a quota percentage.
- `unknown`: no usable observations/method, malformed or mismatched entities, empty response, or empty current window.
- `loading`: no result yet for this exact cycle/configuration; no lifetime substitution or zero flash.
- `not-applicable`: no defensible monthly cycle.

**`ready` certifies observable returned-bucket coverage only**, not all physical network traffic, every expected Agent report, or a provider bill. The UI labels values as collected monthly usage and identifies the configured mode/sample time, not official billing. Within-bucket reporting gaps, a delta crossing midnight and initial/reset baselines cannot be conclusively reconstructed by this frontend contract. Provider comparison remains mandatory. Raw-only responses without interval coverage metadata are deliberately partial, including the first short window after renewal.

`traffic_limit_type` is the only provisional quota mode: up/down require their own direction; sum/min/max require both. Min/max are applied to **period totals**, not bucket-by-bucket. The theme does not infer or write provider policies. The existing financial metered estimator keeps its user-selected mode and machine-counter snapshot; it explicitly is not monthly quota usage or a bill. Static prices/rates/remaining-value calculations are unchanged.

Home cards, list text and progress, detail, quota summary, comparison, health warnings/burn-rate and snapshot export consume the same monthly service. Unknown values suppress numeric quota fills and threshold warnings; aggregate summaries do not silently fill missing nodes with zero. Machine totals stay explicitly labeled as a different non-monthly scope. Snapshot output carries nullable bytes/status/basis rather than invented zeros.

## Read-only Komari source audit

Versions examined:

- Server 1.5.0: `f18ad72c173b8821711cba0f2fb238c2486ec9af`.
- Server 1.5.1: `f0cc0fba38ce161935372633cae5248c934e2b23`.

The six relevant files below are byte-identical between those checked versions:

1. `web/rpc/jsonrpc/public.metric.go`: explicit entity_ids/start/end; SUM aggregation; response series split by entity/tags; empty entity series; raw window vs downsampled `interval_seconds`/`downsample_algorithm`; point `count`. `adaptiveFillPublicMetricSeries` (lines 548–607 in the audited 1.5.1 source) can inflate `interval_seconds` to a sparse observed cadence. Regularly missing aggregation buckets may then look continuous. Monthly requests explicitly use `aggregation=sum`, **`fill_empty=false`**, max_points=2000 so the genuine aggregation interval is retained. Adaptive-filled responses are not certified, even when visible first/last points or the inflated grid appear complete. The frontend matches exact UUID + metric and rejects duplicate/tagged ambiguities. Other charts' fill behavior is unchanged.
2. `internal/metricstore/report_mapping.go`: `traffic.up/down` are report deltas; `net.total.up/down` are machine counters, not interchangeable.
3. `internal/metricstore/report_batcher.go`: previous-counter baseline restoration, report ordering/reset behavior and timestamp assignment; deltas are attached to reports, not a provider billing ledger.
4. `pkg/metric/rollup_query.go`: compatible rollup backing/output interval and retention. Also checked `internal/metricstore/config.go`, `pkg/metric/rollup.go` and server tests as source: short raw window, minute/five-minute/hour/day tiers, SUM preserves sampled additions. We did not run server tests or any SQL.
5. `web/rpc/jsonrpc/common.record.go`: bounded start/end network load requests, maxCount=-1; legacy hours fallback must cover the whole requested window.
6. `internal/metricstore/legacy_records.go`: history is reconstructed from metric Series; traffic uses SUM but net totals use LAST. Default Record fields can be zero when a metric was absent, and response drops per-metric coverage/count evidence. Therefore **history cannot be promoted to `ready`**, even if records appear contiguous. Detail exposes only an explicitly labeled observed fragment subtotal.

Source links use the official Komari repository, e.g. https://github.com/komari-monitor/komari/blob/1.5.0/web/rpc/jsonrpc/public.metric.go . No real Server API/DB was contacted. Actual deployed version, retention, report interval, clock skew, metadata accuracy and provider inclusions/exclusions are not verified here.

## Availability safeguards

- One metric batch per distinct cycle range, not per card/node; 5-minute refresh checks and 10-minute result TTL remain.
- Concurrent requests are deduplicated/limited by the existing metric/history service layer; no extra outer pool slot.
- Shared/home never runs monthly history. History option is enforced only when the **entire context contains one node**, with shared/detail cache mode separation.
- History uses bounded start/end + safe covering hours + network + maxCount=-1; missing/failed history remains unknown/partial.
- The shared minute clock detects cycle changes, not a minute-by-minute monthly fetch storm. Loading keeps an already known same-cycle value; new cycle/config never reuses an old one.

## Next reconciliation plan — no writes

1. User supplies a redacted node identifier, the configured renewal day/mode and the official provider policy URL; do not guess from brand/name.
2. From user-authorized read-only exports, compare the same **UTC start/end** with per-direction SUM series and bucket/count coverage. Record raw vs rollup resolution, missing buckets, retention and collection start; do not fill gaps or subtract lifetime totals as a repair.
3. User exports the matching official provider bill/usage window without credentials or unnecessary account details. Check timezone, unit (GB vs GiB), direction rules, included traffic/interface scope and reset time individually.
4. Keep collected usage, provider-reported usage and any unexplained delta in separate columns. Missing evidence stays unknown/partial. No UPDATE/DELETE/DDL, bulk fixes, hidden settings writes or automatic policy changes.
5. Before deploying this unreleased theme, the user should test known long-running and newly added nodes, recently offline/reset nodes, each configured direction mode, and an actual renewal boundary. Fixtures are not production or provider validation.
