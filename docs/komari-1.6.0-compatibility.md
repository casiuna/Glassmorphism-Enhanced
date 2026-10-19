# Komari 1.6.0 compatibility review (v1.1.0 pre-release verification)

## Isolation and pinned inputs

- Session: `20261019_060547_b240f6` (desktop/default); no previous session resumed.
- Worktree: `/home/hermes/workspaces/komari-110-20261019_060547_b240f6/theme`.
- Branch: `feat/komari-1.6.0`, independent bare repository, fork main baseline `20109bfab5de1278c94d6344114dfd50f3ecf496`.
- Komari `1.6.0`: `1b76b7ad5bc3de6529bb7f0577069b4ac241fec3`.
- Komari `1.5.1`: `f0cc0fba38ce161935372633cae5248c934e2b23` (peeled tag).
- Glassmorphism `v3.4.2`: `69878cb95cfa43a2573cf1d9916ea62daf3c93c5`.
- Three-Network `v2.4.0`: `14ba911e574619b079fdee37a61f16e605f16457`.
- Emerald `v1.0.16`: `9f9a076df2bc680ddd8c42b6d921a96beec5ea90`.
- Market main: `8751d7f10b5e0269d0f25f4ee2848b414d02bb9d`; `Enhanced` has no exact or case-insensitive collision in `v1.json`. Recheck immediately before submission.

This review was recorded before application code changes. All backend runs use official release binaries verified against GitHub asset SHA-256 digests, separate data directories and loopback listeners. No production server, database, installed agent, old theme or other Hermes session files are modified.

## Interface review

| Area             | Source evidence and decision                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Visitor audit    | `web/rpc/jsonrpc/public.go` in 1.6.0 has no `public:recordVisitorEvent`; public settings no longer advertise `visitor_audit_enabled`. The theme already requires that field to be a boolean before offering the capability, and requires `true` before submitting events. Keep this capability gate, test that no call or fingerprint collection occurs when absent, and replace the obsolete PR #602 / future-upgrade messages. Do not remove ordinary admin audit logs. |
| HTTP / RPC / WS  | `web/router/router.go` preserves `/api/public`, `/api/nodes`, `/api/me`, `/api/records/load`, `/api/records/ping`, `/api/task/ping`, `/api/clients` and `/api/rpc2`. The theme uses these existing compatibility interfaces. Verify transport, heartbeat, reconnection and errors against both real versions before concluding.                                                                                                                                           |
| History and Ping | Theme has metrics queries plus legacy history fallbacks, bounded/deduplicated requests and cancellation. Preserve three-carrier selection, loss values, timestamps, task names/order and complete loss. Never replace missing samples with invented successes.                                                                                                                                                                                                            |
| Transit          | Preserve `Relay\|Target\|LinkTask` rules, shared Ping source and two-segment estimate. Existing deterministic regressions must remain passing; exercise real test agents and stored history too.                                                                                                                                                                                                                                                                          |
| Traffic          | Preserve `net_total_up/down`, all five `traffic_limit_type` calculations and current wording. No monthly/billing redesign.                                                                                                                                                                                                                                                                                                                                                |
| Nodes / GPU      | Verify actual agent CPU, RAM, disk, speed, cumulative counters, online/offline and history. Check optional GPU schema separately; test host GPU availability must be stated, not invented.                                                                                                                                                                                                                                                                                |
| Admin            | Verify login/session, settings, ordinary logs and theme installation/settings using supported endpoints. Existing embedded admin distribution must be inspected for incompatible calls; no new integration with removed notification/terminal APIs.                                                                                                                                                                                                                       |
| Theme identity   | Backend `web/api/admin/theme.go` stores theme files under `data/theme/<short>` and configurations keyed by `ThemeConfiguration.Short`. `Enhanced` is a separate install, not an automatic rename or automatic configuration migration. Use supported theme APIs to copy settings explicitly in the isolated test environment, retain old `Glassmorphism`, and verify rollback. Never edit SQL or delete the old theme.                                                    |

## Selective upstream review

- Glassmorphism request manager is missing this fork's promise-identity check in `pending.delete`; do not regress it by merging upstream.
- Glassmorphism history normalization coerces missing traffic fields to zero, while this fork preserves missingness and range fallback. Do not import wholesale.
- Glassmorphism adds display-only EWMA and minimum-span Ping axis helpers. These change presentation, and this fork already has cache/cancellation/custom-range tests; no blanket chart replacement is justified. Preserve raw loss/history and current task selection. Review GPU normalization independently if real backend evidence demonstrates a problem.
- Glassmorphism's renderer capability check and fallback to the existing tiled map address a concrete missing failure path in this fork. Consider a narrowly scoped fallback, retaining upstream attribution, only with no-WebGL and normal-renderer tests.
- Three-Network 2.4.0 uses the same IP geo helper as this fork and documents the same carrier-name matching / 100% loss contract. Existing carrier and Transit tests are the regression anchor, not a whole-source merge.
- Emerald uses a different chart/data implementation and has no matching `ipGeoHelper.ts`; its approach is reference material, not a drop-in patch. Current IPv6 candidates, encoded lookup paths, provider fallback, caching and country fallback must remain covered.
- SGD and the thirteen-currency exchange/cache/manual-override implementation already exist in `financeHelper.ts`. Documentation and tests only; no algorithm rewrite.

## Baseline before application edits

- Frozen install: Bun 1.3.14, existing lockfile unchanged.
- `bun run type-check`: pass.
- Non-fixing full-project ESLint: pass.
- Vite build / theme ZIP: pass (baseline version, not a release candidate).
- Existing unit/component suite: 28 pass, 0 fail, 0 skip.
- First browser attempt blocked by missing Chromium shared libraries, before assertions. Runtime libraries/fonts are being extracted under this task's `tools/sysroot`, without system package installation. Original snapshot expectations will not be overwritten to make tests pass.

## Pre-release verification and publication authority

### Real regression finding: settings ACK (both backend versions)

An authenticated request to `admin:editSettings` returned HTTP 200 with exactly
`{"jsonrpc":"2.0","id":"settings-contract-probe"}` on both pinned binaries.
Supported API readback confirmed the setting was saved. The old theme parser
rejected the absent `result`, causing the legacy visitor-audit toggle to report
failure after a successful write. This was found by the extended real UI test,
not by suppressing its error.

The compatibility fix accepts the empty result only for `admin:editSettings`,
records the pending method for WebSocket correlation, and keeps query payloads,
protocol validation and permission errors strict. Malformed correlated WS
responses fail explicitly rather than lingering until timeout. Dedicated tests
cover both transports, failure cases and concurrent data/void calls.

Local pre-release acceptance passed: browser 81/81, unit/component 67/67, real Komari 1.6.0/1.5.1 integration 16/16, no-fix ESLint, TypeScript, diff-check and production build. The browser report has no pinned source fingerprint; the latest built package's payload files were compared byte-for-byte with the recorded integration-tested bundle. Physical GPU telemetry was not tested.

This document records pre-release review and verification, not proof of remote publication or full hardware compatibility. The verified GitHub Actions run, release tag target and downloaded asset are authoritative for publication; local ZIPs and a CHANGELOG status label are not. Main pushes, tags, Releases and market submissions require their own authorization and readback. No production server, Agent or database writes are part of this release preparation.
