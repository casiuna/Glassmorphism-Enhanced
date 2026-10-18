# Glassmorphism Enhanced v1.0.6 — release notes

Status: **published on 2026-10-18** by this fork's main-push release workflow at **`b9f7f4f730a9e8445d261363fe8c070c98bd3001`**. The annotated tag and [v1.0.6 Release](https://github.com/casiuna/Glassmorphism-Enhanced/releases/tag/v1.0.6) identify that commit. [Download the theme ZIP](https://github.com/casiuna/Glassmorphism-Enhanced/releases/download/v1.0.6/komari-theme-Glassmorphism-build-b9f7f4f.zip). GitHub publication does not imply production installation or database changes.

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

## Reproducible build and published package

- `komari-theme.json.version` is **1.0.6** and remains the sole version source; no `package.json.version` is added.
- The native `bun.lock` is committed and uses **Bun 1.3.14** with `bun install --frozen-lockfile`. The release workflow uses the same Bun version as the quality/visual workflows and `package.json`.
- The published package is `komari-theme-Glassmorphism-build-b9f7f4f.zip`, containing exactly `komari-theme.json`, `preview.png`, and `dist/`, built at the release commit. The package contract remains `komari-theme-Glassmorphism-build-<short-sha>.zip`. Subsequent documentation-only main commits leave this tag and asset unchanged; future versions require their own commit-matched build.

## Compatibility and publication boundary

The v1.0.5 Transit rule order remains **relay | target | task**; there is no new rule migration in v1.0.6. Komari Server/Agent, the database schema, history and provider accounts are unchanged. Existing theme configuration and historical releases are not rewritten.

Pre-release local source validation passed Chromium 155/155 and unit/component 28/28, TypeScript, ESLint and production build. Frozen-dependency revalidation also passed 28 unit/component tests and 14 focused detail/comparison Chromium cases; preparation records remain in `AICACHE.md`. GitHub publication is now verified separately by the published tag, Release and ZIP. Neither fixture tests nor publication certify a provider bill or a production deployment.
