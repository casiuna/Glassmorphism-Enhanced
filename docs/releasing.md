# Releasing Glassmorphism Enhanced

Repository: https://github.com/casiuna/Glassmorphism-Enhanced

## Independent version policy

The independent version line began at **1.0.0**, which is released as Git tag / GitHub Release **v1.0.0**. This maintenance round targets **1.0.1**. `komari-theme.json.version` is the sole source of truth; do not add `package.json.version`.

- Bugfix: `1.0.1`, `1.0.2`, …
- Compatible feature: `1.1.0`, `1.2.0`, …
- Breaking change: `2.0.0`.
- No `-enhanced.x` suffix and no upstream version in our release number.
- Upstream base: Glassmorphism v3.3.7. Record future upstream provenance in CHANGELOG / AICACHE, independently of our SemVer.
- Keep the historical `v3.3.7-enhanced.1` tag/Release. Numeric comparison against the old line must not be used to select the independent release.

## Review gate

The transit feature task stops at **Ready for review**: feature branch and PR only. Do not push main, force push, merge, create tags, or publish a Release automatically. Do not delete historical releases or tags.

The existing `Release On Version Bump` workflow runs on pushes to `main` only; it does not use `workflow_dispatch`. It compares manifest versions for inequality, so the transition from released `1.0.0` to `1.0.1` is supported. After this PR is approved and merged into `main`, the manifest change to `1.0.1` is expected to trigger the `v1.0.1` tag and GitHub Release. If `v1.0.1` already exists on another commit, the current workflow intentionally assumes it was handled manually and skips publication; the owner must resolve that tag collision before merging. Do not dispatch the workflow during this task. The workflow itself is not changed, avoiding extra Actions/Workflows write permissions.

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
