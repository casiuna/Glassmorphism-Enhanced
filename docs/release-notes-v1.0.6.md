# Glassmorphism Enhanced v1.0.6 — release notes

Status: owner-approved local candidate on **`casiuna/Glassmorphism-Enhanced:fix/v1.0.6-performance`**. This pass permits one reviewed local commit and commit-matched packaging only. It does not push, merge, create a tag/Release, deploy, or modify production or databases.

## Ping loading and request queue fixes

- Prevent a cancelled or settled request from deleting a newer same-key pending request.
- Cancel both Ping history return-type keys; obsolete subscriptions and unmounted charts cannot continue legacy fallback or overwrite newer state.
- Keep range-history compatibility fallback inside its existing request-pool slot and abort signal, avoiding nested queue blocking.
- Cache complete, successful Ping chart histories in memory for 60 seconds, with at most 128 keys. UUID, range, point count and retention remain isolated; reads return copies, and empty/failed histories are not cached.
- Subscribe to card/list Ping only near the viewport, with a 200px preload margin; release off-screen subscriptions and retain the fallback when IntersectionObserver is unavailable. Shared relay Ping behavior is preserved.

These changes are covered by deterministic request/cache/component tests. No production latency benchmark or percentage speedup is claimed.

## Consistent monthly traffic display

- Homepage summaries, node cards, details and comparison panels use the shared monthly usage source instead of presenting lifetime `net_total_up/down` counters as this month's traffic.
- Valid recurring monthly and annual plans use monthly UTC renewal-day windows; zero/null unlimited quotas still receive a monthly window. Short-month clamping retains the original renewal-day anchor.
- Missing/untrusted dates, non-ready usage or missing directions remain **待核对**, not fabricated zeroes or ready percentages. A genuine ready zero remains zero. Quota usage retains the configured traffic basis.
- Historical counters and collected data are preserved. Monthly windows derived from node metadata and metric coverage are not official provider-bill reconciliation.

## Reproducible build preparation

- `komari-theme.json.version` is **1.0.6** and remains the sole version source; no `package.json.version` is added.
- Commit the native `bun.lock` and use **Bun 1.3.14** with `bun install --frozen-lockfile`. The release workflow now uses the same Bun version as the quality/visual workflows and `package.json`.
- Keep the existing package contract: `komari-theme-Glassmorphism-build-<short-sha>.zip` containing exactly `komari-theme.json`, `preview.png`, and `dist/`. Rebuild after the final local commit; a later authorized main merge requires a new build at that main SHA.

## Compatibility and publication boundary

The v1.0.5 Transit rule order remains **relay | target | task**; there is no new rule migration in v1.0.6. Komari Server/Agent, the database schema, history and provider accounts are unchanged. Existing theme configuration and historical releases are not rewritten.

The earlier Chromium 155/155 and unit/component 28/28 checks are historical validation of this candidate's source changes. Current release-preparation installation, static, unit and build results are recorded in `AICACHE.md`; local success is not proof of a published GitHub Release or production deployment.
